import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import CarController from '../app/(tabs)/CarController';

describe('CarController', () => {
  test('shows connection label', () => {
    const { getByText } = render(<CarController />);

    expect(
      getByText(
        /Sending commands via HTTP to http:\/\/192\.168\.1\.18:8080\/drive/i
      )
    ).toBeTruthy();
  });

  test('initializes PWM values to 0', () => {
    const { getByTestId } = render(<CarController />);

    const pwmUD = getByTestId('pwm-ud-value');
    const pwmLR = getByTestId('pwm-lr-value');

    expect(pwmUD.props.children).toBe(0);
    expect(pwmLR.props.children).toBe(0);
  });

  // PanResponder is hard to fully simulate in Jest/Expo,
  // so we don’t assert that joystick movement changes the values.
  // Instead we just ensure STOP is wired up and safe to press.
  test('STOP button exists and is pressable (keeps PWM at a safe value)', () => {
    const { getByText, getByTestId } = render(<CarController />);

    const pwmUD = getByTestId('pwm-ud-value');
    const pwmLR = getByTestId('pwm-lr-value');
    const stopButton = getByText('STOP');

    // Initially 0
    expect(pwmUD.props.children).toBe(0);
    expect(pwmLR.props.children).toBe(0);

    // Press STOP – should not crash and should still be 0
    act(() => {
      fireEvent.press(stopButton);
    });

    expect(pwmUD.props.children).toBe(0);
    expect(pwmLR.props.children).toBe(0);
  });

  test('joystick terminate handler can be called and keeps PWM at 0', () => {
    const { getByTestId } = render(<CarController />);

    const joystick = getByTestId('joystick-area');
    const pwmUD = getByTestId('pwm-ud-value');
    const pwmLR = getByTestId('pwm-lr-value');

    // Initially 0
    expect(pwmUD.props.children).toBe(0);
    expect(pwmLR.props.children).toBe(0);

    // Call the terminate handler that you’ve attached via panHandlers
    act(() => {
      fireEvent(joystick, 'onPanResponderTerminate');
    });

    // Still safe: 0,0
    expect(pwmUD.props.children).toBe(0);
    expect(pwmLR.props.children).toBe(0);
  });
});