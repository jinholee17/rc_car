// #include "rc_car.h"
// #include "fsm.h"
// #include <WiFiS3.h>
// #include <Servo.h>
// #include <WDT.h>

// bool testAllCarFSM();

// const char* ssid     =  "Verizon_FYCW9R"; //"Brown Bear";
// const char* password =  "mavis4-dun-fax"; //BbBbWDYS?3";

// // Ultrasonic
// const int trigPin = 7;
// const int echoPin = 2;

// // ---  Variables for ultrasonic ISR ---
// volatile unsigned long echoStart = 0;
// volatile unsigned long echoEnd = 0;
// volatile bool echoDone = false;
// unsigned long lastTrigger = 0; 
// float curDistanceCm = 1000.0f; // The current distance calculated by the ultrasensor.

// // Drive motor pins (throttle)
// const int PIN_UD_FORWARD = 8;  // PWM_UD 3
// const int PIN_UD_BACK    = 12;  // PWM_UD 6
// const int SPEED_PIN = 11;

// // Servo for steering
// const int SERVO_PIN = 9;
// Servo steeringServo;

// // Networking
// WiFiServer server(8080);

// //WDT
// const int wdtInterval = 5000;

// // Command inputs from app (latest requested values)
// int latestThrottleCmd = 0;  // -255..255
// int latestTurnCmd     = 0;  // -255..255

// // FSM state
// full_state carState;

// // --- Helpers to parse query params from "GET /drive?ud=...&lr=... HTTP/1.1" ---

// int getParamValue(const String &query, const String &name, bool &found) {
//   int idx = query.indexOf(name + "=");
//   if (idx == -1) {
//     found = false;
//     return 0;
//   }
//   int start = idx + name.length() + 1;
//   int end = query.indexOf('&', start);
//   if (end == -1) {
//     end = query.indexOf(' ', start); // end of path / start of " HTTP/1.1"
//     if (end == -1) {
//       end = query.length();
//     }
//   }
//   String valueStr = query.substring(start, end);
//   found = true;
//   return valueStr.toInt();
// }

// // Clamp helper
// int clampInt(int val, int minVal, int maxVal) {
//   if (val < minVal) return minVal;
//   if (val > maxVal) return maxVal;
//   return val;
// }

// float clampFloat(float val, float minVal, float maxVal) {
//   if (val < minVal) return minVal;
//   if (val > maxVal) return maxVal;
//   return val;
// }

// // --- Ultrasonic distance (cm) ---

// float measureDistanceCm() {
//   digitalWrite(trigPin, LOW);
//   delayMicroseconds(2);
//   digitalWrite(trigPin, HIGH);
//   delayMicroseconds(10);
//   digitalWrite(trigPin, LOW);

//   long duration = pulseIn(echoPin, HIGH, 25000); // timeout ~25ms
//   if (duration == 0) {
//     return 1000.0; // no echo → treat as "far away"
//   }

//   float distance = duration * 0.0343f / 2.0f; // speed of sound
//   return distance;
// }

// // The ISR that triggers when the ultrasensor's echo pin has a change in signal.
// void echoISR() {
//   if (digitalRead(echoPin) == HIGH) {
//     echoStart = micros();
//   } else {
//     echoEnd = micros();
//     echoDone = true;
//   }
// }

// // Triggers the ultrasonic sensor to fire.
// void triggerUltrasonic() {
//   digitalWrite(trigPin, LOW);
//   delayMicroseconds(2);
//   digitalWrite(trigPin, HIGH);
//   delayMicroseconds(10);
//   digitalWrite(trigPin, LOW);
// }

// // Calculates the distance from the ultasonic sensor.
// void calculateDistance() {
//   // If the echo is not done yet, ignore.
//   if (!echoDone) {
//     return;
//   }

//   echoDone = false;

//   // Get the start and end for this echo.
//   unsigned long curStart;
//   unsigned long curEnd;
//   noInterrupts();
//   curStart = echoStart;
//   curEnd = echoEnd;
//   interrupts();

//   // Calculate the duration betwen the start and end,
//   unsigned long duration;
//   if (curEnd < curStart) { // If the end is less than the start time, we did not get a return ping. 
//     duration = 0;
//   }
//   else {
//     duration = curEnd - curStart;
//   }

//   if (duration == 0) {
//     curDistanceCm = 1000.0; // Treat it as any object being far away.
//   } else {
//     curDistanceCm = duration * 0.0343f / 2.0f; // speed of sound
//   }
// }

// // --- Hardware output helpers ---

// void setThrottleOutput(int ud) {
//   ud = clampInt(ud, -255, 255);
//   int speed = abs(ud);

//   analogWrite(SPEED_PIN, speed);

//   if (ud > 0) {
//     digitalWrite(PIN_UD_FORWARD, HIGH);
//     digitalWrite(PIN_UD_BACK, LOW);
//   } else if (ud < 0) {
//     digitalWrite(PIN_UD_FORWARD, LOW);
//     digitalWrite(PIN_UD_BACK, HIGH);
//   } else {
//     digitalWrite(PIN_UD_FORWARD, LOW);
//     digitalWrite(PIN_UD_BACK, LOW);
//   }
// }

// // Servo steering: map turn (-255..255) → angle (0..180)
// void setSteeringOutput(int turn) {
//   turn = clampInt(turn, -255, 255);

//   int angleOffset = map(turn, -255, 255, 45, -45);

//   // Servo.write expects 0..180; +90 recenters
//   int servoAngle = angleOffset + 90;
//   servoAngle = clampInt(servoAngle, 0, 180);

//   Serial.print("Steering turn=");
//   Serial.print(turn);
//   Serial.print(" -> servoAngle=");
//   Serial.println(servoAngle);

