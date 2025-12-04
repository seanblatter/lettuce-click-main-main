
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useHardwareVolumeSync } from './VolumeSync';
import { ALARM_CHIME_DATA_URI } from '@/assets/audio/alarmChime';

import { MUSIC_AUDIO_MAP, MUSIC_OPTIONS, type MusicOption } from '@/constants/music';

type AlarmPeriod = 'AM' | 'PM';
type TimerAction = 'stop' | 'alarm';

export type SleepCircleState =
  | { mode: 'timer'; duration: number; targetTimestamp: number; startedAt: number; action: TimerAction }
  | {
      mode: 'alarm';
      fireTimestamp: number;
      hour: number;
      minute: number;
      period: AlarmPeriod;
      scheduledAt: number;
    }
  | null;

type AmbientAudioContextValue = {
  selectedTrackId: MusicOption['id'];
  isPlaying: boolean;
  error: Error | null;
  volume: number;
  sleepCircle: SleepCircleState;
  isAlarmRinging: boolean;
  selectTrack: (trackId: MusicOption['id'], options?: { autoPlay?: boolean }) => void;
  togglePlayback: () => void;
  play: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  setSleepCircle: (state: SleepCircleState) => void;
  triggerAlarm: () => void;
  dismissAlarm: () => void;
};

const AmbientAudioContext = createContext<AmbientAudioContextValue | undefined>(undefined);

type ProviderProps = {
  children: ReactNode;
};

