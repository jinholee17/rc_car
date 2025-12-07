#include <Arduino.h>
#include "rc_car.h"
#include "fsm.h"

#define TESTING   // toggle this on/off as needed

// Prototypes for helpers defined in servo_circuit.ino
int   clampInt(int val, int minVal, int maxVal);
float clampFloat(float val, float minVal, float maxVal);
int   getParamValue(const String &query, const String &name, bool &found);

// --------- CAR FSM TESTING HELPERS ---------

// Inputs to the car FSM for a single step
typedef struct {
  int   cmdThrottle;
  int   cmdTurn;
  float distanceCm;
} car_inputs;

// Simple assert helpers for integer / float tests
bool assertEqualInt(const char* name, int expected, int actual) {
  if (expected == actual) {
    Serial.print("PASSED: ");
    Serial.println(name);
    return true;
  } else {
    Serial.print("FAILED: ");
    Serial.println(name);
    Serial.print("  expected=");
    Serial.print(expected);
    Serial.print(" actual=");
    Serial.println(actual);
    return false;
  }
}

float f_abs(float x) { return (x < 0) ? -x : x; }

bool assertEqualFloat(const char* name, float expected, float actual, float eps = 1e-3f) {
  if (f_abs(expected - actual) <= eps) {
    Serial.print("PASSED: ");
    Serial.println(name);
    return true;
  } else {
    Serial.print("FAILED: ");
    Serial.println(name);
    Serial.print("  expected=");
    Serial.print(expected);
    Serial.print(" actual=");
    Serial.println(actual);
    return false;
  }
}

// Pretty-print FSM state
const char* carStateToStr(fsm_state s) {
  switch (s) {
    case s_IDLE: return "IDLE";
    case s_MOVE: return "MOVE";
    default:     return "UNKNOWN";
  }
}

// Single transition test: start + inputs -> expect end
bool carTestTransition(const char* name,
                       full_state start,
                       car_inputs inputs,
                       int expThrottle,
                       int expTurn,
                       fsm_state expState,
                       bool verbose) {
  full_state res = updateFSM(start,
                             inputs.cmdThrottle,
                             inputs.cmdTurn,
                             inputs.distanceCm);

  bool ok = (res.throttle == expThrottle) &&
            (res.turn     == expTurn) &&
            (res.state    == expState);

  if (!verbose) {
    return ok;
  }

  if (ok) {
    Serial.print("PASSED: ");
    Serial.println(name);
  } else {
    Serial.print("FAILED: ");
    Serial.println(name);

    Serial.print("  start.state = ");
    Serial.println(carStateToStr(start.state));
    Serial.print("  inputs: cmdThrottle=");
    Serial.print(inputs.cmdThrottle);
    Serial.print(", cmdTurn=");
    Serial.print(inputs.cmdTurn);
    Serial.print(", distanceCm=");
    Serial.println(inputs.distanceCm);

    Serial.print("  expected: throttle=");
    Serial.print(expThrottle);
    Serial.print(", turn=");
    Serial.print(expTurn);
    Serial.print(", state=");
    Serial.println(carStateToStr(expState));

    Serial.print("  actual:   throttle=");
    Serial.print(res.throttle);
    Serial.print(", turn=");
    Serial.print(res.turn);
    Serial.print(", state=");
    Serial.println(carStateToStr(res.state));
    Serial.println();
  }
  return ok;
}

bool testClampIntSuite() {
  bool ok = true;
  ok &= assertEqualInt("clampInt below min", 0,   clampInt(-5, 0, 10));
  ok &= assertEqualInt("clampInt above max", 10,  clampInt(20, 0, 10));
  ok &= assertEqualInt("clampInt inside",    5,   clampInt(5, 0, 10));
  ok &= assertEqualInt("clampInt at min",    0,   clampInt(0, 0, 10));
  ok &= assertEqualInt("clampInt at max",    10,  clampInt(10, 0, 10));
  return ok;
}

