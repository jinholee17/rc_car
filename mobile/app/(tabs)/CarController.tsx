import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Slider from '@react-native-community/slider';

// Your Arduino HTTP server
const ARDUINO_IP = '192.168.1.207'; // from Serial
const PORT = 8080;

// Helper: clamp a value to [-max, max]
function clamp(val: number, max: number): number {
  if (val > max) return max;
  if (val < -max) return -max;
  return val;
}

// ---------------- Joystick-based UI ----------------

const JOYSTICK_RADIUS = 80;
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

      // optional: don't spam identical values
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
  const updateFromStick = useCallback(
    (x: number, y: number) => {
      // x,y in [-JOYSTICK_RADIUS, JOYSTICK_RADIUS]
      // Normalize to [-1,1]
      const normX = x / JOYSTICK_RADIUS;
      const normY = y / JOYSTICK_RADIUS;

      // Invert Y so up is positive throttle (like a real joystick)
      const throttle = -normY; // up = 1, down = -1
      const steering = normX;  // right = 1, left = -1

      const newUD = Math.round(throttle * MAX_PWM);
      const newLR = Math.round(steering * MAX_PWM);

      setPwmUD(newUD);
      setPwmLR(newLR);
      // sendControlCommands(newUD, newLR);
    },
    // [sendControlCommands],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          // gestureState.dx/dy: displacement from gesture start
          let { dx, dy } = gestureState;

          // Clamp to circle radius (so knob stays inside)
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > JOYSTICK_RADIUS) {
            const scale = JOYSTICK_RADIUS / distance;
            dx *= scale;
            dy *= scale;
          }

          setStickX(dx);
          setStickY(dy);
          updateFromStick(dx, dy);
        },
        onPanResponderRelease: () => {
          // Snap back to center and send neutral
          // setStickX(0);
          // setStickY(0);
          // setPwmUD(0);
          // setPwmLR(0);
          // sendControlCommands(0, 0);
        },
        onPanResponderTerminate: () => {
          // Also reset if gesture is interrupted
          setStickX(0);
          setStickY(0);
          setPwmUD(0);
          setPwmLR(0);
          // sendControlCommands(0, 0);
        },
      }),
    [updateFromStick],
  );
  useEffect(() => {
    const interval = setInterval(() => {
      // send whatever the current joystick state is
      sendControlCommands(pwmUD, pwmLR);
  }, 100); // 100 ms → 10 times per second

  return () => clearInterval(interval);
}, [pwmUD, pwmLR, sendControlCommands]);


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

        <View style={styles.joystickOuter} {...panResponder.panHandlers}>
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
      </View>

      {/* Optional: max speed limit slider */}
      <View style={styles.extraSection}>
        <Text style={styles.sectionLabel}>Max Power (future tweak?)</Text>
        <Text style={styles.sectionSubLabel}>
          Currently mapped to ±{MAX_PWM}. You can later add a slider to cap this.
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={50}
          maximumValue={255}
          disabled
          value={MAX_PWM}
        />
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
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: JOYSTICK_RADIUS,
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
});
