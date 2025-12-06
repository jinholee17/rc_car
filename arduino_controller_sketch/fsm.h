// fsm.h
#ifndef FSM_H
#define FSM_H

#include "rc_car.h"

full_state updateFSM(full_state currState,
                     int cmdThrottle,
                     int cmdTurn,
                     float distanceCm);

#endif