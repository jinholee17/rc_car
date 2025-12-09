import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Animated } from 'react-native';
import Slider from '@react-native-community/slider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Your Arduino HTTP server (same as CarController)
const ARDUINO_IP = '192.168.1.18';//'172.20.10.6'; // Update this to match your Arduino IP
const PORT = 8080;

// Track names - matches Arduino order
const TRACK_NAMES: { [key: number]: string } = {
  1: 'deep in it by berlioz',
  2: 'I Am in Love by Jennifer Lara',
  3: 'Broccoli by Lil Yachty',
  4: 'Fashion Killa by A$AP Rocky',
  5: 'Jukebox Joints by A$AP ROCKY',
  6: 'Pyramids by Frank Ocean',
  7: 'Where Are You 54 Ultra',
};

const TOTAL_TRACKS = 7;

// Helper to get song name from track number
const getSongName = (trackNumber: number): string => {
  return TRACK_NAMES[trackNumber] || `Track ${trackNumber}`;
};

interface MP3PlayerState {
  isPlaying: boolean;
  currentTrack: number;
  totalTracks: number;
  isLoading: boolean;
  volume: number;
  trackName?: string; // Track name from Arduino
}

const MP3Player: React.FC = () => {
  const [playerState, setPlayerState] = useState<MP3PlayerState>({
    isPlaying: false,
    currentTrack: 1,
    totalTracks: TOTAL_TRACKS,
    isLoading: false,
    volume: 30, // DFPlayer Mini volume range: 0-30
  });

  // Animation values for smooth button interactions
  const playPauseScale = useRef(new Animated.Value(1)).current;
  const nextScale = useRef(new Animated.Value(1)).current;
  const prevScale = useRef(new Animated.Value(1)).current;
  const trackNameOpacity = useRef(new Animated.Value(1)).current;

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
        console.log('Status data:', data); // Debug: see what Arduino is sending
        setPlayerState((prev) => {
          // Only update if values actually changed (prevents unnecessary re-renders)
          const newIsPlaying = data.isPlaying === true;
          const newVolume = data.volume !== undefined ? data.volume : prev.volume;
          const newTrack = data.currentTrack !== undefined ? data.currentTrack : prev.currentTrack;
          const trackName = data.trackName || getSongName(newTrack);
          
          console.log('Track name from Arduino:', data.trackName, 'Track number:', newTrack); // Debug
          
          // Always update trackName even if other values haven't changed
          const shouldUpdate = prev.isPlaying !== newIsPlaying || 
                               prev.volume !== newVolume || 
                               prev.currentTrack !== newTrack ||
                               prev.trackName !== trackName;
          
          if (!shouldUpdate) {
            return prev; // No change, return same state
          }
          
          return {
            ...prev,
            isPlaying: newIsPlaying,
            volume: newVolume,
            currentTrack: newTrack,
            trackName: trackName, // Store track name from Arduino
          };
        });
      }
    } catch (error) {
      // Silently fail - don't spam console with errors
      // If we can't connect, keep current state (don't reset)
    }
  }, []);

  // Send HTTP request to Arduino for MP3 control
  const sendMP3Command = useCallback(async (command: 'play' | 'pause' | 'next' | 'previous') => {
    const url = `http://${ARDUINO_IP}:${PORT}/mp3?cmd=${command}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        // Fetch actual state from Arduino after command completes
        // Reduced delay for faster updates
        setTimeout(() => {
          fetchPlayerStatus().then(() => {
            setPlayerState((prev) => ({ ...prev, isLoading: false }));
          });
        }, 250);
      } else {
        setPlayerState((prev) => ({ ...prev, isLoading: false }));
        console.log('Error: MP3 command failed');
      }
    } catch (error) {
      console.log('Error sending MP3 command:', error);
      setPlayerState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [fetchPlayerStatus]);

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
    }, 2000); // Check every 2 seconds for better responsiveness

    return () => clearInterval(pollInterval);
  }, [fetchPlayerStatus, playerState.isLoading]);

  // Animate button press
  const animateButtonPress = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animate track name update
  const animateTrackNameUpdate = () => {
    Animated.sequence([
      Animated.timing(trackNameOpacity, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(trackNameOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Play a specific track
  const playTrack = useCallback(async (trackNumber: number) => {
    if (trackNumber < 1 || trackNumber > TOTAL_TRACKS) return;
    
    // Optimistically update UI immediately
    setPlayerState((prev) => ({
      ...prev,
      currentTrack: trackNumber,
      trackName: getSongName(trackNumber),
      isPlaying: true,
      isLoading: true,
    }));
    
    // Animate track name update
    animateTrackNameUpdate();
    
    const url = `http://${ARDUINO_IP}:${PORT}/mp3?track=${trackNumber}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        // Sync state after playing track - reduced delay for faster updates
        setTimeout(() => {
          fetchPlayerStatus().then(() => {
            setPlayerState((prev) => ({ ...prev, isLoading: false }));
          });
        }, 300);
      } else {
        setPlayerState((prev) => ({ ...prev, isLoading: false }));
        // Re-fetch to get actual state
        setTimeout(() => {
          fetchPlayerStatus();
        }, 250);
      }
    } catch (error) {
      console.log('Error playing track:', error);
      setPlayerState((prev) => ({ ...prev, isLoading: false }));
      // Re-fetch to get actual state
      setTimeout(() => {
        fetchPlayerStatus();
      }, 250);
    }
  }, [fetchPlayerStatus]);

  const handlePlayPause = () => {
    if (playerState.isLoading) return; // Prevent multiple clicks
    
    // Optimistically update UI immediately for smooth feedback
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
      isLoading: true,
    }));
    
    // Animate button press
    animateButtonPress(playPauseScale);
    
    // Send play command (Arduino toggles play/pause)
    sendMP3Command('play');
  };
  const handleNext = () => {
  if (playerState.isLoading) return;

  animateButtonPress(nextScale);
  animateTrackNameUpdate();

  // Only show loading — DO NOT update track number yet
  setPlayerState(prev => ({
    ...prev,
    isLoading: true
  }));

  sendMP3Command("next");

  // After Arduino completes, fetch real track #
  setTimeout(() => {
    fetchPlayerStatus().then(() => {
      setPlayerState(prev => ({ ...prev, isLoading: false }));
    });
  }, 350); // 300–400ms is correct for DFPlayer
};



  const handlePrevious = () => {
    if (playerState.isLoading) return;

    animateButtonPress(prevScale);
    animateTrackNameUpdate();

    setPlayerState(prev => ({
      ...prev,
      isLoading: true
    }));

    sendMP3Command("previous");

    setTimeout(() => {
      fetchPlayerStatus().then(() => {
        setPlayerState(prev => ({ ...prev, isLoading: false }));
      });
    }, 350);
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
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Music</ThemedText>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, playerState.isPlaying && styles.statusDotActive]} />
          <ThemedText style={styles.statusText}>
            {playerState.isPlaying ? 'Playing' : 'Paused'}
          </ThemedText>
        </View>
      </View>

      {/* Current Track Display */}
      <View style={styles.trackInfoContainer}>
        <ThemedText style={styles.trackLabel}>Now Playing</ThemedText>
        <Animated.Text 
          style={[
            styles.trackTitle,
            { opacity: trackNameOpacity }
          ]} 
          numberOfLines={2}>
          {playerState.trackName || getSongName(playerState.currentTrack)}
        </Animated.Text>
        <ThemedText style={styles.trackSubtitle}>
          Track {playerState.currentTrack}
        </ThemedText>
        {playerState.isLoading && (
          <ActivityIndicator size="small" color="#22C55E" style={styles.loader} />
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={handlePrevious}
          disabled={playerState.isLoading}
          activeOpacity={0.7}>
          <Animated.View
            style={[
              styles.controlButton,
              { transform: [{ scale: prevScale }] }
            ]}>
            <MaterialIcons
              name="skip-previous"
              size={24}
              color={playerState.isLoading ? '#666' : '#FFFFFF'}
            />
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlayPause}
          disabled={playerState.isLoading}
          activeOpacity={0.8}>
          <Animated.View
            style={[
              styles.playPauseButton,
              { transform: [{ scale: playPauseScale }] }
            ]}>
            {playerState.isLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <MaterialIcons
                name={playerState.isPlaying ? 'pause' : 'play-arrow'}
                size={36}
                color="#FFFFFF"
              />
            )}
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={playerState.isLoading}
          activeOpacity={0.7}>
          <Animated.View
            style={[
              styles.controlButton,
              { transform: [{ scale: nextScale }] }
            ]}>
            <MaterialIcons
              name="skip-next"
              size={24}
              color={playerState.isLoading ? '#666' : '#FFFFFF'}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Song List */}
      <View style={styles.songListContainer}>
        <ThemedText style={styles.songListTitle}>Select Song</ThemedText>
        <ScrollView style={styles.songList} showsVerticalScrollIndicator={false}>
          {Array.from({ length: TOTAL_TRACKS }, (_, i) => i + 1).map((trackNum) => (
            <TouchableOpacity
              key={trackNum}
              style={[
                styles.songItem,
                playerState.currentTrack === trackNum && styles.songItemActive,
                trackNum === TOTAL_TRACKS && styles.songItemLast,
              ]}
              onPress={() => playTrack(trackNum)}
              disabled={playerState.isLoading}>
              <View style={styles.songItemContent}>
                <MaterialIcons
                  name={playerState.currentTrack === trackNum ? 'music-note' : 'queue-music'}
                  size={20}
                  color={playerState.currentTrack === trackNum ? '#22C55E' : '#9CA3AF'}
                />
                <ThemedText
                  style={[
                    styles.songItemText,
                    playerState.currentTrack === trackNum && styles.songItemTextActive,
                  ]}
                  numberOfLines={1}>
                  {getSongName(trackNum)}
                </ThemedText>
              </View>
              {playerState.currentTrack === trackNum && (
                <MaterialIcons name="play-arrow" size={18} color="#22C55E" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Volume Control */}
      <View style={styles.volumeContainer}>
        <View style={styles.volumeHeader}>
          <MaterialIcons name="volume-up" size={18} color="#9CA3AF" />
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
      </View>
    </View>
  );
};

export default MP3Player;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#0F172A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
  },
  statusDotActive: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackInfoContainer: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    marginBottom: 32,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  trackLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  trackSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  loader: {
    marginTop: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    marginBottom: 32,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  playPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  volumeContainer: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#0F172A',
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  volumeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  volumeValue: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  sliderWrapper: {
    width: '100%',
    paddingVertical: 2,
  },
  volumeSlider: {
    width: '100%',
    height: 36,
  },
  songListContainer: {
    marginBottom: 24,
    maxHeight: 200,
  },
  songListTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  songList: {
    borderRadius: 16,
    backgroundColor: '#0F172A',
    maxHeight: 180,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  songItemLast: {
    borderBottomWidth: 0,
  },
  songItemActive: {
    backgroundColor: '#1E293B',
  },
  songItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  songItemText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  songItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
