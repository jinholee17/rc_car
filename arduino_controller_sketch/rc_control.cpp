#include "rc_car.h"
#include "rc_control.h"
#include "fsm.h"
// #include <WiFiS3.h>
#include <Servo.h>
#include <WDT.h>

bool testAllCarFSM();

// Ultrasonic
const int trigPin = 7;
const int echoPin = 2;

// Drive motor pins (throttle)
const int PIN_UD_FORWARD = 8;  // PWM_UD 3
const int PIN_UD_BACK    = 12;  // PWM_UD 6
const int SPEED_PIN = 11;

// Servo for steering
const int SERVO_PIN = 9;
Servo steeringServo;

// ---  Variables for ultrasonic ISR ---
volatile unsigned long echoStart = 0;
volatile unsigned long echoEnd = 0;
volatile bool echoDone = false;
unsigned long lastTrigger = 0; 
float curDistanceCm = 1000.0f; // The current distance calculated by the ultrasensor.

// Networking
// WiFiServer server(8080);

//WDT
const int wdtInterval = 5000;

// Command inputs from app (latest requested values)
int latestThrottleCmd = 0;  // -255..255
int latestTurnCmd     = 0;  // -255..255

// FSM state
full_state carState;

// --- Helpers to parse query params from "GET /drive?ud=...&lr=... HTTP/1.1" ---

int getParamValue(const String &query, const String &name, bool &found) {
  int idx = query.indexOf(name + "=");
  if (idx == -1) {
    found = false;
    return 0;
  }
  int start = idx + name.length() + 1;
  int end = query.indexOf('&', start);
  if (end == -1) {
    end = query.indexOf(' ', start); // end of path / start of " HTTP/1.1"
    if (end == -1) {
      end = query.length();
    }
  }
  String valueStr = query.substring(start, end);
  found = true;
  return valueStr.toInt();
}

// Clamp helper
int clampInt(int val, int minVal, int maxVal) {
  if (val < minVal) return minVal;
  if (val > maxVal) return maxVal;
  return val;
}

float clampFloat(float val, float minVal, float maxVal) {
  if (val < minVal) return minVal;
  if (val > maxVal) return maxVal;
  return val;
}

// The ISR that triggers when the ultrasensor's echo pin has a change in signal.
void echoISR() {
  if (digitalRead(echoPin) == HIGH) {
    echoStart = micros();
  } else {
    echoEnd = micros();
    echoDone = true;
  }
}

// Triggers the ultrasonic sensor to fire.
void triggerUltrasonic() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
}

// Calculates the distance from the ultasonic sensor.
void calculateDistance() {
  // If the echo is not done yet, ignore.
  if (!echoDone) {
    return;
  }

  echoDone = false;

  // Get the start and end for this echo.
  unsigned long curStart;
  unsigned long curEnd;
  noInterrupts();
  curStart = echoStart;
  curEnd = echoEnd;
  interrupts();

  // Calculate the duration betwen the start and end,
  unsigned long duration;
  if (curEnd < curStart) { // If the end is less than the start time, we did not get a return ping. 
    duration = 0;
  }
  else {
    duration = curEnd - curStart;
  }

  if (duration == 0) {
    curDistanceCm = 1000.0; // Treat it as any object being far away.
  } else {
    curDistanceCm = duration * 0.0343f / 2.0f; // speed of sound
  }
}

// --- Hardware output helpers ---

void setThrottleOutput(int ud) {
  ud = clampInt(ud, -255, 255);
  int speed = abs(ud);

  analogWrite(SPEED_PIN, speed);

  if (ud > 0) {
    digitalWrite(PIN_UD_FORWARD, HIGH);
    digitalWrite(PIN_UD_BACK, LOW);
  } else if (ud < 0) {
    digitalWrite(PIN_UD_FORWARD, LOW);
    digitalWrite(PIN_UD_BACK, HIGH);
  } else {
    digitalWrite(PIN_UD_FORWARD, LOW);
    digitalWrite(PIN_UD_BACK, LOW);
  }
}

// Servo steering: map turn (-255..255) → angle (0..180)
void setSteeringOutput(int turn) {
  turn = clampInt(turn, -255, 255);

  int angleOffset = map(turn, -255, 255, 45, -45);

  // Servo.write expects 0..180; +90 recenters
  int servoAngle = angleOffset + 90;
  servoAngle = clampInt(servoAngle, 0, 180);

  // Serial.print("Steering turn=");
  // Serial.print(turn);
  // Serial.print(" -> servoAngle=");
  // Serial.println(servoAngle);

  steeringServo.write(servoAngle);
}

// --- FSM: updateFSM ---


// --- Setup & loop ---

void car_init() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  attachInterrupt(digitalPinToInterrupt(echoPin), echoISR, CHANGE);

  pinMode(PIN_UD_FORWARD, OUTPUT);
  pinMode(PIN_UD_BACK, OUTPUT);

  // Servo on pin 9
  steeringServo.attach(SERVO_PIN);
  steeringServo.write(90); // center position

  // Initial FSM state
  carState.distance_from_obstacle = 1000.0;
  carState.throttle               = 0;
  carState.turn                   = 0;
  carState.state                  = s_IDLE;

  // Ensure drive motors are off at start
  setThrottleOutput(0);

  // Serial.begin(9600);

  // COMMENT OUT LINES 236-249 TO SKIP TESTING, UNCOMMENT FOR TESTING
  
  // ---------- Testing code start ----------
  // delay(2000);
  // // Run FSM tests
  // bool ok = testAllCarFSM();

  // if (ok) {
  //   Serial.println("testAllCarFSM() reported: ALL PASSED");
  // } else {
  //   Serial.println("testAllCarFSM() reported: SOME FAILED");
  // }

  // // Stop here so loop() doesn't run the car logic
  // while (true) {
  //   // do nothing
  // }
  // ---------- Testing code end ----------

  WDT.begin(wdtInterval);
}

void car_loop() {
  // 1. Handle at most one incoming HTTP request (non-blocking pattern)
  // handleClientOnce();

  // wdt_enable(WDTO_8S);

  // 2. Read sensors (ultrasonic)
  unsigned long curTime = millis();
  if (curTime - lastTrigger >= 0) {
    triggerUltrasonic();
    lastTrigger = curTime;
  }

  calculateDistance();

  // 3. FSM update: compute next state from current + inputs
  carState = updateFSM(carState,
                       latestThrottleCmd,
                       latestTurnCmd,
                       curDistanceCm);

  // 4. Apply outputs to hardware
  setThrottleOutput(carState.throttle);
  setSteeringOutput(carState.turn);

  // wdt_reset();
  WDT.refresh();

  // 5. Small delay to keep loop from spinning too hard
  delay(10);
}

void car_handleRequest(const String &path, WiFiClient &client) {
    if (!path.startsWith("/drive")) return;

    int qIndex = path.indexOf('?');
    String query = qIndex != -1 ? path.substring(qIndex + 1) : "";

    bool hasUD = false, hasLR = false;
    int ud = getParamValue(query, "ud", hasUD);
    int lr = getParamValue(query, "lr", hasLR);

    if (hasUD) latestThrottleCmd = clampInt(ud, -255, 255);
    if (hasLR) latestTurnCmd     = clampInt(lr, -255, 255);

    client.println("HTTP/1.1 200 OK");
    client.println("Connection: close");
    client.println();
    client.println("OK");
}