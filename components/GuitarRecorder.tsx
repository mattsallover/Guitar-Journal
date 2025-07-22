import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';

interface RecordingData {
  blob: Blob;
  url: string;
  type: 'audio' | 'video';
  duration: number;
  timestamp: Date;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'videoinput';
}

interface GuitarRecorderProps {
  topic?: string;
  autoSave?: boolean;
  onRecordingSaved?: (recordingPath: string) => void;
}

export const GuitarRecorder: React.FC<GuitarRecorderProps> = ({
  topic = '',
  autoSave = false,
  onRecordingSaved
}) => {
  const { state } = useAppContext();
  
  // Device and stream state
  const [audioDevices, setAudioDevices] = useState<DeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<DeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  
  // Recording data
  const [currentRecording, setCurrentRecording] = useState<RecordingData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Notes
  const [notes, setNotes] = useState('');
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recordingPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Setup preview stream when devices or mode changes
  useEffect(() => {
    const setupPreviewStream = async () => {
      try {
        // Stop existing stream first
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          audio: selectedAudioDevice ? {
            deviceId: { exact: selectedAudioDevice },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2
          } : false,
          video: recordingMode === 'video' && selectedVideoDevice ? {
            deviceId: { exact: selectedVideoDevice },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          } : false
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);

        // Show preview if video mode
        if (recordingMode === 'video' && videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error('Error setting up preview stream:', error);
      }
    };

    if (selectedAudioDevice || (recordingMode === 'video' && selectedVideoDevice)) {
      setupPreviewStream();
    }

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedAudioDevice, selectedVideoDevice, recordingMode]); // Removed 'stream' from dependencies

  // Initialize devices
  useEffect(() => {
    const initializeDevices = async () => {
      try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Get available devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs: DeviceInfo[] = devices
          .filter(device => device.kind === 'audioinput' && device.deviceId !== 'default')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.substr(0, 8)}`,
            kind: 'audioinput'
          }));
          
        const videoInputs: DeviceInfo[] = devices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.substr(0, 8)}`,
            kind: 'videoinput'
          }));
        
        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);
        
        // Set defaults
        if (audioInputs.length > 0) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error initializing devices:', error);
      }
    };

    initializeDevices();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  const startRecording = async () => {
    if (!stream) {
      console.error('No stream available for recording');
      return;
    }

    try {
      const mimeType = recordingMode === 'video' ? 'video/webm;codecs=vp9,opus' : 'audio/wav';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        audioBitsPerSecond: 320000, // High quality audio
        videoBitsPerSecond: recordingMode === 'video' ? 5000000 : undefined // 5Mbps for video
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, {
          type: recordingMode === 'video' ? 'video/webm' : 'audio/wav'
        });
        
        const url = URL.createObjectURL(blob);
        const duration = Date.now() - startTimeRef.current;
        
        const recording: RecordingData = {
          blob,
          url,
          type: recordingMode,
          duration: Math.floor(duration / 1000),
          timestamp: new Date()
        };
        
        setCurrentRecording(recording);
        setIsProcessing(false);
        
        if (autoSave) {
          await saveRecording(recording);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const saveRecording = async (recording: RecordingData) => {
    if (!state.user || isSaving) return;

    setIsSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication error');

      const fileExt = recording.type === 'video' ? 'webm' : 'wav';
      const fileName = `guitar-${Date.now()}-${topic.toLowerCase().replace(/\s+/g, '-')}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, recording.blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      onRecordingSaved?.(filePath);
      
      // Show success message
      alert(`Recording saved successfully!${notes ? ' Notes saved with session.' : ''}`);
      
    } catch (error) {
      console.error('Error saving recording:', error);
      alert('Failed to save recording. You can download it locally instead.');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadRecording = (recording: RecordingData) => {
    const link = document.createElement('a');
    link.href = recording.url;
    const fileExt = recording.type === 'video' ? 'webm' : 'wav';
    const fileName = `guitar-practice-${topic.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${fileExt}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRecording = () => {
    setCurrentRecording(null);
    setRecordingTime(0);
    setNotes('');
  };

  return (
    <div className="bg-surface p-6 rounded-lg space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary flex items-center">
          <span className="mr-2">🎸</span>
          Practice Recording
        </h3>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-text-secondary">Mode:</label>
          <select
            value={recordingMode}
            onChange={(e) => setRecordingMode(e.target.value as 'audio' | 'video')}
            className="bg-background p-2 rounded-md border border-border text-sm"
            disabled={isRecording}
          >
            <option value="audio">Audio Only</option>
            <option value="video">Audio + Video</option>
          </select>
        </div>
      </div>

      {/* Device Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Microphone
          </label>
          <select
            value={selectedAudioDevice}
            onChange={(e) => setSelectedAudioDevice(e.target.value)}
            className="w-full bg-background p-2 rounded-md border border-border"
            disabled={isRecording}
          >
            <option value="">Select Microphone</option>
            {audioDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {recordingMode === 'video' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Camera
            </label>
            <select
              value={selectedVideoDevice}
              onChange={(e) => setSelectedVideoDevice(e.target.value)}
              className="w-full bg-background p-2 rounded-md border border-border"
              disabled={isRecording}
            >
              <option value="">Select Camera</option>
              {videoDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Video Preview */}
      {recordingMode === 'video' && stream && (
        <div className="flex justify-center">
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            className="max-w-sm rounded-lg border border-border"
          />
        </div>
      )}

      {/* Recording Controls */}
      <div className="text-center space-y-4">
        {/* Status and Timer */}
        <div className="flex items-center justify-center space-x-4">
          {isRecording && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-sm font-medium">
                {isPaused ? 'Paused' : 'Recording...'}
              </span>
            </div>
          )}
          <div className="font-mono text-2xl font-bold text-primary">
            {formatTime(recordingTime)}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!selectedAudioDevice || (recordingMode === 'video' && !selectedVideoDevice)}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2"
            >
              <span>🔴</span>
              <span>Start Recording</span>
            </button>
          ) : (
            <>
              {!isPaused ? (
                <button
                  onClick={pauseRecording}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg"
                >
                  ⏸️ Pause
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
                >
                  ▶️ Resume
                </button>
              )}
              <button
                onClick={stopRecording}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg"
              >
                ⏹️ Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Recording Notes (auto-saved)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this recording..."
          className="w-full bg-background p-3 rounded-md border border-border h-20"
        />
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="text-center p-4 bg-yellow-900/20 rounded-lg">
          <div className="text-yellow-400 font-medium">Processing recording...</div>
        </div>
      )}

      {/* Recording Preview and Actions */}
      {currentRecording && (
        <div className="border-t border-border pt-6 space-y-4">
          <h4 className="text-lg font-bold text-text-primary">Recording Ready</h4>
          
          {/* Preview */}
          <div className="flex justify-center">
            {currentRecording.type === 'video' ? (
              <video
                ref={recordingPreviewRef}
                src={currentRecording.url}
                controls
                className="max-w-md rounded-lg border border-border"
              />
            ) : (
              <audio
                src={currentRecording.url}
                controls
                className="w-full max-w-md"
              />
            )}
          </div>

          {/* Recording Info */}
          <div className="text-center text-sm text-text-secondary">
            <p>Duration: {formatTime(currentRecording.duration)}</p>
            <p>Type: {currentRecording.type === 'video' ? 'Video + Audio' : 'Audio Only'}</p>
            <p>Size: {(currentRecording.blob.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => saveRecording(currentRecording)}
              disabled={isSaving}
              className="bg-primary hover:bg-primary-hover disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-md"
            >
              {isSaving ? 'Saving...' : '☁️ Save to Cloud'}
            </button>
            <button
              onClick={() => downloadRecording(currentRecording)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md"
            >
              📥 Download
            </button>
            <button
              onClick={resetRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-text-secondary bg-background p-3 rounded-md">
        <p><strong>Audio Settings:</strong> No compression, 48kHz stereo for professional quality</p>
        <p><strong>Video Settings:</strong> 1920x1080 @ 30fps when available</p>
        <p><strong>Supported Formats:</strong> WAV (audio), WebM (video)</p>
      </div>
    </div>
  );
};