// #include <WiFiS3.h>
// #include "rc_car.h"

// const char* ssid     = "blasia";
// const char* password = "Welcometoblasia25";

// const int trigPin = 9;
// const int echoPin = 10;

// float duration, distance;

// // Motor pins (same as your PWM_UD / PWM_LR logic)
// const int PIN_UD_FORWARD = 3;  // PWM_UD 3
// const int PIN_UD_BACK    = 6;  // PWM_UD 6
// const int PIN_LR_LEFT    = 5;  // PWM_LR 5
// const int PIN_LR_RIGHT   = 11; // PWM_LR 11

// WiFiServer server(8080);

// // --- Helpers to parse query params from "GET /drive?ud=...&lr=... HTTP/1.1" ---

// int getParamValue(const String &query, const String &name, bool &found) {
//   // Looks for "name=" and returns its integer value.
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
// int clamp(int val, int minVal, int maxVal) {
//   if (val < minVal) return minVal;
//   if (val > maxVal) return maxVal;
//   return val;
// }

// // --- Motor control helpers, mirroring your Python semantics ---

// void setThrottle(int ud) {
//   // ud in [-255, 255]. >0 = forward on PIN_UD_FORWARD, <0 = back on PIN_UD_BACK
//   ud = clamp(ud, -255, 255);

//   if (ud > 0) {
//     analogWrite(PIN_UD_FORWARD, ud);
//     analogWrite(PIN_UD_BACK, 0);
//   } else if (ud < 0) {
//     analogWrite(PIN_UD_BACK, -ud); // use magnitude
//     analogWrite(PIN_UD_FORWARD, 0);
//   } else {
//     analogWrite(PIN_UD_FORWARD, 0);
//     analogWrite(PIN_UD_BACK, 0);
//   }
// }

// void setSteering(int lr) {
//   // lr in [-255, 255]. >0 = right on PIN_LR_RIGHT, <0 = left on PIN_LR_LEFT
//   lr = clamp(lr, -255, 255);

//   if (lr > 0) {
//     analogWrite(PIN_LR_RIGHT, lr);
//     analogWrite(PIN_LR_LEFT, 0);
//   } else if (lr < 0) {
//     analogWrite(PIN_LR_LEFT, -lr);
//     analogWrite(PIN_LR_RIGHT, 0);
//   } else {
//     analogWrite(PIN_LR_LEFT, 0);
//     analogWrite(PIN_LR_RIGHT, 0);
//   }
// }

// // --- Setup & loop ---

// void setup() {
//   pinMode(trigPin, OUTPUT);
//   pinMode(echoPin, INPUT);

//   pinMode(PIN_UD_FORWARD, OUTPUT);
//   pinMode(PIN_UD_BACK, OUTPUT);
//   pinMode(PIN_LR_LEFT, OUTPUT);
//   pinMode(PIN_LR_RIGHT, OUTPUT);

//   // Ensure motors are off at start
//   setThrottle(0);
//   setSteering(0);

//   Serial.begin(9600);
//   Serial.print("Connecting to WiFi…");
//   WiFi.begin(ssid, password);

//   while (WiFi.status() != WL_CONNECTED) {
//     delay(500);
//     Serial.print(".");
//   }

//   delay(5000); // your original delay

//   Serial.println("\nConnected!");
//   Serial.print("Arduino IP Address: ");
//   Serial.println(WiFi.localIP());

//   server.begin();
//   Serial.println("HTTP server listening on port 8080");
// }

// void loop() {
//   WiFiClient client = server.available();
//   if (!client) {
//     return;
//   }

//   Serial.println("Client connected!");

//   // --- Read the first HTTP request line, e.g. "GET /drive?ud=120&lr=-40 HTTP/1.1" ---
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

//   // --- Parse path and query ---
//   int getIndex = requestLine.indexOf("GET ");
//   int httpIndex = requestLine.indexOf(" HTTP/");
//   if (getIndex == -1 || httpIndex == -1) {
//     // Bad request line
//     client.println("HTTP/1.1 400 Bad Request");
//     client.println("Connection: close");
//     client.println();
//     client.stop();
//     return;
//   }

//   // Extract "/drive?ud=...&lr=..."
//   String pathAndQuery = requestLine.substring(getIndex + 4, httpIndex); // skip "GET "

//   Serial.print("Path+Query: ");
//   Serial.println(pathAndQuery);

//   // Only handle /drive; anything else → 404
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

//   // Apply controls only if present (you can choose to require both)
//   if (hasUD) {
//     setThrottle(ud);
//   }
//   if (hasLR) {
//     setSteering(lr);
//   }

//   // --- Send simple HTTP response ---
//   client.println("HTTP/1.1 200 OK");
//   client.println("Content-Type: text/plain");
//   client.println("Connection: close");
//   client.println();
//   client.println("OK");

//   delay(1);
//   client.stop();
//   Serial.println("Client disconnected");
// }

// // Your FSM stuff can stay here if you need it later:
// full_state updateFSM(full_state currState, int turn, int throttle) {
//   // ...
//   return currState;
// }
