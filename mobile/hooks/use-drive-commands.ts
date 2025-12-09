import { useCallback, useRef } from 'react';

const ARDUINO_IP = '192.168.1.18';
const PORT = 8080;
const MAX_PWM = 255;

// Helper: clamp a value to [-max, max]
function clamp(val: number, max: number): number {
  if (val > max) return max;
  if (val < -max) return -max;
  return val;
}

export const useDriveCommands = () => {
  const lastSentUD = useRef<number>(0);
  const lastSentLR = useRef<number>(0);

  const sendDriveCommand = useCallback(
    async (ud: number, lr: number, forceUpdate = false) => {
      const udClamped = clamp(ud, MAX_PWM);
      const lrClamped = clamp(lr, MAX_PWM);

      // Don't spam very small changes unless forced
      if (
        !forceUpdate &&
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
    []
  );

  // Helper to convert angle + drive boolean to PWM values
  const sendFollowCommand = useCallback(
    (turnAngle: number, shouldDrive: boolean) => {
      // Convert turn angle (-45 to 45) to steering PWM (-255 to 255)
      const steeringPWM = Math.round((turnAngle / 45) * MAX_PWM);
      
      // Set throttle: forward if should drive, else stop
      const throttlePWM = shouldDrive ? 185 : 0; // Adjust speed as needed
      
      sendDriveCommand(throttlePWM, steeringPWM);
    },
    [sendDriveCommand]
  );

  const stopCar = useCallback(() => {
    sendDriveCommand(0, 0, true);
  }, [sendDriveCommand]);

  return {
    sendDriveCommand,
    sendFollowCommand,
    stopCar,
  };
};