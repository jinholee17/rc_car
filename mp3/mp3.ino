#include <WiFiS3.h>
#include "SoftwareSerial.h"
#include "DFRobotDFPlayerMini.h"

// WiFi credentials
// const char* ssid     = "Anika-iPhone";
// const char* password = "12345678";
const char* ssid     =  "Verizon_FYCW9R"; //"Brown Bear";
const char* password =  "mavis4-dun-fax"; //BbBbWDYS?3";

// pins 2 and 3 to communicate with DFPlayer 
static const uint8_t PIN_MP3_TX = 6; // Arduino → DFPlayer RX
static const uint8_t PIN_MP3_RX = 3; // DFPlayer TX → Arduino
SoftwareSerial softwareSerial(PIN_MP3_RX, PIN_MP3_TX);

// Create player object
DFRobotDFPlayerMini player;

// BUTTONS
const int BTN_PLAY = 4;
const int BTN_NEXT = 5;
const int BTN_PREV = 13;

// WiFi server
WiFiServer server(8080);

// Simple debounce
unsigned long lastPress = 0;
const unsigned long debounceDelay = 250;

bool isPaused = true;
int currentVolume = 15;
int currentTrack = 1;

// Track names (index = track number - 1)
const char* TRACK_NAMES[] = {
  "deep in it by berlioz",
  "I Am in Love by Jennifer Lara",
  "Broccoli by Lil Yachty",
  "Fashion Killa by ASAP ROCKY",
  "Jukebox Joints by ASAP ROCKY",
  "Pyramids by Frank Ocean",
  "Where Are You 54 Ultra"
};

const int MAX_TRACKS = sizeof(TRACK_NAMES) / sizeof(TRACK_NAMES[0]);


// ---------------------------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------------------------
void setup() {
  Serial.begin(9600);
  while (!Serial && millis() < 3000);

  softwareSerial.begin(9600);

  pinMode(BTN_PLAY, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_PREV, INPUT_PULLUP);

  Serial.println("Initializing DFPlayer...");
  if (player.begin(softwareSerial)) {
    Serial.println("DFPlayer OK");
    player.volume(currentVolume);
    player.pause();
    player.play(1);
    currentTrack = 1;
    player.pause();
    isPaused = true;
  } else {
    Serial.println("DFPlayer FAILED to init.");
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts++ < 60) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi FAILED — buttons still work.");
  }

  server.begin();
  Serial.println("HTTP server listening on :8080");
}


// ---------------------------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------------------------
String getParamValue(const String &query, const String &name) {
  int idx = query.indexOf(name + "=");
  if (idx == -1) return "";
  int start = idx + name.length() + 1;
  int end = query.indexOf('&', start);
  if (end == -1) end = query.length();
  return query.substring(start, end);
}


// ---------------------------------------------------------------------------------------------
// AUDIO CONTROL
// ---------------------------------------------------------------------------------------------
void syncTrackWithDFPlayer() {
  int actual = player.readCurrentFileNumber();
  if (actual > 0 && actual <= MAX_TRACKS) {
    currentTrack = actual;
  }
}

void handlePlayPause() {
  if (isPaused) {
    Serial.println("[MP3] RESUME");
    player.start();
    isPaused = false;
  } else {
    Serial.println("[MP3] PAUSE");
    player.pause();
    isPaused = true;
  }

  delay(120);
  syncTrackWithDFPlayer();
}

void handleNext() {
  Serial.println("[MP3] NEXT");
  player.next();
  isPaused = false;
  delay(150);
  syncTrackWithDFPlayer();
  Serial.print("→ Now track ");
  Serial.println(currentTrack);
}

void handlePrevious() {
  Serial.println("[MP3] PREV");
  player.previous();
  isPaused = false;
  delay(150);
  syncTrackWithDFPlayer();
  Serial.print("→ Now track ");
  Serial.println(currentTrack);
}

void handleVolume(int v) {
  v = constrain(v, 0, 30);
  currentVolume = v;
  player.volume(v);
}


// ---------------------------------------------------------------------------------------------
// HANDLE /mp3/status (THIS FIXES YOUR MOBILE APP)
// ---------------------------------------------------------------------------------------------
void sendStatus(WiFiClient &client) {
  syncTrackWithDFPlayer();   // ← ALWAYS SYNC. This was your missing fix.

  const char* name = "Unknown";
  if (currentTrack >= 1 && currentTrack <= MAX_TRACKS) {
    name = TRACK_NAMES[currentTrack - 1];
  }

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
  client.print(name);
  client.print("\",\"maxTracks\":");
  client.print(MAX_TRACKS);
  client.println("}");
}


// ---------------------------------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------------------------------
void loop() {
  unsigned long now = millis();

  // BUTTON HANDLING
  if (now - lastPress > debounceDelay) {
    if (digitalRead(BTN_PLAY) == LOW) { lastPress = now; handlePlayPause(); }
    if (digitalRead(BTN_NEXT) == LOW) { lastPress = now; handleNext(); }
    if (digitalRead(BTN_PREV) == LOW) { lastPress = now; handlePrevious(); }
  }

  // HTTP REQUEST HANDLING
  WiFiClient client = server.available();
  if (!client) return;

  String line = client.readStringUntil('\r');
  while (client.available()) client.read(); // clear headers

  int start = line.indexOf("GET ");
  int end   = line.indexOf(" HTTP/");
  if (start == -1 || end == -1) return;

  String path = line.substring(start + 4, end);

  // Route: /mp3/status
  if (path.startsWith("/mp3/status")) {
    sendStatus(client);
    client.stop();
    return;
  }

  // Route: /mp3?cmd=...
  if (path.startsWith("/mp3")) {
    int q = path.indexOf('?');
    String query = (q != -1 ? path.substring(q + 1) : "");

    String cmd = getParamValue(query, "cmd");
    String vol = getParamValue(query, "volume");
    String track = getParamValue(query, "track");

    if (track != "") {
      int t = track.toInt();
      if (t >= 1 && t <= MAX_TRACKS) {
        Serial.print("[MP3] Play track ");
        Serial.println(t);
        player.play(t);
        isPaused = false;
        currentTrack = t;
        delay(150);
        syncTrackWithDFPlayer();
      }
    } 
    else if (vol != "") {
      handleVolume(vol.toInt());
    } 
    else if (cmd == "next") {
      handleNext();
    } 
    else if (cmd == "previous") {
      handlePrevious();
    } 
    else if (cmd == "play" || cmd == "pause") {
      handlePlayPause();
    }

    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: text/plain");
    client.println("Connection: close");
    client.println();
    client.println("OK");
    client.stop();
    return;
  }

  // 404
  client.println("HTTP/1.1 404 Not Found");
  client.println("Connection: close");
  client.println();
  client.stop();
}
