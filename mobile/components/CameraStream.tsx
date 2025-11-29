import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { labelImage } from 'vision-camera-image-labeler';

type Props = {
  source?: 'device' | 'remote';
  remoteStreamUrl?: string;
  initialCameraType?: 'back' | 'front';
  style?: any;
  onDetection?: (position: 'left' | 'center' | 'right' | 'none') => void;
};

type Label = {
  text: string;
  confidence: number;
};

export default function CameraStream({
  source = 'device',
  remoteStreamUrl,
  initialCameraType = 'back',
  style,
  onDetection,
}: Props) {
  const device = useCameraDevice(initialCameraType);
  const [labels, setLabels] = useState<Label[]>([]);
  const [humanDetected, setHumanDetected] = useState(false);
  const [humanPosition, setHumanPosition] = useState<'left' | 'center' | 'right' | 'none'>('none');
  const [fps, setFps] = useState(0);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'not-determined'>('not-determined');
  
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(Date.now());
  const isProcessingRef = useRef(false);
  const lastProcessTime = useRef(0);

  // Request camera permission
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setCameraPermission(status);
    })();
  }, []);

  // Update detection results
  const updateLabels = useCallback((newLabels: Label[]) => {
    setLabels(newLabels);
    
    // Check if person is detected (confidence > 0.5)
    const personLabel = newLabels.find(
      label => label.text.toLowerCase() === 'person' && label.confidence > 0.5
    );
    
    const detected = !!personLabel;
    setHumanDetected(detected);
    
    // For image labeling, we can't determine exact position
    // You would need object detection (MLKit Object Detection) for bounding boxes
    // For now, we'll just indicate center when person is detected
    if (detected) {
      setHumanPosition('center');
      onDetection?.('center');
    } else {
      setHumanPosition('none');
      onDetection?.('none');
    }
  }, [onDetection]);

  // Update FPS counter
  const updateFps = useCallback(() => {
    frameCount.current++;
    const now = Date.now();
    if (now - lastFpsUpdate.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }
  }, []);

  // Frame processor with ML Kit image labeling
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Throttle processing to ~5 FPS (200ms between frames)
    const now = Date.now();
    if (isProcessingRef.current || now - lastProcessTime.current < 200) {
      return;
    }
    
    isProcessingRef.current = true;
    lastProcessTime.current = now;

    try {
      // Run image labeling on device
      const detectedLabels = labelImage(frame);
      
      // Process results on JS thread
      runOnJS((results: any[]) => {
        try {
          const formattedLabels: Label[] = results.map(result => ({
            text: result.label || result.text,
            confidence: result.confidence,
          }));
          
          updateLabels(formattedLabels);
          updateFps();
        } catch (err) {
          console.error('Label processing error:', err);
        } finally {
          isProcessingRef.current = false;
        }
      })(detectedLabels);
      
    } catch (err) {
      runOnJS(console.error)('Frame processing error:', err);
      isProcessingRef.current = false;
    }
  }, [updateLabels, updateFps]);

  // Remote stream placeholder
  if (source === 'remote') {
    return (
      <View style={[styles.remote, style]}>
        <Text style={{ color: '#fff' }}>Remote stream placeholder</Text>
        {remoteStreamUrl ? (
          <Text style={{ color: '#ccc', fontSize: 12 }}>{remoteStreamUrl}</Text>
        ) : null}
      </View>
    );
  }

  // Loading states
  if (!device) {
    return (
      <View style={[styles.loading, style]}>
        <ActivityIndicator />
        <Text style={styles.info}>Loading camera…</Text>
      </View>
    );
  }

  if (cameraPermission !== 'granted') {
    return (
      <View style={[styles.loading, style]}>
        <Text style={styles.info}>
          {cameraPermission === 'denied' 
            ? 'Camera access denied. Please enable in settings.' 
            : 'Requesting camera permission…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />
      
      {/* Detection overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            FPS: {fps}
          </Text>
          <Text style={styles.statusText}>
            Human: {humanDetected ? '✓ DETECTED' : '✗ Not detected'}
          </Text>
          <Text style={styles.statusText}>
            Position: {humanPosition.toUpperCase()}
          </Text>
          <Text style={styles.statusText}>
            Labels: {labels.length}
          </Text>
        </View>
        
        {/* Detected labels list */}
        <View style={styles.labelsList}>
          {labels.slice(0, 5).map((label, idx) => (
            <Text key={idx} style={styles.labelText}>
              {label.text}: {Math.round(label.confidence * 100)}%
            </Text>
          ))}
        </View>
        
        {/* Position indicator */}
        <View style={styles.positionIndicator}>
          <View style={[styles.indicator, humanPosition === 'left' && styles.indicatorActive]}>
            <Text style={styles.indicatorText}>L</Text>
          </View>
          <View style={[styles.indicator, humanPosition === 'center' && styles.indicatorActive]}>
            <Text style={styles.indicatorText}>C</Text>
          </View>
          <View style={[styles.indicator, humanPosition === 'right' && styles.indicatorActive]}>
            <Text style={styles.indicatorText}>R</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  loading: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  info: {
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  remote: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  statusBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  labelsList: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  labelText: {
    color: '#0f0',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  positionIndicator: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  indicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  indicatorActive: {
    backgroundColor: 'rgba(0,255,0,0.6)',
    borderColor: '#0f0',
  },
  indicatorText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});