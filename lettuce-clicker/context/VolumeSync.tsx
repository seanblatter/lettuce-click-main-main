import { useEffect, useCallback, useState } from 'react';
import { AppState } from 'react-native';

// Hardware volume button synchronization hook
export function useHardwareVolumeSync(
  player: any, 
  isPlaying: boolean, 
  currentVolume: number,
  onVolumeChange: (volume: number) => void
) {
  const [lastKnownVolume, setLastKnownVolume] = useState(currentVolume);
  
  useEffect(() => {
    if (!isPlaying || !player) return;
    
    let syncCount = 0;
    
    const syncVolume = () => {
      try {
        syncCount++;
        
        // Method 1: Check if player volume changed (hardware buttons can affect this)
        let detectedVolume = null;
        
        if ('volume' in player) {
          detectedVolume = (player as any).volume;
        }
        
        // Method 2: For expo-audio, check status
        if (!detectedVolume && 'getStatusAsync' in player) {
          player.getStatusAsync().then((status: any) => {
            if (status?.isLoaded && typeof status.volume === 'number') {
              const statusVolume = status.volume;
              if (Math.abs(statusVolume - lastKnownVolume) > 0.02) {
                console.log(`📱 Status volume changed: ${lastKnownVolume.toFixed(3)} → ${statusVolume.toFixed(3)}`);
                setLastKnownVolume(statusVolume);
                onVolumeChange(statusVolume);
              }
            }
          }).catch(() => {
            // Ignore errors
          });
        }
        
        // If we got a direct volume reading
        if (typeof detectedVolume === 'number') {
          const volumeChange = Math.abs(detectedVolume - lastKnownVolume);
          
          if (volumeChange > 0.02) {
            console.log(`🎛️ Hardware volume detected: ${lastKnownVolume.toFixed(3)} → ${detectedVolume.toFixed(3)}`);
            setLastKnownVolume(detectedVolume);
            onVolumeChange(detectedVolume);
          }
        }
        
        // Log status periodically
        if (syncCount % 30 === 0) {
          console.log(`🔊 Volume sync check #${syncCount}: Player=${detectedVolume?.toFixed(3)}, Known=${lastKnownVolume.toFixed(3)}`);
        }
        
      } catch (error) {
        if (syncCount % 100 === 0) {
          console.error('Volume sync error:', error);
        }
      }
    };
    
    // Start monitoring immediately and check every 200ms
    const interval = setInterval(syncVolume, 200);
    
    return () => clearInterval(interval);
  }, [player, isPlaying, lastKnownVolume, onVolumeChange]);
  
  // Update last known volume when currentVolume changes externally (e.g., from UI controls)
  useEffect(() => {
    const volumeChange = Math.abs(currentVolume - lastKnownVolume);
    if (volumeChange > 0.01) {
      console.log(`🎚️ External volume change: ${lastKnownVolume.toFixed(3)} → ${currentVolume.toFixed(3)}`);
      setLastKnownVolume(currentVolume);
    }
  }, [currentVolume, lastKnownVolume]);
}