bool testClampFloatSuite() {
  bool ok = true;
  ok &= assertEqualFloat("clampFloat below min", 0.0f, clampFloat(-1.0f, 0.0f, 1.0f));
  ok &= assertEqualFloat("clampFloat above max", 1.0f, clampFloat(2.5f, 0.0f, 1.0f));
  ok &= assertEqualFloat("clampFloat inside",    0.5f, clampFloat(0.5f, 0.0f, 1.0f));
  ok &= assertEqualFloat("clampFloat at min",    0.0f, clampFloat(0.0f, 0.0f, 1.0f));
  ok &= assertEqualFloat("clampFloat at max",    1.0f, clampFloat(1.0f, 0.0f, 1.0f));
  return ok;
}

bool testGetParamValueSuite() {
  bool ok = true;

  {
    String q = "ud=120&lr=-40";
    bool found = false;
    int v = getParamValue(q, "ud", found);
    if (!(found && v == 120)) {
      Serial.println("FAILED: getParamValue 'ud' middle param");
      ok = false;
    } else {
      Serial.println("PASSED: getParamValue 'ud' middle param");
    }
  }

  {
    String q = "ud=120&lr=-40";
    bool found = false;
    int v = getParamValue(q, "lr", found);
    if (!(found && v == -40)) {
      Serial.println("FAILED: getParamValue 'lr' last param");
      ok = false;
    } else {
      Serial.println("PASSED: getParamValue 'lr' last param");
    }
  }

  {
    String q = "ud=255";
    bool found = false;
    int v = getParamValue(q, "ud", found);
    if (!(found && v == 255)) {
      Serial.println("FAILED: getParamValue single param");
      ok = false;
    } else {
      Serial.println("PASSED: getParamValue single param");
    }
  }

  {
    String q = "ud=120&lr=-40";
    bool found = false;
    int v = getParamValue(q, "speed", found);
    if (found || v != 0) {
      Serial.println("FAILED: getParamValue missing param");
      ok = false;
    } else {
      Serial.println("PASSED: getParamValue missing param");
    }
  }

  return ok;
}

