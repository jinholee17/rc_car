import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const CAMERA_URL = 'http://172.20.10.4'; // <- replace with your ESP32 IP

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera</Text>

      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: CAMERA_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      </View>

      <Text style={styles.helpText}>
        Use the ESP32 page controls to start the stream.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  webviewContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  webview: {
    flex: 1,
  },
  helpText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});