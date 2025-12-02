#include "SoftwareSerial.h"
#include "DFRobotDFPlayerMini.h"

// pins 2 and 3 to communicate with DFPlayer 
static const uint8_t PIN_MP3_TX = 2; // Arduino to DFPlayer RX
static const uint8_t PIN_MP3_RX = 3; // DFPlayer TX to Arduino
SoftwareSerial softwareSerial(PIN_MP3_RX, PIN_MP3_TX);

// Create player object
DFRobotDFPlayerMini player;

// BUTTONS (add these)
const int BTN_PLAY = 4;   // Play/pause
const int BTN_NEXT = 5;   // Next
const int BTN_PREV = 6;   // Previous

// simple debounce
unsigned long lastPress = 0;
const unsigned long debounceDelay = 250;
bool isPaused = true; 


void setup() {

  Serial.begin(9600);
  softwareSerial.begin(9600);

  // BUTTON INPUTS 
  pinMode(BTN_PLAY, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_PREV, INPUT_PULLUP);

  if (player.begin(softwareSerial)) {
    Serial.println("OK");
    player.volume(30);
    player.pause();      //prevents autoplay
    player.play(1);     // start first track
    player.pause();     // pause 
    isPaused = true;    // confirm pause state
  } 
  else {
    Serial.println("Connecting to DFPlayer failed :(");
  }
}

void loop() {
  unsigned long now = millis();

  //play/pause button 
  if (digitalRead(BTN_PLAY) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;

    if (isPaused) {
      Serial.println("RESUME");
      player.start();   //resume 
      isPaused = false;
    } else {
      Serial.println("PAUSE");
      player.pause();    //paused
      isPaused = true;
    }
  }

  //  next button 
  if (digitalRead(BTN_NEXT) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;
    Serial.println("Next");
    player.next();
    isPaused = false;    //track changed and now playing
  }

  // prev button 
  if (digitalRead(BTN_PREV) == LOW && (now - lastPress > debounceDelay)) {
    lastPress = now;
    Serial.println("Previous");
    player.previous();
    isPaused = false;    //track changed and now playing
  }
  // LOOOp
  // if track has stopped and not bc of paused then restart it for looping
  if (!isPaused && player.readState() == 0) {
    player.start();  // restart same track
  }
}
