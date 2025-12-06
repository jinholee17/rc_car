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
  const float STOP_DISTANCE   = 20.0f; // stop if closer than this
  const float RESUME_DISTANCE = 25.0f; // only resume if farther than this

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

    case s_MOVE: {
      bool wantsForward = (cmdThrottle > THROTTLE_DEADZONE);
      bool tooClose     = (distanceCm <= STOP_DISTANCE);
      bool clearAgain   = (distanceCm > RESUME_DISTANCE);

      // Forward safety
      if (wantsForward && tooClose) {
        // block forward
        next.throttle = 0;
      } else if (wantsForward && clearAgain) {
        // only allow forward if we are clearly far enough
        next.throttle = cmdThrottle;
      } else if (!wantsForward) {
        // user is not pushing forward → let them brake / reverse naturally
        next.throttle = cmdThrottle;
      } else {
        // in-between zone (20 < d <= 25) + wantsForward:
        // keep whatever we were already doing (stickiness)
        next.throttle = currState.throttle;
      }

      next.turn = cmdTurn;

      // If user lets go of controls, go back to IDLE
      if (abs(cmdThrottle) <= THROTTLE_DEADZONE &&
          abs(cmdTurn)     <= TURN_DEADZONE) {
        next.throttle = 0;
        next.turn     = 0;
        next.state    = s_IDLE;
      }
      break;
  }
  }
  return next;

}