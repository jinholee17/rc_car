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
int currentTrack = 1; // Track current playing track number

// Track names - matches your MP3 filenames (without .mp3 extension)
// Order matches the actual track order on your SD card
const char* TRACK_NAMES[] = {
  "deep in it by berlioz",            // Track 1
  "I Am in Love by Jennifer Lara",    // Track 2
  "Broccoli by Lil Yachty",           // Track 3
  "We Found Love by Rihanna",         // Track 4
  "Jukebox Joints by ASAP ROCKY",     // Track 5
  "Fashion Killa by ASAP ROCKY",      // Track 6
  "Pyramids by Frank Ocean",          // Track 7
  "Where Are You 54 Ultra",           // Track 8
};
 
const int MAX_TRACKS = sizeof(TRACK_NAMES) / sizeof(TRACK_NAMES[0]); 


void setup() {
  // Start serial communication
  Serial.begin(9600);
  // Wait for serial port to be ready (important for some boards)
  while (!Serial && millis() < 3000) {
    ; // wait for serial port to connect, timeout after 3 seconds
  }
  delay(1000); // Give serial monitor time to connect
  
  Serial.println("\n\n=== MP3 Player Starting ===");
  Serial.println("Serial communication initialized");
  
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
    currentTrack = 1;   // Set initial track
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
    Serial.println("\nWiFi connection failed!");
    Serial.print("Status code: ");
    int status = WiFi.status();
    Serial.println(status);
    
    // Decode status code
    if (status == 1) {
      Serial.println("WL_IDLE_STATUS: WiFi is in idle mode");
    } else if (status == 2) {
      Serial.println("WL_NO_SSID_AVAIL: Network name not found!");
      Serial.println("This means the network \"Anika-iPhone\" is not visible.");
    } else if (status == 3) {
      Serial.println("WL_SCAN_COMPLETED: Scan completed");
    } else if (status == 4) {
      Serial.println("WL_CONNECTED: Connected (shouldn't see this)");
    } else if (status == 5) {
      Serial.println("WL_CONNECT_FAILED: Connection failed");
    } else if (status == 6) {
      Serial.println("WL_CONNECTION_LOST: Connection lost");
    } else if (status == 7) {
      Serial.println("WL_DISCONNECTED: Disconnected");
    }
    
    Serial.println("\nTroubleshooting steps:");
    Serial.print("1. Network name (case-sensitive): \"");
    Serial.print(ssid);
    Serial.println("\"");
    Serial.println("2. For iPhone hotspot:");
    Serial.println("   - Go to Settings > Personal Hotspot");
    Serial.println("   - Turn ON 'Allow Others to Join'");
    Serial.println("   - Enable 'Maximize Compatibility' (important!)");
    Serial.println("   - Keep phone unlocked and nearby");
    Serial.println("   - Check the exact network name matches");
    Serial.println("3. Try restarting the hotspot");
    Serial.println("4. Make sure no other device is using the hotspot");
    
    if (!foundNetwork) {
      Serial.println("\n⚠️  WARNING: Target network \"Anika-iPhone\" NOT found in scan!");
      Serial.println("   This means the hotspot is not visible to Arduino.");
      Serial.println("   Solutions:");
      Serial.println("   1. Enable 'Maximize Compatibility' in iPhone hotspot settings");
      Serial.println("   2. Restart the hotspot");
      Serial.println("   3. Check network name matches exactly (case-sensitive)");
      Serial.println("   4. Keep phone unlocked and within range");
    } else {
      Serial.println("\n✓ Network found in scan, but connection failed.");
      Serial.println("   Check password and try again.");
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
    Serial.println("[MP3] RESUME");
    player.start();
    isPaused = false;
    // Don't read from DFPlayer when resuming - keep current track
  } else {
    Serial.println("[MP3] PAUSE");
    player.pause();
    isPaused = true;
    // When pausing, we can safely read from DFPlayer to sync
    delay(100);
    int actualTrack = player.readCurrentFileNumber();
    if (actualTrack > 0 && actualTrack <= MAX_TRACKS) {
      currentTrack = actualTrack;
      Serial.print("[MP3] Synced track on pause: ");
      Serial.println(currentTrack);
    }
  }
}

void handleNext() {
  Serial.println("[MP3] Next track");
  player.next();
  isPaused = false;
  // Read actual track number from DFPlayer after a short delay
  delay(150); // Small delay to let DFPlayer update
  int actualTrack = player.readCurrentFileNumber();
  if (actualTrack > 0 && actualTrack <= MAX_TRACKS) {
    currentTrack = actualTrack;
    Serial.print("[MP3] Now on track: ");
    Serial.println(currentTrack);
  } else if (actualTrack > MAX_TRACKS) {
    // If track number exceeds max, it might have looped
    currentTrack = 1;
  } else {
    // Fallback: increment if read fails
    currentTrack++;
    if (currentTrack > MAX_TRACKS) {
      currentTrack = 1; // Loop back to start
    }
  }
}

void handlePrevious() {
  Serial.println("[MP3] Previous track");
  player.previous();
  isPaused = false;
  // Read actual track number from DFPlayer after a short delay
  delay(150); // Small delay to let DFPlayer update
  int actualTrack = player.readCurrentFileNumber();
  if (actualTrack > 0 && actualTrack <= MAX_TRACKS) {
    currentTrack = actualTrack;
    Serial.print("[MP3] Now on track: ");
    Serial.println(currentTrack);
  } else if (actualTrack == 0 || actualTrack > MAX_TRACKS) {
    // If at start or exceeded, might have looped to end
    currentTrack = MAX_TRACKS;
  } else {
    // Fallback: decrement if read fails
    currentTrack--;
    if (currentTrack < 1) {
      currentTrack = MAX_TRACKS; // Loop to end
    }
  }
}