export function AmbientAudioProvider({ children }: ProviderProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<MusicOption['id']>(MUSIC_OPTIONS[0].id);
  const [error, setError] = useState<Error | null>(null);
  const [volume, setVolumeState] = useState<number>(0.7); // Default volume 70%
  const [sleepCircle, setSleepCircle] = useState<SleepCircleState>(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  const player = useAudioPlayer(MUSIC_AUDIO_MAP[selectedTrackId]);
  const status = useAudioPlayerStatus(player);
  const alarmPlayer = useAudioPlayer(ALARM_CHIME_DATA_URI);

  const isPlaying = status.playing;
  const shouldResumeRef = useRef(false);

  // Handle track changes
  useEffect(() => {
    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
    const source = MUSIC_AUDIO_MAP[selectedTrackId];
    if (source) {
      try {
        player.replace(source);
        player.loop = true;
        setError(null);
        if (shouldResumeRef.current) {
          resumeTimeout = setTimeout(() => {
            try {
              player.play();
              setError(null);
            } catch (caught) {
              console.warn('Failed to resume playback after track change', caught);
              setError(caught instanceof Error ? caught : new Error('Failed to start playback'));
            } finally {
              shouldResumeRef.current = false;
            }
          }, 140);
        } else {
          shouldResumeRef.current = false;
        }
      } catch (caught) {
        console.warn('Failed to load ambient audio', caught);
        setError(caught instanceof Error ? caught : new Error('Failed to load ambient audio'));
        shouldResumeRef.current = false;
      }
    }
    return () => {
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
      }
    };
  }, [player, selectedTrackId, setError]);

  const selectTrack = useCallback(
    (trackId: MusicOption['id'], options?: { autoPlay?: boolean }) => {
      shouldResumeRef.current = options?.autoPlay ?? isPlaying;
      setSelectedTrackId(trackId);
      setError(null);
    },
    [isPlaying]
  );

  const play = useCallback(() => {
    try {
      player.play();
      setError(null);
    } catch (caught) {
      console.warn('Failed to start playback', caught);
      setError(caught instanceof Error ? caught : new Error('Failed to start playback'));
    }
  }, [player]);

  const pause = useCallback(() => {
    try {
      player.pause();
      setError(null);
    } catch (caught) {
      console.warn('Failed to pause playback', caught);
      setError(caught instanceof Error ? caught : new Error('Failed to pause playback'));
    }
  }, [player]);

  const setVolume = useCallback((newVolume: number) => {
    try {
      const clampedVolume = Math.max(0, Math.min(1, newVolume)); // Clamp between 0 and 1
      setVolumeState(clampedVolume);
      if (player && 'volume' in player) {
        (player as any).volume = clampedVolume; // Set volume on the player if supported
      }
      setError(null);
    } catch (caught) {
      console.warn('Failed to set volume', caught);
      setError(caught instanceof Error ? caught : new Error('Failed to set volume'));
    }
  }, [player]);

  // Configure audio session for hardware volume button support
  useEffect(() => {
    const configureAudioSession = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers, // Allow mixing but duck others
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers, // Allow mixing but duck others
          playThroughEarpieceAndroid: false,
        });
        console.log('🎵 Audio session configured for hardware volume control');
      } catch (error) {
        console.warn('Failed to configure audio session for hardware volume buttons:', error);
      }
    };

    configureAudioSession();
  }, []);



  // Apply volume to player and monitor for changes
  useEffect(() => {
    if (player && 'volume' in player) {
      (player as any).volume = volume;
    }
  }, [player, volume]);

  // SYSTEM VOLUME MONITORING - Monitor actual device system volume
  useEffect(() => {
    if (!isPlaying) return;
    
    let lastDetectedVolume = volume;
    let monitorCount = 0;
    
    const monitorSystemVolume = async () => {
      try {
        monitorCount++;
        
        // Check for volume changes by monitoring the player directly
        let systemVolume = null;
        
        // Method 1: Direct player volume (this changes with hardware buttons)
        if ('volume' in player) {
          systemVolume = (player as any).volume;
        }
        
        if (typeof systemVolume === 'number' && systemVolume !== lastDetectedVolume) {
          const diff = Math.abs(systemVolume - lastDetectedVolume);
          
          if (diff > 0.01) { // Only update for meaningful changes
            console.log(`🔊 HARDWARE VOLUME BUTTON: ${lastDetectedVolume.toFixed(3)} → ${systemVolume.toFixed(3)}`);
            
            // Update our app's volume state to match system volume
            setVolumeState(systemVolume);
            
            // Also update the player volume to match
            if (player && 'volume' in player) {
              (player as any).volume = systemVolume;
            }
            
            lastDetectedVolume = systemVolume;
          }
        }
        

        
      } catch (error) {
        if (monitorCount % 100 === 0) {
          console.log('System volume monitor error:', error);
        }
      }
    };
    
    // Check every 100ms when playing
    const interval = setInterval(monitorSystemVolume, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying, volume]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const dismissAlarm = useCallback(() => {
    setIsAlarmRinging(false);
    setSleepCircle(null); // Clear the sleep circle so alarm doesn't re-trigger
    try {
      alarmPlayer.pause();
      alarmPlayer.seekTo(0);
    } catch (error) {
      console.warn('Failed to stop alarm', error);
    }
  }, [alarmPlayer]);

  const triggerAlarm = useCallback(() => {
    setIsAlarmRinging(true);
    try {
      alarmPlayer.seekTo(0);
      alarmPlayer.loop = true;
      alarmPlayer.play();
    } catch (error) {
      console.warn('Failed to play alarm', error);
    }
  }, [alarmPlayer]);

  const value = useMemo(
    () => ({
      selectedTrackId,
      isPlaying,
      error,
      volume,
      sleepCircle,
      isAlarmRinging,
      selectTrack,
      togglePlayback,
      play,
      pause,
      setVolume,
      setSleepCircle,
      triggerAlarm,
      dismissAlarm,
    }),
    [error, isPlaying, pause, play, selectTrack, selectedTrackId, togglePlayback, volume, setVolume, sleepCircle, isAlarmRinging, triggerAlarm, dismissAlarm]
  );

  return <AmbientAudioContext.Provider value={value}>{children}</AmbientAudioContext.Provider>;
}

export function useAmbientAudio() {
  const context = useContext(AmbientAudioContext);
  if (!context) {
    throw new Error('useAmbientAudio must be used within an AmbientAudioProvider');
  }

  return context;
}
