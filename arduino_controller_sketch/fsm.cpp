// fsm.cpp
#include <Arduino.h>   // for abs()
#include "fsm.h"

full_state updateFSM(full_state currState,
                     int cmdThrottle,
                     int cmdTurn,
                     float distanceCm) {
  full_state next = currState;

  // Update measured distance in state
  next.distance_from_obstacle = distanceCm;

  const int   THROTTLE_DEADZONE = 10;
  const int   TURN_DEADZONE     = 10;
  const float STOP_DISTANCE     = 20.0f;

  switch (currState.state) {
    case s_IDLE:
      next.throttle = 0;
      next.turn     = 0;

      if ((abs(cmdThrottle) > THROTTLE_DEADZONE ||
           abs(cmdTurn) > TURN_DEADZONE) &&
          distanceCm > STOP_DISTANCE) {
        next.throttle = cmdThrottle;
        next.turn     = cmdTurn;
        next.state    = s_MOVE;
      }
      break;

    case s_MOVE:
      if (distanceCm <= STOP_DISTANCE) {
        next.throttle = 0;
      } else {
        next.throttle = cmdThrottle;
      }

      next.turn = cmdTurn;

      if (abs(cmdThrottle) <= THROTTLE_DEADZONE &&
          abs(cmdTurn)     <= TURN_DEADZONE) {
        next.throttle = 0;
        next.turn     = 0;
        next.state    = s_IDLE;
      }
      break;
  }

  return next;
}