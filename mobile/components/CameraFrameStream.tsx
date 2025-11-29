import { CameraView } from 'expo-camera';
import { useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CameraFrameStream({ onFrame }: { onFrame?: (uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (permission?.granted) {
      interval = setInterval(async () => {
        if (cameraRef.current && onFrame) {
          try {
            const photo = await cameraRef.current.takePictureAsync({
              skipProcessing: true
            });
            onFrame(photo.uri);
          } catch (err) {
            // ignore if camera is busy
          }
        }
      }, 500); // capture every 0.5s
    }

    return () => clearInterval(interval);
  }, [permission]);

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted)
    return (
      <View style={styles.container}>
        <Text style={{ color: 'white' }} onPress={requestPermission}>
          Tap to enable camera
        </Text>
      </View>
    );

  return <CameraView ref={cameraRef} style={styles.camera} facing="back" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  camera: {
    width: '100%',
    aspectRatio: 9 / 16
  }
});
