// // test_servo_circuit.cpp

// #include <AUnit.h>
// #include <Arduino.h>

// // Forward declarations of functions from servo_circuit.ino
// int clamp(int val, int minVal, int maxVal);
// int getParamValue(const String &query, const String &name, bool &found);
// int steeringAngleFromLR(int lr);  // you’ll add this helper to the sketch

// // ---------- Tests for clamp() ----------

// test(clamp_below_min_returns_min) {
//   assertEqual(clamp(-10, 0, 100), 0);
// }

// test(clamp_above_max_returns_max) {
//   assertEqual(clamp(150, 0, 100), 100);
// }

// test(clamp_inside_range_returns_same) {
//   assertEqual(clamp(42, 0, 100), 42);
// }

// // ---------- Tests for getParamValue() ----------

// test(getParamValue_middle_param) {
//   String query = "ud=120&lr=-40";
//   bool found = false;
//   int value = getParamValue(query, "ud", found);

//   assertTrue(found);
//   assertEqual(value, 120);
// }

// test(getParamValue_last_param_no_trailing_ampersand) {
//   String query = "ud=120&lr=-40";
//   bool found = false;
//   int value = getParamValue(query, "lr", found);

//   assertTrue(found);
//   assertEqual(value, -40);
// }

// test(getParamValue_missing_param) {
//   String query = "ud=120&lr=-40";
//   bool found = false;
//   int value = getParamValue(query, "speed", found);

//   assertFalse(found);
//   assertEqual(value, 0);   // Function returns 0 when missing
// }

// test(getParamValue_single_param_string) {
//   String query = "ud=255";
//   bool found = false;
//   int value = getParamValue(query, "ud", found);

//   assertTrue(found);
//   assertEqual(value, 255);
// }

// // ---------- Tests for steeringAngleFromLR() ----------

// test(steering_center_when_lr_zero) {
//   int angle = steeringAngleFromLR(0);
//   assertEqual(angle, 90);  // center
// }

// test(steering_full_right_when_lr_max) {
//   int angle = steeringAngleFromLR(255);
//   assertEqual(angle, 180);  // full right
// }

// test(steering_full_left_when_lr_min) {
//   int angle = steeringAngleFromLR(-255);
//   assertEqual(angle, 0);    // full left
// }

// test(steering_clamps_above_max) {
//   int angle = steeringAngleFromLR(999);  // should be clamped to 255
//   assertEqual(angle, 180);
// }

// test(steering_clamps_below_min) {
//   int angle = steeringAngleFromLR(-999); // should be clamped to -255
//   assertEqual(angle, 0);
// }

// // ---------- Test runner ----------

// void setup() {
//   Serial.begin(9600);
//   while (!Serial) { ; }   // wait for Serial if needed
//   aunit::TestRunner::run();
// }

// void loop() {
//   // AUnit uses loop() to run tests; leave empty
// }