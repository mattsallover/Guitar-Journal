import React, { useState, useEffect, useRef } from 'react';

interface AudioPlayerProps {
  audioFile: File;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFile }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [isLoading, setIsLoading] = useState(true);

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);

  // Animation frame for time updates
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    loadAudioFile();
    return () => {
      cleanup();
    };
  }, [audioFile]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const loadAudioFile = async () => {
    try {
      setIsLoading(true);
      
      // Create audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Convert file to array buffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      setCurrentTime(0);
      pauseTimeRef.current = 0;
      
    } catch (error) {
      console.error('Error loading audio file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const play = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    // Resume audio context if suspended
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    cleanup();

    // Create new source node
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = audioBufferRef.current;
    sourceNode.playbackRate.value = playbackSpeed;

    // Create gain node for volume control
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = volume;

    // Connect nodes
    sourceNode.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // Store references
    sourceNodeRef.current = sourceNode;
    gainNodeRef.current = gainNode;

    // Handle end of playback
    sourceNode.onended = () => {
      setIsPlaying(false);
      if (currentTime >= duration) {
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      }
    };

    // Start playback from current position
    const startOffset = pauseTimeRef.current;
    sourceNode.start(0, startOffset);
    startTimeRef.current = audioContextRef.current.currentTime - startOffset / playbackSpeed;
    
    setIsPlaying(true);
    updateTime();
  };

  const pause = () => {
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.stop();
      pauseTimeRef.current = currentTime;
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const stop = () => {
    cleanup();
    setIsPlaying(false);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  };

  const seek = (time: number) => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      pause();
    }
    setCurrentTime(time);
    pauseTimeRef.current = time;
    if (wasPlaying) {
      setTimeout(play, 10); // Small delay to ensure clean transition
    }
  };

  const updateTime = () => {
    if (isPlaying && audioContextRef.current && sourceNodeRef.current) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackSpeed;
      const newTime = Math.min(elapsed, duration);
      setCurrentTime(newTime);
      
      if (newTime < duration) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      }
    }
  };

  const changeSpeed = async (newSpeed: number) => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      pause();
    }
    setPlaybackSpeed(newSpeed);
    if (wasPlaying) {
      setTimeout(play, 10);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeedLabel = (speed: number) => {
    if (speed === 1) return '1x';
    return `${speed}x`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="text-text-secondary">Loading audio...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative w-full h-2 bg-background rounded-full cursor-pointer"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect();
               const x = e.clientX - rect.left;
               const width = rect.width;
               const time = (x / width) * duration;
               seek(time);
             }}>
          <div 
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={stop}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
          title="Stop"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <rect x="6" y="6" width="8" height="8" />
          </svg>
        </button>

        <button
          onClick={isPlaying ? pause : play}
          className="p-3 bg-primary hover:bg-primary-hover text-white rounded-full transition-all hover:scale-110"
          disabled={!audioBufferRef.current}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="4" width="2" height="12" />
              <rect x="12" y="4" width="2" height="12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Speed and Volume Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Speed Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Speed</label>
            <span className="text-sm font-mono text-primary">{getSpeedLabel(playbackSpeed)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-text-secondary">0.5x</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={playbackSpeed}
              onChange={(e) => changeSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-text-secondary">2x</span>
          </div>
          <div className="flex justify-center space-x-1">
            {[0.5, 0.75, 1, 1.25, 1.5].map(speed => (
              <button
                key={speed}
                onClick={() => changeSpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playbackSpeed === speed 
                    ? 'bg-primary text-white' 
                    : 'bg-background text-text-secondary hover:text-text-primary'
                }`}
              >
                {getSpeedLabel(speed)}
              </button>
            ))}
          </div>
        </div>

        {/* Volume Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Volume</label>
            <span className="text-sm font-mono text-primary">{Math.round(volume * 100)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.5 13.5H3a1 1 0 01-1-1v-3a1 1 0 011-1h1.5l3.883-3.316a1 1 0 011.617.816z" clipRule="evenodd" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.5 13.5H3a1 1 0 01-1-1v-3a1 1 0 011-1h1.5l3.883-3.316a1 1 0 011.617.816zM16 6c0-1.105-.895-2-2-2v2c0 .552-.448 1-1 1s-1-.448-1-1V4c-1.105 0-2 .895-2 2v8c0 1.105.895 2 2 2v-2c0-.552.448-1 1-1s1 .448 1 1v2c1.105 0 2-.895 2-2V6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-text-secondary">
          🎯 Pitch stays the same at any speed • Perfect for practice!
        </p>
      </div>
    </div>
  );
};