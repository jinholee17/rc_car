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

// TODO: adjust to your actual IP / port OR WebSocket bridge
const ARDUINO_IP = '192.168.12.204';
const ARDUINO_PORT = 8080;
const WS_URL = `ws://${ARDUINO_IP}:${ARDUINO_PORT}`;

// ---------------- Connection hook ----------------

type CarConnection = {
  send: (msg: string) => void;
  isConnected: boolean;
  lastError: string | null;
};

function useCarConnection(): CarConnection {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      setLastError(null);
      console.log('Connected to Arduino over WiFi');
    };

    ws.onmessage = (event) => {
      console.log('From Arduino:', event.data);
    };

    ws.onerror = (event) => {
      console.log('WebSocket error', event);
      setLastError('WebSocket error');
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setIsConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback(
    (msg: string) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('Cannot send, socket not open');
        return;
      }
      const toSend = msg.endsWith('\n') ? msg : msg + '\n';
      socket.send(toSend);
      console.log('Sent:', toSend.trim());
    },
    [socket],
  );

  return { send, isConnected, lastError };
}

// ------------- Protocol helpers (same as Python logic) -------------

function buildPWM_UD(value: number): string[] {
  if (value > 0) {
    return [`PWM_UD 3 ${value}`];
  }
  if (value < 0) {
    return [`PWM_UD 6 ${-value}`];
  }
  return ['PWM_UD 6 0', 'PWM_UD 3 0'];
}

function buildPWM_LR(value: number): string[] {
  if (value > 0) {
    return [`PWM_LR 5 ${value}`];
  }
  if (value < 0) {
    return [`PWM_LR 11 ${-value}`];
  }
  return ['PWM_LR 11 0', 'PWM_LR 5 0'];
}

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
  const { send, isConnected, lastError } = useCarConnection();

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
    if (isConnected) return 'Connected';
    if (lastError) return `Disconnected (${lastError})`;
    return 'Connecting...';
  }, [isConnected, lastError]);

  const sendControlCommands = useCallback(
    (ud: number, lr: number) => {
      // Only send when changed a bit (to reduce traffic)
      const changedUD = Math.abs(ud - lastSentUD.current) >= 3;
      const changedLR = Math.abs(lr - lastSentLR.current) >= 3;

      if (changedUD) {
        const udCommands = buildPWM_UD(ud);
        udCommands.forEach((cmd) => send(cmd));
        lastSentUD.current = ud;
      }

      if (changedLR) {
        const lrCommands = buildPWM_LR(lr);
        lrCommands.forEach((cmd) => send(cmd));
        lastSentLR.current = lr;
      }
    },
    [send],
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
      sendControlCommands(newUD, newLR);
    },
    [sendControlCommands],
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
          setStickX(0);
          setStickY(0);
          setPwmUD(0);
          setPwmLR(0);
          sendControlCommands(0, 0);
        },
        onPanResponderTerminate: () => {
          // Also reset if gesture is interrupted
          setStickX(0);
          setStickY(0);
          setPwmUD(0);
          setPwmLR(0);
          sendControlCommands(0, 0);
        },
      }),
    [sendControlCommands, updateFromStick],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RC Car Controller</Text>

      <Text
        style={[
          styles.connectionStatus,
          isConnected ? styles.connected : styles.disconnected,
        ]}
      >
        {connectionLabel}
      </Text>

      {/* Joystick */}
      <View style={styles.joystickSection}>
        <Text style={styles.sectionLabel}>Joystick</Text>
        <Text style={styles.sectionSubLabel}>
          Up/Down = Throttle &nbsp;•&nbsp; Left/Right = Steering
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
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  connected: {
    color: '#4CAF50',
  },
  disconnected: {
    color: '#FF5252',
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