//   steeringServo.write(servoAngle);
// }

// // --- FSM: updateFSM ---


// // --- Networking: handle one client request non-blockingly ---

// void handleClientOnce() {
//   WiFiClient client = server.available();
//   if (!client) {
//     return;
//   }

//   Serial.println("Client connected!");

//   // Read the first HTTP request line, e.g. "GET /drive?ud=120&lr=-40 HTTP/1.1"
//   String requestLine = client.readStringUntil('\r');
//   Serial.print("Request line: ");
//   Serial.println(requestLine);

//   // Clear the rest of the HTTP headers
//   while (client.available()) {
//     String headerLine = client.readStringUntil('\r');
//     if (headerLine == "\n" || headerLine == "\r\n") {
//       break; // reached blank line (end of headers)
//     }
//   }

//   int getIndex  = requestLine.indexOf("GET ");
//   int httpIndex = requestLine.indexOf(" HTTP/");
//   if (getIndex == -1 || httpIndex == -1) {
//     client.println("HTTP/1.1 400 Bad Request");
//     client.println("Connection: close");
//     client.println();
//     client.stop();
//     return;
//   }

//   String pathAndQuery = requestLine.substring(getIndex + 4, httpIndex); // skip "GET "
//   Serial.print("Path+Query: ");
//   Serial.println(pathAndQuery);

//   if (!pathAndQuery.startsWith("/drive")) {
//     client.println("HTTP/1.1 404 Not Found");
//     client.println("Connection: close");
//     client.println();
//     client.stop();
//     Serial.println("Unknown path, sent 404");
//     return;
//   }

//   // Extract query part after "?"
//   int qIndex = pathAndQuery.indexOf('?');
//   String query = "";
//   if (qIndex != -1) {
//     query = pathAndQuery.substring(qIndex + 1); // e.g. "ud=120&lr=-40"
//   }

//   bool hasUD = false;
//   bool hasLR = false;
//   int ud = getParamValue(query, "ud", hasUD);
//   int lr = getParamValue(query, "lr", hasLR);

//   Serial.print("Parsed ud=");
//   Serial.print(ud);
//   Serial.print(" (hasUD=");
//   Serial.print(hasUD);
//   Serial.print("), lr=");
//   Serial.print(lr);
//   Serial.print(" (hasLR=");
//   Serial.print(hasLR);
//   Serial.println(")");

//   // Update *command* inputs; FSM will use them next loop iteration
//   if (hasUD) {
//     latestThrottleCmd = clampInt(ud, -255, 255);
//   }
//   if (hasLR) {
//     latestTurnCmd = clampInt(lr, -255, 255);
//   }

//   // Simple HTTP response
//   client.println("HTTP/1.1 200 OK");
//   client.println("Content-Type: text/plain");
//   client.println("Connection: close");
//   client.println();
//   client.println("OK");

//   delay(1);
//   client.stop();
//   Serial.println("Client disconnected");
// }

// // --- Setup & loop ---

// void setup() {
//   pinMode(trigPin, OUTPUT);
//   pinMode(echoPin, INPUT);

//   attachInterrupt(digitalPinToInterrupt(echoPin), echoISR, CHANGE);

//   pinMode(PIN_UD_FORWARD, OUTPUT);
//   pinMode(PIN_UD_BACK, OUTPUT);

//   // Servo on pin 9
//   steeringServo.attach(SERVO_PIN);
//   steeringServo.write(90); // center position

//   // Initial FSM state
//   carState.distance_from_obstacle = 1000.0;
//   carState.throttle               = 0;
//   carState.turn                   = 0;
//   carState.state                  = s_IDLE;

//   // Ensure drive motors are off at start
//   setThrottleOutput(0);

//   Serial.begin(9600);

//   // COMMENT OUT LINES 236-249 TO SKIP TESTING, UNCOMMENT FOR TESTING
  
//   // ---------- Testing code start ----------
//   // delay(2000);
//   // // Run FSM tests
//   // bool ok = testAllCarFSM();

//   // if (ok) {
//   //   Serial.println("testAllCarFSM() reported: ALL PASSED");
//   // } else {
//   //   Serial.println("testAllCarFSM() reported: SOME FAILED");
//   // }

//   // // Stop here so loop() doesn't run the car logic
//   // while (true) {
//   //   // do nothing
//   // }
//   // ---------- Testing code end ----------


//   Serial.print("Connecting to WiFi…");
//   WiFi.begin(ssid, password);

//   while (WiFi.status() != WL_CONNECTED) {
//     delay(500);
//     Serial.print(".");
//   }

//   delay(5000); // original delay

//   Serial.println("\nConnected!");
//   Serial.print("Arduino IP Address: ");
//   Serial.println(WiFi.localIP());

//   server.begin();
//   Serial.println("HTTP server listening on port 8080");
//   WDT.begin(wdtInterval);
// }

// void loop() {
//   // 1. Handle at most one incoming HTTP request (non-blocking pattern)
//   handleClientOnce();

//   // wdt_enable(WDTO_8S);

//   // 2. Read sensors (ultrasonic)
//   //float distanceCm = measureDistanceCm();
//   unsigned long curTime = millis();
//   if (curTime - lastTrigger >= 0) {
//     triggerUltrasonic();
//     lastTrigger = curTime;
//   }

//   calculateDistance();

//   // 3. FSM update: compute next state from current + inputs
//   carState = updateFSM(carState,
//                        latestThrottleCmd,
//                        latestTurnCmd,
//                        curDistanceCm);

//   // 4. Apply outputs to hardware
//   setThrottleOutput(carState.throttle);
//   setSteeringOutput(carState.turn);

//   // wdt_reset();
//   WDT.refresh();

//   // 5. Small delay to keep loop from spinning too hard
//   delay(10);
// }