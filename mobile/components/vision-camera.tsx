
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

function PermissionsPage() {
  const { requestPermission } = useCameraPermission();

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Permission Required</Text>
      <Text style={styles.description}>
        This app needs access to your camera to take photos and videos.
      </Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleRequestPermission}
      >
        <Text style={styles.buttonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );
}

function NoCameraDeviceError() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No Camera Found</Text>
      <Text style={styles.description}>
        Your device doesn&apost have a camera or it&aposs not accessible.
      </Text>
    </View>
  );
}

type Props = {
  source?: 'device' | 'remote';
  remoteStreamUrl?: string;
  initialCameraType?: 'back' | 'front';
  style?: any;
  onDetection?: (position: 'left' | 'center' | 'right' | 'none') => void;
};

export default function VisionCamera({
  source = 'device',
  remoteStreamUrl,
  initialCameraType = 'back',
  style,
  onDetection,
}: Props) {
  const device = useCameraDevice(initialCameraType);
  const { hasPermission } = useCameraPermission();

  if (!hasPermission) return <PermissionsPage />;
  if (device == null) return <NoCameraDeviceError />;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
