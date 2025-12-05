#include <WiFiS3.h>
#include "SoftwareSerial.h"
#include "DFRobotDFPlayerMini.h"

// WiFi credentials
const char* ssid     = "Anika-iPhone";
const char* password = "12345678";

// pins 2 and 3 to communicate with DFPlayer 
static const uint8_t PIN_MP3_TX = 2; // Arduino to DFPlayer RX
static const uint8_t PIN_MP3_RX = 3; // DFPlayer TX to Arduino
SoftwareSerial softwareSerial(PIN_MP3_RX, PIN_MP3_TX);

// Create player object
DFRobotDFPlayerMini player;

// BUTTONS (physical buttons on breadboard)
const int BTN_PLAY = 4;   // Play/pause
const int BTN_NEXT = 5;   // Next
const int BTN_PREV = 6;   // Previous

// WiFi server
WiFiServer server(8080);

// simple debounce
unsigned long lastPress = 0;
const unsigned long debounceDelay = 250;
bool isPaused = true;
int currentVolume = 30; // 0-30 range for DFPlayer Mini 


void setup() {
  Serial.begin(9600);
  softwareSerial.begin(9600);

  // BUTTON INPUTS 
  pinMode(BTN_PLAY, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_PREV, INPUT_PULLUP);

  // Initialize DFPlayer
  if (player.begin(softwareSerial)) {
    Serial.println("DFPlayer OK");
    player.volume(currentVolume);
    player.pause();      //prevents autoplay
    player.play(1);     // start first track
    player.pause();     // pause 
    isPaused = true;    // confirm pause state
  } 
  else {
    Serial.println("Connecting to DFPlayer failed :(");
  }

  // Scan for available networks (helpful for debugging)
  Serial.println("Scanning for WiFi networks...");
  int numNetworks = WiFi.scanNetworks();
  Serial.print("Found ");
  Serial.print(numNetworks);
  Serial.println(" networks:");
  
  bool foundNetwork = false;
  for (int i = 0; i < numNetworks; i++) {
    Serial.print(i + 1);
    Serial.print(": ");
    Serial.print(WiFi.SSID(i));
    Serial.print(" (");
    Serial.print(WiFi.RSSI(i));
    Serial.println(" dBm)");
    
    if (WiFi.SSID(i) == ssid) {
      foundNetwork = true;
      Serial.println("  ^ Found target network!");
    }
  }
  Serial.println();

  // Connect to WiFi with timeout
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int wifiTimeout = 30; // 30 seconds timeout (30 * 1000ms / 500ms = 60 attempts)
  int attempts = 0;
  
  while (WiFi.status() != WL_CONNECTED && attempts < wifiTimeout) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Print status every 5 seconds
    if (attempts % 10 == 0) {
      Serial.print(" [Status: ");
      Serial.print(WiFi.status());
      Serial.print("] ");
    }
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi connection failed! Check:");
    Serial.print("1. Network name: \"");
    Serial.print(ssid);
    Serial.println("\"");
    Serial.println("2. Password is correct (8+ characters)");
    Serial.println("3. Network is in range");
    Serial.println("4. For iPhone hotspot:");
    Serial.println("   - Settings > Personal Hotspot > ON");
    Serial.println("   - Keep phone unlocked");
    Serial.println("   - Make sure 'Maximize Compatibility' is ON");
    Serial.print("5. WiFi status code: ");
    Serial.println(WiFi.status());
    
    if (!foundNetwork) {
      Serial.println("\nWARNING: Target network not found in scan!");
      Serial.println("Double-check the network name (case-sensitive).");
    }
    
    Serial.println("\nContinuing anyway - buttons will still work, but app won't connect.");
  } else {
    delay(2000);
    Serial.println("\nWiFi Connected!");
    Serial.print("Arduino IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.println("Update this IP in your mobile app if it's different!");
  }

  server.begin();
  Serial.println("HTTP server listening on port 8080");
}

