#include <WiFiS3.h>
#include <Servo.h>
#include "rc_car.h"

// const char* ssid     = "blasia";
// const char* password = "Welcometoblasia25";

const char* ssid     = "Brown Bear";
const char* password = "BbBbWDYS?3";

// Ultrasonic (moved off 9 so servo can use 9)
const int trigPin = 7;
const int echoPin = 8;

float duration, distance;

// Drive motor pins (you can leave these for later)
const int PIN_UD_FORWARD = 8;  // PWM_UD 3
const int PIN_UD_BACK    = 12;  // PWM_UD 6

// Servo for steering
const int SERVO_PIN = 9;
Servo steeringServo;

WiFiServer server(8080);

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
int clamp(int val, int minVal, int maxVal) {
  if (val < minVal) return minVal;
  if (val > maxVal) return maxVal;
  return val;
}

// --- Optional: throttle helper (not used yet, just here for later) ---

void setThrottle(int ud) {
  // ud in [-255, 255]. >0 = forward, <0 = backward
  ud = clamp(ud, -255, 255);

  if (ud > 0) {
    // analogWrite(PIN_UD_FORWARD, ud);
    // analogWrite(PIN_UD_BACK, 0);
    digitalWrite(PIN_UD_FORWARD, HIGH);
    digitalWrite(PIN_UD_BACK, LOW);
  } else if (ud < 0) {
    // analogWrite(PIN_UD_BACK, -ud);
    // analogWrite(PIN_UD_FORWARD, 0);
    digitalWrite(PIN_UD_FORWARD, LOW);
    digitalWrite(PIN_UD_BACK, HIGH);
  } else {
    // analogWrite(PIN_UD_FORWARD, 0);
    // analogWrite(PIN_UD_BACK, 0);
    digitalWrite(PIN_UD_FORWARD, LOW);
    digitalWrite(PIN_UD_BACK, LOW);
  }
}

// --- Servo steering: map lr to -90..+90 degrees ---

void setSteeringFromLR(int lr) {
  // lr is coming from app, probably in [-255, 255]
  lr = clamp(lr, -255, 255);

  // Map [-255, 255] → [-90, 90]
  int angleOffset = map(lr, -255, 255, -90, 90);

  // Servo.write expects 0..180; +90 recenters
  int servoAngle = angleOffset + 90;
  servoAngle = clamp(servoAngle, 0, 180);

  Serial.print("Steering lr=");
  Serial.print(lr);
  Serial.print(" -> angleOffset=");
  Serial.print(angleOffset);
  Serial.print(" -> servoAngle=");
  Serial.println(servoAngle);

  steeringServo.write(servoAngle);
}

// --- Setup & loop ---

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  pinMode(PIN_UD_FORWARD, OUTPUT);
  pinMode(PIN_UD_BACK, OUTPUT);
  digitalWrite(PIN_UD_FORWARD, LOW);
  digitalWrite(PIN_UD_BACK, LOW);

  // Servo on pin 9
  steeringServo.attach(SERVO_PIN);
  steeringServo.write(90); // center position

  // Ensure drive motors are off at start
  setThrottle(0);

  Serial.begin(9600);
  Serial.print("Connecting to WiFi…");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  delay(5000); // original delay

  Serial.println("\nConnected!");
  Serial.print("Arduino IP Address: ");
  Serial.println(WiFi.localIP());

  server.begin();
  Serial.println("HTTP server listening on port 8080");
}

void loop() {
  WiFiClient client = server.available();
  if (!client) {
    return;
  }

  Serial.println("Client connected!");

  // Read the first HTTP request line, e.g. "GET /drive?ud=120&lr=-40 HTTP/1.1"
  String requestLine = client.readStringUntil('\r');
  Serial.print("Request line: ");
  Serial.println(requestLine);

  // Clear the rest of the HTTP headers
  while (client.available()) {
    String headerLine = client.readStringUntil('\r');
    if (headerLine == "\n" || headerLine == "\r\n") {
      break; // reached blank line (end of headers)
    }
  }

  // Parse path and query
  int getIndex = requestLine.indexOf("GET ");
  int httpIndex = requestLine.indexOf(" HTTP/");
  if (getIndex == -1 || httpIndex == -1) {
    client.println("HTTP/1.1 400 Bad Request");
    client.println("Connection: close");
    client.println();
    client.stop();
    return;
  }

  String pathAndQuery = requestLine.substring(getIndex + 4, httpIndex); // skip "GET "

  Serial.print("Path+Query: ");
  Serial.println(pathAndQuery);

  if (!pathAndQuery.startsWith("/drive")) {
    client.println("HTTP/1.1 404 Not Found");
    client.println("Connection: close");
    client.println();
    client.stop();
    Serial.println("Unknown path, sent 404");
    return;
  }

  // Extract query part after "?"
  int qIndex = pathAndQuery.indexOf('?');
  String query = "";
  if (qIndex != -1) {
    query = pathAndQuery.substring(qIndex + 1); // e.g. "ud=120&lr=-40"
  }

  bool hasUD = false;
  bool hasLR = false;
  int ud = getParamValue(query, "ud", hasUD);
  int lr = getParamValue(query, "lr", hasLR);

  Serial.print("Parsed ud=");
  Serial.print(ud);
  Serial.print(" (hasUD=");
  Serial.print(hasUD);
  Serial.print("), lr=");
  Serial.print(lr);
  Serial.print(" (hasLR=");
  Serial.print(hasLR);
  Serial.println(")");

  // For now: throttle just prints out
  if (hasUD) {
    Serial.print("Throttle command (ud): ");
    Serial.println(ud);
    // If you want to enable later:
    setThrottle(ud);
  }

  // Steering: use lr to move servo
  if (hasLR) {
    setSteeringFromLR(lr);
  }

  // Simple HTTP response
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/plain");
  client.println("Connection: close");
  client.println();
  client.println("OK");

  delay(1);
  client.stop();
  Serial.println("Client disconnected");
}