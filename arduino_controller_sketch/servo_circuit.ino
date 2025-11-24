#include <Servo.h>

Servo myservo;
int targetAngle = 0;  // default starting angle

void setup() {
  myservo.attach(9);
  Serial.begin(9600);
  Serial.println("Enter servo angle (-90 to 90):");
}

void loop() {

  if (Serial.available() > 0) {
    int entered = Serial.parseInt(); 

    if (entered >= -90 && entered <= 90) {
      targetAngle = entered;
      Serial.print("Moving to angle: ");
      Serial.println(targetAngle + 90);
      myservo.write(targetAngle + 90);
    }

    // Clear leftover characters (like newline)
    while (Serial.available()) Serial.read();
  }

}