void handleVolume(int volume) {
  // Clamp volume to 0-30 range
  if (volume < 0) volume = 0;
  if (volume > 30) volume = 30;
  
  currentVolume = volume;
  player.volume(volume);
  Serial.print("[MP3] Volume set to: ");
  Serial.println(volume);
}

void loop() {
  unsigned long now = millis();

  // Check physical buttons (with debounce)
  if (now - lastPress > debounceDelay) {
    if (digitalRead(BTN_PLAY) == LOW) {
      lastPress = now;
      handlePlayPause(); // Toggle play/pause
    }
    if (digitalRead(BTN_NEXT) == LOW) {
      lastPress = now;
      handleNext();
    }
    if (digitalRead(BTN_PREV) == LOW) {
      lastPress = now;
      handlePrevious();
    }
  }

  // Handle HTTP requests from mobile app
  WiFiClient client = server.available();
  if (client) {
    String requestLine = client.readStringUntil('\r');
    String pathAndQuery = "";

    // Clear the rest of the HTTP headers
    while (client.available()) {
      client.read();
    }

    // Parse path and query
    int getIndex = requestLine.indexOf("GET ");
    int httpIndex = requestLine.indexOf(" HTTP/");
    if (getIndex != -1 && httpIndex != -1) {
      pathAndQuery = requestLine.substring(getIndex + 4, httpIndex);

      // Check if it's an MP3 command
      if (pathAndQuery.startsWith("/mp3")) {
        // Check for status endpoint (exact match or starts with /mp3/status)
        if (pathAndQuery == "/mp3/status" || pathAndQuery.startsWith("/mp3/status?")) {
          // Only try to read from DFPlayer when paused - when playing, readCurrentFileNumber() is unreliable
          // Trust our maintained currentTrack variable when playing
          if (isPaused) {
            // When paused, we can safely read from DFPlayer
            int actualTrack = player.readCurrentFileNumber();
            if (actualTrack > 0 && actualTrack <= MAX_TRACKS) {
              currentTrack = actualTrack; // Update if we get a valid track number
              Serial.print("[Status] Updated track from DFPlayer (paused): ");
              Serial.println(currentTrack);
            }
            // If actualTrack is 0 or invalid, keep the current currentTrack value
          } else {
            // When playing, just use our currentTrack variable (don't read from DFPlayer)
            Serial.print("[Status] Using maintained track (playing): ");
            Serial.println(currentTrack);
          }
          
          // Get track name
          const char* trackName = "Unknown";
          if (currentTrack >= 1 && currentTrack <= MAX_TRACKS) {
            trackName = TRACK_NAMES[currentTrack - 1]; // Array is 0-indexed
          }
          
          // Return current state as JSON
          client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: application/json");
          client.println("Connection: close");
          client.println();
          client.print("{\"isPlaying\":");
          client.print(isPaused ? "false" : "true");
          client.print(",\"volume\":");
          client.print(currentVolume);
          client.print(",\"currentTrack\":");
          client.print(currentTrack);
          client.print(",\"trackName\":\"");
          client.print(trackName);
          client.print("\",\"maxTracks\":");
          client.print(MAX_TRACKS);
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
          String trackStr = getParamValue(query, "track");

          // Handle play specific track command
          if (trackStr != "") {
            int trackNum = trackStr.toInt();
            if (trackNum >= 1 && trackNum <= MAX_TRACKS) {
              Serial.print("[MP3] Play track: ");
              Serial.println(trackNum);
              player.play(trackNum);
              currentTrack = trackNum; // Set track immediately - trust this value
              isPaused = false;
              // Don't try to verify with readCurrentFileNumber() - it's unreliable while playing
              // and we know exactly which track we're playing
              Serial.print("[MP3] Set currentTrack to: ");
              Serial.println(currentTrack);
              // Send response
              client.println("HTTP/1.1 200 OK");
              client.println("Content-Type: text/plain");
              client.println("Connection: close");
              client.println();
              client.println("OK");
            } else {
              client.println("HTTP/1.1 400 Bad Request");
              client.println("Content-Type: text/plain");
              client.println("Connection: close");
              client.println();
              client.println("Invalid track number");
            }
          }
          // Handle volume command
          else if (volumeStr != "") {
            int volume = volumeStr.toInt();
            handleVolume(volume);
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("OK");
          } else if (cmd == "play" || cmd == "Play" || cmd == "PLAY") {
            handlePlayPause();
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("OK");
          } else if (cmd == "pause" || cmd == "Pause" || cmd == "PAUSE") {
            handlePlayPause(); // Toggle play/pause
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("OK");
          } else if (cmd == "next" || cmd == "Next" || cmd == "NEXT") {
            handleNext();
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("OK");
          } else if (cmd == "previous" || cmd == "Previous" || cmd == "PREVIOUS") {
            handlePrevious();
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("OK");
          } else {
            client.println("HTTP/1.1 400 Bad Request");
            client.println("Content-Type: text/plain");
            client.println("Connection: close");
            client.println();
            client.println("Unknown command");
          }
        }
      } else {
        client.println("HTTP/1.1 404 Not Found");
        client.println("Connection: close");
        client.println();
      }
    }
    delay(1);
    client.stop();
    if (pathAndQuery.length() > 0 && !pathAndQuery.startsWith("/mp3/status")) {
      Serial.print("[HTTP] Request: ");
      Serial.println(requestLine);
    }
  }
  
  // Keep player playing if not paused
  if (!isPaused && player.readState() == 0) {
    player.start();
  }
}
