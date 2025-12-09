import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const CAMERA_URL = 'http://192.168.1.28';

// Injected JavaScript that extracts video stream and runs object detection
const INJECTED_JAVASCRIPT = `
(async function() {
  // First, hide all the controls and make video fullscreen
  function setupFullscreenVideo() {
    // Hide the entire body
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000';
    
    // Find the video/image stream element
    const streamElement = document.querySelector('img') || document.querySelector('video');
    
    if (streamElement) {
      // Remove all other elements
      document.body.innerHTML = '';
      
      // Create a container for the stream
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.display = 'flex';
      container.style.justifyContent = 'center';
      container.style.alignItems = 'center';
      container.style.backgroundColor = '#000';
      
      // Style the stream element
      streamElement.style.maxWidth = '100%';
      streamElement.style.maxHeight = '100%';
      streamElement.style.width = 'auto';
      streamElement.style.height = 'auto';
      streamElement.style.objectFit = 'contain';
      
      container.appendChild(streamElement);
      document.body.appendChild(container);
      
      return streamElement;
    }
    return null;
  }
  
  // Find and click the "Start Stream" button
  function clickStartButton() {
    // Look for common button text variations
    const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
    const startButton = buttons.find(btn => 
      btn.textContent.toLowerCase().includes('start') || 
      btn.value?.toLowerCase().includes('start')
    );
    
    if (startButton) {
      startButton.click();
      return true;
    }
    return false;
  }
  
  // Click the start button and wait for stream to initialize
  clickStartButton();
  await new Promise(resolve => setTimeout(resolve, 2000));
  const videoElement = setupFullscreenVideo();
  
  if (!videoElement) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ 
      type: 'error', 
      message: 'Could not find video stream' 
    }));
    return;
  }
  
  // Load TensorFlow.js and COCO-SSD model
  const script1 = document.createElement('script');
  script1.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js';
  document.head.appendChild(script1);
  
  await new Promise(resolve => script1.onload = resolve);
  
  const script2 = document.createElement('script');
  script2.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
  document.head.appendChild(script2);
  
  await new Promise(resolve => script2.onload = resolve);
  
  // Load the model
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'status', message: 'Loading AI model...' }));
  const model = await cocoSsd.load();
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'status', message: 'Model loaded!' }));
  
  // Create canvas overlay for drawing detections
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1000';
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  let detectionEnabled = true;
  let showLabels = true;
  
  // Listen for messages from React Native
  window.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'toggleDetection') {
        detectionEnabled = data.enabled;
      }
      if (data.type === 'toggleLabels') {
        showLabels = data.enabled;
      }
    } catch (e) {}
  });
  
  // Draw detections on canvas
  function drawDetections(predictions) {
    // Match canvas size to video element size
    const rect = videoElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale factors
    const scaleX = rect.width / videoElement.naturalWidth || 1;
    const scaleY = rect.height / videoElement.naturalHeight || 1;
    
    predictions.forEach(prediction => {
      let [x, y, width, height] = prediction.bbox;
      
      // Scale coordinates to match displayed size
      x *= scaleX;
      y *= scaleY;
      width *= scaleX;
      height *= scaleY;
      
      // Draw bounding box
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      if (showLabels) {
        // Draw label background
        const label = \`\${prediction.class} \${Math.round(prediction.score * 100)}%\`;
        ctx.font = '16px Arial';
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        
        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.fillText(label, x + 5, y - 7);
      }
    });
  }
  
  // Run detection loop
  async function detectObjects() {
    if (!detectionEnabled) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTimeout(detectObjects, 100);
      return;
    }
    
    try {
      const predictions = await model.detect(videoElement);
      drawDetections(predictions);
      
      // Send detection results to React Native
      if (predictions.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'detections',
          count: predictions.length,
          objects: predictions.map(p => ({
            class: p.class,
            score: Math.round(p.score * 100)
          }))
        }));
      }
    } catch (e) {
      console.error('Detection error:', e);
    }
    
    requestAnimationFrame(detectObjects);
  }
  
  // Start detection
  detectObjects();
  
})();
true;
`;

export default function CameraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState('');
  const [detections, setDetections] = useState<any[]>([]);
  const [detectionEnabled, setDetectionEnabled] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const handleReload = () => {
    setLoading(true);
    setError(null);
    setModelStatus('');
    setDetections([]);
    webViewRef.current?.reload();
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'status') {
        setModelStatus(data.message);
      } else if (data.type === 'detections') {
        setDetections(data.objects);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    } catch (e) {
      console.error('Message parsing error:', e);
    }
  };

  const toggleDetection = () => {
    const newValue = !detectionEnabled;
    setDetectionEnabled(newValue);
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'toggleDetection',
      enabled: newValue
    }));
  };

  const toggleLabels = () => {
    const newValue = !showLabels;
    setShowLabels(newValue);
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'toggleLabels',
      enabled: newValue
    }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Camera</Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReload}
          activeOpacity={0.7}>
          <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {modelStatus && (
        <View style={styles.statusBar}>
          <MaterialIcons name="psychology" size={16} color="#22C55E" />
          <Text style={styles.statusText}>{modelStatus}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Object Detection</Text>
          <Switch
            value={detectionEnabled}
            onValueChange={toggleDetection}
            trackColor={{ false: '#374151', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Show Labels</Text>
          <Switch
            value={showLabels}
            onValueChange={toggleLabels}
            trackColor={{ false: '#374151', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {detections.length > 0 && detectionEnabled && (
        <View style={styles.detectionsContainer}>
          <Text style={styles.detectionsTitle}>
            Detected ({detections.length} objects):
          </Text>
          <View style={styles.detectionsList}>
            {detections.slice(0, 5).map((obj, idx) => (
              <View key={idx} style={styles.detectionBadge}>
                <Text style={styles.detectionText}>
                  {obj.class} {obj.score}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.webviewContainer}>
        {loading && !error && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading camera stream...</Text>
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleReload}
              activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: CAMERA_URL }}
          style={[styles.webview, (loading || error) && styles.webviewHidden]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={true}
          scalesPageToFit={true}
          injectedJavaScript={INJECTED_JAVASCRIPT}
          onMessage={handleMessage}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => {
            setLoading(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            setError(`Failed to load camera: ${nativeEvent.description || 'Connection error'}`);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            setError(`HTTP Error: ${nativeEvent.statusCode}`);
          }}
        />
      </View>

      <Text style={styles.helpText}>
        {error ? 'Check your ESP32-CAM IP address and connection.' : 'AI detection powered by TensorFlow.js'}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  reloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    color: '#22C55E',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  controls: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  controlLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  detectionsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  detectionsTitle: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  detectionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detectionBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detectionText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
  webviewContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2937',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webviewHidden: {
    opacity: 0,
    position: 'absolute',
    width: 0,
    height: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    zIndex: 1,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
    zIndex: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#22C55E',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});