bool testAllCarFSM() {
#ifndef TESTING
  Serial.println("Car FSM tests not compiled. Define TESTING to enable.");
  return false;
#else
  bool allPass = true;

  // Run helper tests first
  Serial.println("Running clampInt tests...");
  if (!testClampIntSuite()) allPass = false;

  Serial.println("Running clampFloat tests...");
  if (!testClampFloatSuite()) allPass = false;

  Serial.println("Running getParamValue tests...");
  if (!testGetParamValueSuite()) allPass = false;

  auto makeIdleState = [](float dist, int throttle, int turn) {
    full_state s{};
    s.distance_from_obstacle = dist;
    s.throttle               = throttle;
    s.turn                   = turn;
    s.state                  = s_IDLE;
    return s;
  };

  auto makeMoveState = [](float dist, int throttle, int turn) {
    full_state s{};
    s.distance_from_obstacle = dist;
    s.throttle               = throttle;
    s.turn                   = turn;
    s.state                  = s_MOVE;
    return s;
  };

  // --- T1: IDLE + no input + safe distance -> stay IDLE, 0,0 ---
  {
    full_state start = makeIdleState(100.0f, 0, 0);
    car_inputs in    = {0, 0, 100.0f};
    if (!carTestTransition("T1: IDLE + no input stays IDLE",
                           start, in, 0, 0, s_IDLE, true)) {
      allPass = false;
    }
  }

  // --- T2: IDLE + forward cmd + safe distance -> MOVE, throttle/turn follow ---
  {
    full_state start = makeIdleState(100.0f, 0, 0);
    car_inputs in    = {100, 20, 100.0f};
    if (!carTestTransition("T2: IDLE + cmd -> MOVE",
                           start, in, 100, 20, s_MOVE, true)) {
      allPass = false;
    }
  }

  // --- T3: IDLE + cmd but obstacle too close -> still IDLE, 0,0 (safety) ---
  {
    full_state start = makeIdleState(10.0f, 0, 0);
    car_inputs in    = {100, 20, 10.0f};
    if (!carTestTransition("T3: IDLE + cmd but obstacle close -> stay IDLE",
                           start, in, 0, 0, s_IDLE, true)) {
      allPass = false;
    }
  }

  // --- T4: MOVE + cmd, obstacle far -> stay MOVE, throttle follows ---
  {
    full_state start = makeMoveState(100.0f, 80, 10);
    car_inputs in    = {120, -30, 100.0f};
    if (!carTestTransition("T4: MOVE + cmd, safe -> MOVE with new throttle/turn",
                           start, in, 120, -30, s_MOVE, true)) {
      allPass = false;
    }
  }

  // --- T5: MOVE + cmd but obstacle too close -> stay MOVE, throttle forced 0 ---
  {
    full_state start = makeMoveState(25.0f, 80, 0);
    car_inputs in    = {120, 0, 15.0f};
    if (!carTestTransition("T5: MOVE + cmd but obstacle close -> MOVE, throttle 0",
                           start, in, 0, 0, s_MOVE, true)) {
      allPass = false;
    }
  }

  // --- T6: MOVE + commands released (within deadzone) -> go back to IDLE ---
  {
    full_state start = makeMoveState(100.0f, 80, 10);
    car_inputs in    = {0, 0, 100.0f};
    if (!carTestTransition("T6: MOVE + inputs near zero -> IDLE",
                           start, in, 0, 0, s_IDLE, true)) {
      allPass = false;
    }
  }

  // --- T7: MOVE + reverse cmd, obstacle close -> keep reversing allowed ---
  {
    full_state start = makeMoveState(10.0f, 0, 0);   // currently near obstacle
    car_inputs in    = {-120, 0, 10.0f};             // reverse while close
    if (!carTestTransition("T7: MOVE + reverse cmd close -> MOVE, reverse allowed",
                           start, in,
                           /*expThrottle*/ -120,
                           /*expTurn*/      0,
                           /*expState*/     s_MOVE,
                           true)) {
      allPass = false;
    }
  }

  // --- T8: Hysteresis step 1: far -> close, forward blocked ---
  {
    // car had been moving forward
    full_state start = makeMoveState(30.0f, 80, 0);
    car_inputs in    = {120, 0, 15.0f};              // tooClose (<= STOP_DISTANCE)
    if (!carTestTransition("T8: MOVE forward -> obstacle close, throttle forced 0",
                           start, in,
                           /*expThrottle*/ 0,
                           /*expTurn*/      0,
                           /*expState*/     s_MOVE,
                           true)) {
      allPass = false;
    }
  }

  // --- T9: Hysteresis step 2: in 20<d<=25 zone, keep blocked (stickiness) ---
  {
    // previous step already blocked throttle
    full_state start = makeMoveState(15.0f, 0, 0);
    car_inputs in    = {120, 0, 22.0f};              // between STOP and RESUME
    if (!carTestTransition("T9: MOVE in hysteresis zone -> throttle stays 0",
                           start, in,
                           /*expThrottle*/ 0,
                           /*expTurn*/      0,
                           /*expState*/     s_MOVE,
                           true)) {
      allPass = false;
    }
  }

  // --- T10: Hysteresis step 3: distance > RESUME, forward allowed again ---
  {
    full_state start = makeMoveState(22.0f, 0, 0);   // was blocked
    car_inputs in    = {120, 0, 30.0f};              // clearAgain (> RESUME_DISTANCE)
    if (!carTestTransition("T10: MOVE, distance>RESUME -> forward allowed again",
                           start, in,
                           /*expThrottle*/ 120,
                           /*expTurn*/      0,
                           /*expState*/     s_MOVE,
                           true)) {
      allPass = false;
    }
  }

  // --- T11: MOVE + throttle released but steering still non-zero -> stay MOVE ---
  {
    full_state start = makeMoveState(100.0f, 80, 0);
    car_inputs in    = {0, 50, 100.0f};              // only steering command
    if (!carTestTransition("T11: MOVE with steering only -> stay MOVE",
                           start, in,
                           /*expThrottle*/ 0,
                           /*expTurn*/      50,
                           /*expState*/     s_MOVE,
                           true)) {
      allPass = false;
    }
  }

  if (allPass) {
    Serial.println("All car FSM tests PASSED!");
  } else {
    Serial.println("Some car FSM tests FAILED.");
  }
  return allPass;
#endif
}