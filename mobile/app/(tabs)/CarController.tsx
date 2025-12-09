import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  TouchableOpacity,
} from 'react-native';
import Slider from '@react-native-community/slider';

// Your Arduino HTTP server
const ARDUINO_IP = '192.168.1.18';
const PORT = 8080;

// Helper: clamp a value to [-max, max]
function clamp(val: number, max: number): number {
  if (val > max) return max;
  if (val < -max) return -max;
  return val;
}

// ---------------- Joystick-based UI ----------------

// We'll now treat this as HALF the width/height of the square
const JOYSTICK_HALF_SIZE = 80;
const KNOB_RADIUS = 28;
const MAX_PWM = 255;

const CarController: React.FC = () => {
  // Joystick state: offset from center in px
  const [stickX, setStickX] = useState(0);
  const [stickY, setStickY] = useState(0);

  // Derived PWM values (for display + sending)
  const [pwmUD, setPwmUD] = useState(0); // throttle (forward/back)
  const [pwmLR, setPwmLR] = useState(0); // steering (left/right)

  // Keep the last sent values to avoid spamming identical commands
  const lastSentUD = useRef<number>(0);
  const lastSentLR = useRef<number>(0);

  const connectionLabel = useMemo(() => {
    return `Sending commands via HTTP to http://${ARDUINO_IP}:${PORT}/drive`;
  }, []);

  // Send HTTP request to Arduino /drive endpoint
  const sendControlCommands = useCallback(
    async (ud: number, lr: number) => {
      const udClamped = clamp(ud, MAX_PWM);
      const lrClamped = clamp(lr, MAX_PWM);

      // optional: don't spam very small changes
      if (
        Math.abs(udClamped - lastSentUD.current) < 3 &&
        Math.abs(lrClamped - lastSentLR.current) < 3
      ) {
        return;
      }

      lastSentUD.current = udClamped;
      lastSentLR.current = lrClamped;

      const url = `http://${ARDUINO_IP}:${PORT}/drive?ud=${udClamped}&lr=${lrClamped}`;
      try {
        await fetch(url);
      } catch (e) {
        console.log('Error sending drive command:', e);
      }
    },
    [],
  );

  // Map joystick position → PWM values
  const updateFromStick = useCallback((x: number, y: number) => {
    // x,y in [-JOYSTICK_HALF_SIZE, JOYSTICK_HALF_SIZE]
    // Normalize to [-1,1]
    const normX = x / JOYSTICK_HALF_SIZE;
    const normY = y / JOYSTICK_HALF_SIZE;

    // Invert Y so up is positive throttle (like a real joystick)
    const throttle = -normY; // up = 1, down = -1
    const steering = normX;  // right = 1, left = -1

    const newUD = Math.round(throttle * MAX_PWM);
    const newLR = Math.round(steering * MAX_PWM);

    setPwmUD(newUD);
    setPwmLR(newLR);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => {
          let { dx, dy } = gestureState;

          // Square clamp instead of circular:
          // Keep dx, dy within [-JOYSTICK_HALF_SIZE, JOYSTICK_HALF_SIZE]
          dx = Math.max(-JOYSTICK_HALF_SIZE, Math.min(JOYSTICK_HALF_SIZE, dx));
          dy = Math.max(-JOYSTICK_HALF_SIZE, Math.min(JOYSTICK_HALF_SIZE, dy));

          setStickX(dx);
          setStickY(dy);
          updateFromStick(dx, dy);
        },
        onPanResponderRelease: () => {
          // don't auto-reset; user can hit STOP
        },
        onPanResponderTerminate: () => {
          // if gesture is interrupted, snap to center but don't send yet
          setStickX(0);
          setStickY(0);
          setPwmUD(0);
          setPwmLR(0);
        },
      }),
    [updateFromStick],
  );

  // Periodically send the current joystick state
  useEffect(() => {
    const interval = setInterval(() => {
      sendControlCommands(pwmUD, pwmLR);
    }, 100); // 100 ms → 10 times per second

    return () => clearInterval(interval);
  }, [pwmUD, pwmLR, sendControlCommands]);

  // --- STOP button handler: reset to neutral and send 0,0 immediately ---
  const handleStop = useCallback(() => {
    setStickX(0);
    setStickY(0);
    setPwmUD(0);
    setPwmLR(0);
    // send immediate stop command
    sendControlCommands(0, 0);
  }, [sendControlCommands]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RC Car Controller</Text>

      <Text style={[styles.connectionStatus, styles.connected]}>
        {connectionLabel}
      </Text>

      {/* Joystick */}
      <View style={styles.joystickSection}>
        <Text style={styles.sectionLabel}>Joystick</Text>
        <Text style={styles.sectionSubLabel}>
          Up/Down = Throttle • Left/Right = Steering
        </Text>

        {/* Square joystick area */}
        <View style={styles.joystickOuter} 
        testID="joystick-area"
        {...panResponder.panHandlers}>
          {/* Crosshair lines */}
          <View style={styles.joystickVerticalLine} />
          <View style={styles.joystickHorizontalLine} />

          {/* Knob */}
          <View
            style={[
              styles.joystickKnob,
              {
                transform: [
                  { translateX: stickX },
                  { translateY: stickY },
                ],
              },
            ]}
          />
        </View>

        <View style={styles.valuesRow}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Throttle (PWM_UD)</Text>
            <Text style={styles.valueText}>{pwmUD}</Text>
          </View>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Steering (PWM_LR)</Text>
            <Text style={styles.valueText}>{pwmLR}</Text>
          </View>
        </View>

        {/* STOP button */}
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>STOP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CarController;

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    backgroundColor: '#020617',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 10,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  connectionStatus: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  connected: {
    color: '#9CA3AF',
  },
  joystickSection: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  sectionSubLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  joystickOuter: {
    width: JOYSTICK_HALF_SIZE * 2,
    height: JOYSTICK_HALF_SIZE * 2,
    borderRadius: 12, // small rounding, still visually square-ish
    borderWidth: 2,
    borderColor: '#1E293B',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  joystickVerticalLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#111827',
  },
  joystickHorizontalLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    backgroundColor: '#111827',
  },
  joystickKnob: {
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: KNOB_RADIUS,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#15803D',
  },
  valuesRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  valueBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#020617',
  },
  valueLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  extraSection: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#020617',
  },
  slider: {
    width: '100%',
    height: 36,
    marginTop: 8,
  },
  stopButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#DC2626',
  },
  stopButtonText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 16,
  },
});
