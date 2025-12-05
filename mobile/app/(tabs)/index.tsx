import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Your Arduino HTTP server (same as CarController)
const ARDUINO_IP = '172.20.10.6'; // Update this to match your Arduino IP
const PORT = 8080;

interface MP3PlayerState {
  isPlaying: boolean;
  currentTrack: number;
  totalTracks: number;
  isLoading: boolean;
  volume: number;
}

const MP3Player: React.FC = () => {
  const [playerState, setPlayerState] = useState<MP3PlayerState>({
    isPlaying: false,
    currentTrack: 1,
    totalTracks: 10, // You can update this based on actual number of tracks
    isLoading: false,
    volume: 30, // DFPlayer Mini volume range: 0-30
  });

  // Send HTTP request to Arduino for MP3 control
  const sendMP3Command = useCallback(async (command: 'play' | 'pause' | 'next' | 'previous') => {
    setPlayerState((prev) => ({ ...prev, isLoading: true }));
    
    const url = `http://${ARDUINO_IP}:${PORT}/mp3?cmd=${command}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        setPlayerState((prev) => ({ ...prev, isLoading: false }));
        // Fetch actual state from Arduino after command completes
        setTimeout(() => {
          fetchPlayerStatus();
        }, 300);
      } else {
        setPlayerState((prev) => ({ ...prev, isLoading: false }));
        console.log('Error: MP3 command failed');
      }
    } catch (error) {
      console.log('Error sending MP3 command:', error);
      setPlayerState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [fetchPlayerStatus]);

  // Fetch current state from Arduino
  const fetchPlayerStatus = useCallback(async () => {
    try {
      const url = `http://${ARDUINO_IP}:${PORT}/mp3/status`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setPlayerState((prev) => {
          // Only update if values actually changed (prevents unnecessary re-renders)
          const newIsPlaying = data.isPlaying === true;
          const newVolume = data.volume !== undefined ? data.volume : prev.volume;
          
          if (prev.isPlaying === newIsPlaying && prev.volume === newVolume) {
            return prev; // No change, return same state
          }
          
          return {
            ...prev,
            isPlaying: newIsPlaying,
            volume: newVolume,
          };
        });
      }
    } catch (error) {
      // Silently fail - don't spam console with errors
      // If we can't connect, keep current state (don't reset)
    }
  }, []);

  // Sync state when app loads
  useEffect(() => {
    fetchPlayerStatus();
  }, [fetchPlayerStatus]);

  // Poll Arduino state periodically to detect physical button presses
  // Use longer interval and prevent overlapping requests to reduce lag
  const isPollingRef = useRef(false);
  
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Only poll if not already fetching (prevents request queue)
      if (!isPollingRef.current && !playerState.isLoading) {
        isPollingRef.current = true;
        fetchPlayerStatus().finally(() => {
          isPollingRef.current = false;
        });
      }
    }, 2500); // Check every 2.5 seconds (less frequent = less lag)

    return () => clearInterval(pollInterval);
  }, [fetchPlayerStatus, playerState.isLoading]);

  const handlePlayPause = () => {
    // Send play command (Arduino toggles play/pause)
    sendMP3Command('play');
  };

  const handleNext = async () => {
    try {
      await sendMP3Command('next');
    } catch (error) {
      console.log('Error in handleNext:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      await sendMP3Command('previous');
    } catch (error) {
      console.log('Error in handlePrevious:', error);
    }
  };

  // Send volume command to Arduino
  const sendVolumeCommand = useCallback(async (volume: number) => {
    const url = `http://${ARDUINO_IP}:${PORT}/mp3?volume=${Math.round(volume)}`;
    try {
      await fetch(url);
    } catch (error) {
      console.log('Error sending volume command:', error);
    }
  }, []);

  // Update UI immediately for smooth visual feedback (no HTTP request)
  const handleVolumeChange = (value: number) => {
    const roundedValue = Math.round(value);
    setPlayerState((prev) => ({ ...prev, volume: roundedValue }));
  };

  // Send HTTP request only when user finishes sliding (lifts finger)
  const handleVolumeSlidingComplete = (value: number) => {
    const roundedValue = Math.round(value);
    sendVolumeCommand(roundedValue);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>MP3 Player</ThemedText>
      
      <ThemedText style={styles.connectionStatus}>
        Connected to: {ARDUINO_IP}:{PORT}
      </ThemedText>

      {/* Current Track Display */}
      <ThemedView style={styles.trackInfoContainer}>
        <ThemedText style={styles.trackLabel}>Now Playing</ThemedText>
        <ThemedText style={styles.trackTitle}>
          Track {playerState.currentTrack}
        </ThemedText>
        <ThemedText style={styles.trackSubtitle}>
          {playerState.currentTrack} of {playerState.totalTracks}
        </ThemedText>
        {playerState.isLoading && (
          <ActivityIndicator size="small" color="#22C55E" style={styles.loader} />
        )}
      </ThemedView>

      {/* Control Buttons */}
      <ThemedView style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.secondaryButton]}
          onPress={handlePrevious}>
          <MaterialIcons
            name="skip-previous"
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.playPauseButton]}
          onPress={handlePlayPause}
          disabled={playerState.isLoading}>
          {playerState.isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <MaterialIcons
              name={playerState.isPlaying ? 'pause' : 'play-arrow'}
              size={48}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.secondaryButton]}
          onPress={handleNext}>
          <MaterialIcons
            name="skip-next"
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </ThemedView>

      {/* Volume Control */}
      <ThemedView style={styles.volumeContainer}>
        <View style={styles.volumeHeader}>
          <MaterialIcons name="volume-up" size={24} color="#22C55E" />
          <ThemedText style={styles.volumeLabel}>Volume</ThemedText>
          <ThemedText style={styles.volumeValue}>{Math.round(playerState.volume)}</ThemedText>
        </View>
        <View style={styles.sliderWrapper}>
          <Slider
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={30}
            value={playerState.volume}
            onValueChange={handleVolumeChange}
            onSlidingComplete={handleVolumeSlidingComplete}
            minimumTrackTintColor="#22C55E"
            maximumTrackTintColor="#1E293B"
            thumbTintColor="#22C55E"
            step={1}
          />
        </View>
      </ThemedView>

      {/* Status Indicator */}
      <ThemedView style={styles.statusContainer}>
        <View style={[styles.statusDot, playerState.isPlaying && styles.statusDotActive]} />
        <ThemedText style={styles.statusText}>
          {playerState.isPlaying ? 'Playing' : 'Paused'}
        </ThemedText>
      </ThemedView>
    </View>
  );
};

export default MP3Player;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    backgroundColor: '#020617',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  connectionStatus: {
    fontSize: 12,
    marginBottom: 32,
    textAlign: 'center',
    color: '#9CA3AF',
  },
  trackInfoContainer: {
    padding: 24,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    marginBottom: 32,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  trackLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trackTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  trackSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  loader: {
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 32,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
  },
  statusDotActive: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  volumeContainer: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    marginBottom: 24,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  volumeLabel: {
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  volumeValue: {
    fontSize: 18,
    color: '#22C55E',
    fontWeight: '700',
    minWidth: 35,
    textAlign: 'right',
  },
  sliderWrapper: {
    width: '100%',
    paddingVertical: 8,
  },
  volumeSlider: {
    width: '100%',
    height: 40,
  },
});
