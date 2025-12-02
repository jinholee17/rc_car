import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Your Arduino HTTP server (same as CarController)
const ARDUINO_IP = '172.20.10.4'; // Update this to match your Arduino IP
const PORT = 8080;

interface MP3PlayerState {
  isPlaying: boolean;
  currentTrack: number;
  totalTracks: number;
  isLoading: boolean;
}

const MP3Player: React.FC = () => {
  const [playerState, setPlayerState] = useState<MP3PlayerState>({
    isPlaying: false,
    currentTrack: 1,
    totalTracks: 10, // You can update this based on actual number of tracks
    isLoading: false,
  });

  // Send HTTP request to Arduino for MP3 control
  const sendMP3Command = useCallback(async (command: 'play' | 'pause' | 'next' | 'previous') => {
    setPlayerState((prev) => ({ ...prev, isLoading: true }));
    
    const url = `http://${ARDUINO_IP}:${PORT}/mp3?cmd=${command}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        // Update state based on command
        if (command === 'play') {
          setPlayerState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
        } else if (command === 'pause') {
          setPlayerState((prev) => ({ ...prev, isPlaying: false, isLoading: false }));
        } else if (command === 'next') {
          setPlayerState((prev) => ({
            ...prev,
            currentTrack: Math.min(prev.currentTrack + 1, prev.totalTracks),
            isPlaying: true,
            isLoading: false,
          }));
        } else if (command === 'previous') {
          setPlayerState((prev) => ({
            ...prev,
            currentTrack: Math.max(prev.currentTrack - 1, 1),
            isPlaying: true,
            isLoading: false,
          }));
        }
      } else {
        setPlayerState((prev) => ({ ...prev, isLoading: false }));
        console.log('Error: MP3 command failed');
      }
    } catch (error) {
      console.log('Error sending MP3 command:', error);
      setPlayerState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Poll for current track info (optional - if Arduino sends track info)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (playerState.isPlaying) {
        // You can add a GET endpoint to fetch current track info
        // For now, we'll just keep the UI in sync
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [playerState.isPlaying]);

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      sendMP3Command('pause');
    } else {
      sendMP3Command('play');
    }
  };

  const handleNext = () => {
    sendMP3Command('next');
  };

  const handlePrevious = () => {
    sendMP3Command('previous');
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
          onPress={handlePrevious}
          disabled={playerState.isLoading || playerState.currentTrack === 1}>
          <MaterialIcons
            name="skip-previous"
            size={32}
            color={playerState.currentTrack === 1 ? '#666' : '#FFFFFF'}
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
          onPress={handleNext}
          disabled={playerState.isLoading || playerState.currentTrack === playerState.totalTracks}>
          <MaterialIcons
            name="skip-next"
            size={32}
            color={playerState.currentTrack === playerState.totalTracks ? '#666' : '#FFFFFF'}
          />
        </TouchableOpacity>
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
});
