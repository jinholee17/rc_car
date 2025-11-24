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