// Helper to parse query params from HTTP request
String getParamValue(const String &query, const String &name) {
  int idx = query.indexOf(name + "=");
  if (idx == -1) {
    return "";
  }
  int start = idx + name.length() + 1;
  int end = query.indexOf('&', start);
  if (end == -1) {
    end = query.indexOf(' ', start);
    if (end == -1) {
      end = query.length();
    }
  }
  return query.substring(start, end);
}

// Handle MP3 commands (used by both buttons and HTTP)
void handlePlayPause() {
  if (isPaused) {
    Serial.println("RESUME");
    player.start();
    isPaused = false;
  } else {
    Serial.println("PAUSE");
    player.pause();
    isPaused = true;
  }
}

void handleNext() {
  Serial.println("Next");
  player.next();
  isPaused = false;
}

void handlePrevious() {
  Serial.println("Previous");
  player.previous();
  isPaused = false;
}

void handleVolume(int volume) {
  // Clamp volume to 0-30 range
  if (volume < 0) volume = 0;
  if (volume > 30) volume = 30;
  
  currentVolume = volume;
  player.volume(volume);
  Serial.print("Volume set to: ");
  Serial.println(volume);
}

void loop() {
  unsigned long now = millis();

  // Check physical buttons
  if (digitalRead(BTN_PLAY) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;
    handlePlayPause();
  }

  if (digitalRead(BTN_NEXT) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;
    handleNext();
  }

  if (digitalRead(BTN_PREV) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;
    handlePrevious();
  }

  // Handle HTTP requests from mobile app
  WiFiClient client = server.available();
  if (client) {
    Serial.println("Client connected!");

    // Read the first HTTP request line
    String requestLine = client.readStringUntil('\r');
    Serial.print("Request: ");
    Serial.println(requestLine);

    // Clear the rest of the HTTP headers
    while (client.available()) {
      String headerLine = client.readStringUntil('\r');
      if (headerLine == "\n" || headerLine == "\r\n") {
        break;
      }
    }

    // Parse path and query
    int getIndex = requestLine.indexOf("GET ");
    int httpIndex = requestLine.indexOf(" HTTP/");
    if (getIndex != -1 && httpIndex != -1) {
      String pathAndQuery = requestLine.substring(getIndex + 4, httpIndex);

      // Check if it's an MP3 command
      if (pathAndQuery.startsWith("/mp3")) {
        // Check for status endpoint (exact match or starts with /mp3/status)
        if (pathAndQuery == "/mp3/status" || pathAndQuery.startsWith("/mp3/status?")) {
          // Return current state as JSON
          client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: application/json");
          client.println("Connection: close");
          client.println();
          client.print("{\"isPlaying\":");
          client.print(isPaused ? "false" : "true");
          client.print(",\"volume\":");
          client.print(currentVolume);
          client.println("}");
        } else {
          // Handle commands
          int qIndex = pathAndQuery.indexOf('?');
          String query = "";
          if (qIndex != -1) {
            query = pathAndQuery.substring(qIndex + 1);
          }

          String cmd = getParamValue(query, "cmd");
          String volumeStr = getParamValue(query, "volume");

          // Handle volume command
          if (volumeStr != "") {
            int volume = volumeStr.toInt();
            handleVolume(volume);
          }
          // Handle other commands (case-insensitive by checking both cases)
          else if (cmd == "play" || cmd == "Play" || cmd == "PLAY") {
            handlePlayPause(); // Toggle play/pause
          } else if (cmd == "pause" || cmd == "Pause" || cmd == "PAUSE") {
            handlePlayPause(); // Toggle play/pause
          } else if (cmd == "next" || cmd == "Next" || cmd == "NEXT") {
            handleNext();
          } else if (cmd == "previous" || cmd == "Previous" || cmd == "PREVIOUS") {
            handlePrevious();
          }

          // Send HTTP response
          client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: text/plain");
          client.println("Connection: close");
          client.println();
          client.println("OK");
        }
      } else {
        // Unknown path
        client.println("HTTP/1.1 404 Not Found");
        client.println("Connection: close");
        client.println();
      }
    }

    delay(1);
    client.stop();
    Serial.println("Client disconnected");
  }

  // Loop: if track has stopped and not because of pause, restart it
  if (!isPaused && player.readState() == 0) {
    player.start();  // restart same track
  }
}
