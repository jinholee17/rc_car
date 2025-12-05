// rc_car.h
#ifndef RC_CAR_H
#define RC_CAR_H

typedef enum {
  s_IDLE = 0,
  s_MOVE = 1,
} fsm_state;

typedef struct {
  float distance_from_obstacle;
  int throttle;
  int turn;
  fsm_state state;
} full_state;

#endif