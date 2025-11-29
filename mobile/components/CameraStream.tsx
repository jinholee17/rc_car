import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
// import '@tensorflow/tfjs-react-native';
import { GLView } from 'expo-gl';
import * as FileSystem from 'expo-file-system';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';


type Props = {
  source?: 'device' | 'remote';
  remoteStreamUrl?: string;
  initialCameraType?: CameraType;
  style?: any;
  onDetection?: (position: 'left' | 'center' | 'right' | 'none') => void;
};

type Detection = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export default function CameraStream({
  source = 'device',
  remoteStreamUrl,
  initialCameraType = 'back',
  style,
  onDetection,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>(initialCameraType);
  const [model, setModel] = useState<any>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [humanPosition, setHumanPosition] = useState<'left' | 'center' | 'right' | 'none'>('none');
  const [tfReady, setTfReady] = useState(false);
  const cameraRef = useRef<any>(null);
  const detectionLoopRef = useRef<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(Date.now());
  const detectionIntervalRef = useRef<any>(null);

  // Initialize TensorFlow first
  useEffect(() => {
    let mounted = true;
    
    async function initTensorFlow() {
      try {
        // Wait for TensorFlow to be ready for React Native
        await tf.ready();
        console.log('TensorFlow backend:', tf.getBackend());
        if (mounted) {
          setTfReady(true);
        }
      } catch (err) {
        console.error('Error initializing TensorFlow:', err);
      }
    }
    
    initTensorFlow();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Load COCO-SSD model after TensorFlow is ready
  useEffect(() => {
    if (!tfReady) return;
    
    let mounted = true;
    
    async function loadModel() {
      try {
        console.log('Loading COCO-SSD model...');
        const loadedModel = await cocossd.load();
        if (mounted) {
          setModel(loadedModel);
          console.log('Model loaded successfully');
        }
      } catch (err) {
        console.error('Error loading model:', err);
      }
    }
    
    loadModel();
    
    return () => {
      mounted = false;
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
      }
    };
  }, [tfReady]);

  // Frame-by-frame detection loop
  useEffect(() => {
    if (!model || !cameraRef.current || source === 'remote') return;

    async function captureAndDetect() {
      if (isProcessing || !cameraRef.current) return;
      
      try {
        setIsProcessing(true);
        
        // Capture a frame from the camera
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
          skipProcessing: true,
        });

        if (!photo.base64) {
          setIsProcessing(false);
          return;
        }

        // Convert base64 to tensor for TensorFlow
        const imageAssetPath = `data:image/jpeg;base64,${photo.base64}`;
        const imgB64 = photo.base64;
        const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
        const raw = new Uint8Array(imgBuffer);
        const imageTensor = decodeJpeg(raw);

        // Run detection
        const predictions = await model.detect(imageTensor);

        // Clean up tensor to prevent memory leak
        imageTensor.dispose();
        
        // Update detections
        setDetections(predictions);
        
        // Update FPS counter
        frameCount.current++;
        const now = Date.now();
        if (now - lastFpsUpdate.current >= 1000) {
          setFps(frameCount.current);
          frameCount.current = 0;
          lastFpsUpdate.current = now;
        }
        
      } catch (err) {
        console.error('Detection error:', err);
      } finally {
        setIsProcessing(false);
      }
    }

    detectionIntervalRef.current = setInterval(captureAndDetect, 100);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [model, source, isProcessing]);

  // Mock detection loop for testing (replace the current Detection loop useEffect)
  // useEffect(() => {
  //   if (!model || source === 'remote') return;

  //   let mockPosition = 0; // 0=left, 1=center, 2=right
  //   let direction = 1;

  //   const interval = setInterval(() => {
  //     // Simulate a person moving left to right
  //     const mockDetection: Detection = {
  //       bbox: [100 + (mockPosition * 150), 200, 150, 300],
  //       class: 'person',
  //       score: 0.95
  //     };

  //     setDetections([mockDetection]);

  //     // Cycle through positions
  //     mockPosition += direction;
  //     if (mockPosition >= 2 || mockPosition <= 0) {
  //       direction *= -1;
  //     }
  //   }, 2000); // Update every 2 seconds

  //   return () => {
  //     clearInterval(interval);
  //   };
  // }, [model, source]);

  // Detection loop
  // useEffect(() => {
  //   if (!model || source === 'remote') return;

  //   async function detectFrame() {
  //     try {
  //       if (cameraRef.current) {
  //         // In a real implementation, you'd capture frames from the camera
  //         // For now, we'll simulate detection
  //         // const predictions = await model.detect(imageElement);
          
  //         // Placeholder for actual detection
  //         // You'll need to implement frame capture from CameraView
  //       }
  //     } catch (err) {
  //       console.error('Detection error:', err);
  //     }
      
  //     detectionLoopRef.current = requestAnimationFrame(detectFrame);
  //   }

  //   detectFrame();

  //   return () => {
  //     if (detectionLoopRef.current) {
  //       cancelAnimationFrame(detectionLoopRef.current);
  //     }
  //   };
  // }, [model, source]);


  // Calculate human position based on detections
  useEffect(() => {
    const personDetections = detections.filter(d => d.class === 'person');
    
    if (personDetections.length === 0) {
      setHumanPosition('none');
      onDetection?.('none');
      return;
    }

    // Get the largest person detection (closest/most prominent)
    const largestPerson = personDetections.reduce((prev, curr) => {
      const prevArea = prev.bbox[2] * prev.bbox[3];
      const currArea = curr.bbox[2] * curr.bbox[3];
      return currArea > prevArea ? curr : prev;
    });

    // Calculate center of bounding box
    const [x, y, width] = largestPerson.bbox;
    const centerX = x + width / 2;
    
    // Determine position (assuming camera width context)
    // You'll need actual camera dimensions for accurate positioning
    const cameraWidth = 640; // placeholder
    const leftThird = cameraWidth / 3;
    const rightThird = (cameraWidth * 2) / 3;

    let position: 'left' | 'center' | 'right' = 'center';
    if (centerX < leftThird) {
      position = 'left';
    } else if (centerX > rightThird) {
      position = 'right';
    }

    setHumanPosition(position);
    onDetection?.(position);
  }, [detections, onDetection]);

  //
  // --- Remote stream placeholder (future car camera) ---
  //
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

  //
  // --- Device camera (iPhone) ---
  //
  if (!permission) {
    return (
      <View style={[styles.loading, style]}>
        <ActivityIndicator />
        <Text style={styles.info}>Requesting permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.loading, style]}>
        <Text style={styles.info}>Camera access needed</Text>
        <Text style={[styles.info, { marginTop: 4 }]} onPress={requestPermission}>
          Tap to grant permission
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <CameraView 
        style={StyleSheet.absoluteFill} 
        facing={facing} 
        ref={cameraRef}
      />
      
      {/* Detection overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Model: {model ? '✓ Loaded' : '⏳ Loading...'}
          </Text>
          <Text style={styles.statusText}>
            FPS: {fps}
          </Text>
          <Text style={styles.statusText}>
            Human: {humanPosition.toUpperCase()}
          </Text>
          <Text style={styles.statusText}>
            Detections: {detections.filter(d => d.class === 'person').length}
          </Text>
          <Text style={styles.statusText}>
            Processing: {isProcessing ? 'Yes' : 'No'}
          </Text>
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

        {/* Bounding boxes for detected people */}
        {detections
          .filter(d => d.class === 'person')
          .map((detection, idx) => {
            const [x, y, width, height] = detection.bbox;
            // Scale coordinates to screen size (you may need to adjust these ratios)
            const scale = 0.3; // Adjust based on your screen/camera ratio
            return (
              <View
                key={idx}
                style={{
                  position: 'absolute',
                  left: x * scale,
                  top: y * scale,
                  width: width * scale,
                  height: height * scale,
                  borderWidth: 2,
                  borderColor: '#0f0',
                  backgroundColor: 'rgba(0,255,0,0.1)',
                }}
              >
                <Text style={styles.detectionLabel}>
                  Person {Math.round(detection.score * 100)}%
                </Text>
              </View>
            );
          })}
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
  detectionLabel: {
  color: '#0f0',
  fontSize: 10,
  backgroundColor: 'rgba(0,0,0,0.7)',
  padding: 2,
},
});