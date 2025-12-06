// #include "rc_car.h"
// #include "fsm.h"
// // --------- CAR FSM TESTING HELPERS ---------

// // Inputs to the car FSM for a single step
// typedef struct {
//   int   cmdThrottle;
//   int   cmdTurn;
//   float distanceCm;
// } car_inputs;

// // Pretty-print FSM state
// const char* carStateToStr(fsm_state s) {
//   switch (s) {
//     case s_IDLE: return "IDLE";
//     case s_MOVE: return "MOVE";
//     default:     return "UNKNOWN";
//   }
// }

// // Single transition test: start + inputs -> expect end
// bool carTestTransition(const char* name,
//                        full_state start,
//                        car_inputs inputs,
//                        int expThrottle,
//                        int expTurn,
//                        fsm_state expState,
//                        bool verbose) {
//   full_state res = updateFSM(start,
//                              inputs.cmdThrottle,
//                              inputs.cmdTurn,
//                              inputs.distanceCm);

//   bool ok = (res.throttle == expThrottle) &&
//             (res.turn     == expTurn) &&
//             (res.state    == expState);

//   if (!verbose) {
//     return ok;
//   }

//   if (ok) {
//     Serial.print("PASSED: ");
//     Serial.println(name);
//   } else {
//     Serial.print("FAILED: ");
//     Serial.println(name);

//     Serial.print("  start.state = ");
//     Serial.println(carStateToStr(start.state));
//     Serial.print("  inputs: cmdThrottle=");
//     Serial.print(inputs.cmdThrottle);
//     Serial.print(", cmdTurn=");
//     Serial.print(inputs.cmdTurn);
//     Serial.print(", distanceCm=");
//     Serial.println(inputs.distanceCm);

//     Serial.print("  expected: throttle=");
//     Serial.print(expThrottle);
//     Serial.print(", turn=");
//     Serial.print(expTurn);
//     Serial.print(", state=");
//     Serial.println(carStateToStr(expState));

//     Serial.print("  actual:   throttle=");
//     Serial.print(res.throttle);
//     Serial.print(", turn=");
//     Serial.print(res.turn);
//     Serial.print(", state=");
//     Serial.println(carStateToStr(res.state));
//     Serial.println();
//   }
//   return ok;
// }

// bool testAllCarFSM() {
// #ifndef TESTING
//   Serial.println("Car FSM tests not compiled. Define TESTING to enable.");
//   return false;
// #else
//   bool allPass = true;

//   // Convenience lambdas to make states and inputs
//   auto makeIdleState = [](float dist, int throttle, int turn) {
//     full_state s{};
//     s.distance_from_obstacle = dist;
//     s.throttle               = throttle;
//     s.turn                   = turn;
//     s.state                  = s_IDLE;
//     return s;
//   };

//   auto makeMoveState = [](float dist, int throttle, int turn) {
//     full_state s{};
//     s.distance_from_obstacle = dist;
//     s.throttle               = throttle;
//     s.turn                   = turn;
//     s.state                  = s_MOVE;
//     return s;
//   };

//   // --- T1: IDLE + no input + safe distance -> stay IDLE, 0,0 ---
//   {
//     full_state start = makeIdleState(100.0f, 0, 0);
//     car_inputs in    = {0, 0, 100.0f};
//     if (!carTestTransition("T1: IDLE + no input stays IDLE",
//                            start, in,
//                            /*expThrottle*/ 0,
//                            /*expTurn*/     0,
//                            /*expState*/    s_IDLE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   // --- T2: IDLE + forward cmd + safe distance -> MOVE, throttle/turn follow ---
//   {
//     full_state start = makeIdleState(100.0f, 0, 0);
//     car_inputs in    = {100, 20, 100.0f};  // above deadzones, distance > STOP_DISTANCE (20)
//     if (!carTestTransition("T2: IDLE + cmd -> MOVE",
//                            start, in,
//                            /*expThrottle*/ 100,
//                            /*expTurn*/     20,
//                            /*expState*/    s_MOVE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   // --- T3: IDLE + cmd but obstacle too close -> still IDLE, 0,0 (safety) ---
//   {
//     full_state start = makeIdleState(10.0f, 0, 0); // already close
//     car_inputs in    = {100, 20, 10.0f};          // distance <= STOP_DISTANCE
//     if (!carTestTransition("T3: IDLE + cmd but obstacle close -> stay IDLE",
//                            start, in,
//                            /*expThrottle*/ 0,
//                            /*expTurn*/     0,
//                            /*expState*/    s_IDLE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   // --- T4: MOVE + cmd, obstacle far -> stay MOVE, throttle follows ---
//   {
//     full_state start = makeMoveState(100.0f, 80, 10);
//     car_inputs in    = {120, -30, 100.0f}; // safe distance
//     if (!carTestTransition("T4: MOVE + cmd, safe -> MOVE with new throttle/turn",
//                            start, in,
//                            /*expThrottle*/ 120,
//                            /*expTurn*/     -30,
//                            /*expState*/    s_MOVE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   // --- T5: MOVE + cmd but obstacle too close -> stay MOVE, throttle forced 0 ---
//   {
//     full_state start = makeMoveState(25.0f, 80, 0);
//     car_inputs in    = {120, 0, 15.0f}; // distance <= STOP_DISTANCE
//     if (!carTestTransition("T5: MOVE + cmd but obstacle close -> MOVE, throttle 0",
//                            start, in,
//                            /*expThrottle*/ 0,
//                            /*expTurn*/     0,   // cmdTurn=0 in this test
//                            /*expState*/    s_MOVE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   // --- T6: MOVE + commands released (within deadzone) -> go back to IDLE ---
//   {
//     full_state start = makeMoveState(100.0f, 80, 10);
//     car_inputs in    = {0, 0, 100.0f}; // both below deadzones
//     if (!carTestTransition("T6: MOVE + inputs near zero -> IDLE",
//                            start, in,
//                            /*expThrottle*/ 0,
//                            /*expTurn*/     0,
//                            /*expState*/    s_IDLE,
//                            true)) {
//       allPass = false;
//     }
//   }

//   if (allPass) {
//     Serial.println("All car FSM tests PASSED!");
//   } else {
//     Serial.println("Some car FSM tests FAILED.");
//   }
//   return allPass;
// #endif // TESTING
// }