import { useEffect, useRef, useState } from 'react';

interface SoundtrackManagerProps {
  mood: string | undefined;
  intensity: number | undefined;
  genre: string | null;
  volume: number;
  volumeMusic?: number;
  isMuted: boolean;
}

const TRACKS: Record<string, string> = {
  romance_low: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 
  romance_high: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 
  crime_low: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 
  crime_high: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 
  paranormal_low: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 
  paranormal_high: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 
  default: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
};

export function SoundtrackManager({ mood, intensity, genre, volume, volumeMusic, isMuted }: SoundtrackManagerProps) {
  const audioContext = useRef<AudioContext | null>(null);
  const currentSource = useRef<AudioBufferSourceNode | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const isLoading = useRef(false);

  const effectiveVolume = volumeMusic !== undefined ? volumeMusic : volume;

  useEffect(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (!gainNode.current && audioContext.current) {
      gainNode.current = audioContext.current.createGain();
      gainNode.current.connect(audioContext.current.destination);
    }
    
    return () => {
      if (currentSource.current) {
        currentSource.current.stop();
      }
    };
  }, []);

  const getTrackUrl = () => {
    if (!genre) return TRACKS.default;
    const level = (intensity || 3) > 3 ? 'high' : 'low';
    const key = `${genre}_${level}`;
    return TRACKS[key] || TRACKS.default;
  };

  const playTrack = async (url: string) => {
    if (!audioContext.current || !gainNode.current) return;
    if (currentTrackUrl === url || isLoading.current) return;

    isLoading.current = true;

    if (audioContext.current.state === 'suspended') {
      try {
        await audioContext.current.resume();
      } catch (e) {
        console.warn('Could not resume audio context:', e);
      }
    }

    // Fade out previous
    const now = audioContext.current.currentTime;
    const fadeOutDuration = 1.5;
    if (gainNode.current) {
      gainNode.current.gain.linearRampToValueAtTime(0.001, now + fadeOutDuration);
    }

    try {
      const proxiedUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxiedUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('audio') && !contentType.includes('application/octet-stream')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);

      // Stop previous source safely
      if (currentSource.current) {
        try {
          currentSource.current.stop(now + fadeOutDuration);
        } catch (e) {
          // Already stopped or not started
        }
      }

      // Create new source
      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      const newGain = audioContext.current.createGain();
      newGain.gain.value = 0;
      source.connect(newGain);
      newGain.connect(audioContext.current.destination);

      source.start(now + fadeOutDuration);
      newGain.gain.linearRampToValueAtTime(isMuted ? 0 : (effectiveVolume / 100), now + fadeOutDuration + 1.5);

      currentSource.current = source;
      gainNode.current = newGain;
      setCurrentTrackUrl(url);
    } catch (err) {
      console.error(`Soundtrack error [${url}]:`, err);
    } finally {
      isLoading.current = false;
    }
  };

  useEffect(() => {
    const url = getTrackUrl();
    playTrack(url);
  }, [genre, mood, intensity]);

  useEffect(() => {
    if (gainNode.current && audioContext.current) {
      const now = audioContext.current.currentTime;
      gainNode.current.gain.linearRampToValueAtTime(isMuted ? 0 : (effectiveVolume / 100), now + 0.5);
    }
  }, [effectiveVolume, isMuted]);

  return null;
}
