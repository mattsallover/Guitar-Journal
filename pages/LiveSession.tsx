import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { supabase } from '../services/supabase';
import YouTube from 'react-youtube';
import { compressVideo, formatFileSize } from '../utils/mediaUtils';
import { UploadProgress } from '../components/UploadProgress';
import { PlaylistManager } from '../components/PlaylistManager';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

// Extract YouTube video ID from URL
const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Convert Google Drive sharing URL to embeddable URL
const convertGoogleDriveUrl = (url: string): string => {
    // Convert sharing URL to preview URL
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
        return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
    return url;
};

export const LiveSession: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    const [topic, setTopic] = useState<string | null>(null);
    const [time, setTime] = useState(0);
    const [notes, setNotes] = useState('');
    const [sessionLink, setSessionLink] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    
    // YouTube player state
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [youtubeId, setYoutubeId] = useState<string | null>(null);
    const [showYouTube, setShowYouTube] = useState(false);
    const [showPlaylistManager, setShowPlaylistManager] = useState(false);
    
    // Google Doc state
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [embedDocUrl, setEmbedDocUrl] = useState('');
    const [showGoogleDoc, setShowGoogleDoc] = useState(false);
    const [docLoadError, setDocLoadError] = useState(false);
    
    // Camera recording state
    const [isRecording, setIsRecording] = useState(false);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Camera/audio device selection
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState<{
        name: string;
        progress: number;
        status: 'uploading' | 'compressing' | 'completed' | 'error';
        error?: string;
        originalSize?: number;
        compressedSize?: number;
    }[]>([]);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const recordedVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (location.state?.topic) {
            setTopic(location.state.topic);
        } else {
            navigate('/');
        }
    }, [location.state, navigate]);

    useEffect(() => {
        let timer: number | undefined;
        if (!isPaused) {
            timer = window.setInterval(() => {
                setTime(t => t + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isPaused]);

    // Cleanup media stream on unmount
    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [mediaStream]);

    // Get available media devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                
                setVideoDevices(videoInputs);
                setAudioDevices(audioInputs);
                
                // Set default devices if none selected
                if (!selectedVideoDeviceId && videoInputs.length > 0) {
                    setSelectedVideoDeviceId(videoInputs[0].deviceId);
                }
                if (!selectedAudioDeviceId && audioInputs.length > 0) {
                    setSelectedAudioDeviceId(audioInputs[0].deviceId);
                }
            } catch (error) {
                console.error('Error enumerating devices:', error);
            }
        };

        getDevices();
    }, [selectedVideoDeviceId, selectedAudioDeviceId]);

    // Handle YouTube URL input
    const handleYouTubeUrlChange = (url: string) => {
        setYoutubeUrl(url);
        const id = extractYouTubeId(url);
        setYoutubeId(id);
    };

    // Handle Google Doc URL input
    const handleGoogleDocUrlChange = (url: string) => {
        setGoogleDocUrl(url);
        if (url) {
            const embedUrl = convertGoogleDriveUrl(url);
            setEmbedDocUrl(embedUrl);
            setDocLoadError(false);
        } else {
            setEmbedDocUrl('');
        }
    };

    // Start camera
    const startCamera = async () => {
        try {
            setCameraError(null);
            
            const constraints: MediaStreamConstraints = {
                video: selectedVideoDeviceId ? {
                    deviceId: { exact: selectedVideoDeviceId },
                    width: 1280,
                    height: 720
                } : { width: 1280, height: 720 },
                audio: selectedAudioDeviceId ? {
                    deviceId: { exact: selectedAudioDeviceId }
                } : true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setShowCamera(true);
        } catch (error) {
            console.error('Error accessing camera:', error);
            setCameraError('Could not access camera. Please check permissions.');
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            setMediaStream(null);
        }
        setShowCamera(false);
        setIsRecording(false);
    };

    // Start recording
    const startRecording = () => {
        if (!mediaStream) return;

        const recorder = new MediaRecorder(mediaStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            setRecordedChunks(chunks);
            
            // Create preview of recorded video
            const blob = new Blob(chunks, { type: 'video/webm' });
            if (recordedVideoRef.current) {
                recordedVideoRef.current.src = URL.createObjectURL(blob);
            }
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    // Upload recorded video
    const uploadRecordedVideo = async (): Promise<string | null> => {
        if (recordedChunks.length === 0) return null;

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('Authentication error');

            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const originalFile = new File([blob], `session-recording-${Date.now()}.webm`, { type: 'video/webm' });
            
            // Update upload progress
            const fileProgress = {
                name: originalFile.name,
                progress: 0,
                status: 'compressing' as const,
                originalSize: originalFile.size
            };
            setUploadProgress([fileProgress]);

            // Compress video
            const compressedFile = await compressVideo(originalFile, {
                maxWidth: 1280,
                maxHeight: 720,
                quality: 0.7,
                maxSizeMB: 25
            });

            fileProgress.progress = 50;
            fileProgress.status = 'uploading';
            fileProgress.compressedSize = compressedFile.size;
            setUploadProgress([{ ...fileProgress }]);

            // Upload to Supabase Storage
            const fileName = `session-${Date.now()}-${compressedFile.name}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('recordings')
                .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            fileProgress.progress = 100;
            fileProgress.status = 'completed';
            setUploadProgress([{ ...fileProgress }]);

            return filePath;
        } catch (error) {
            console.error('Error uploading video:', error);
            setUploadProgress(prev => prev.map(p => ({ ...p, status: 'error' as const, error: 'Upload failed' })));
            return null;
        }
    };

    const handleFinishSession = async () => {
        setIsUploading(true);
        
        try {
            // Upload recorded video if exists
            let recordingPath: string | null = null;
            if (recordedChunks.length > 0) {
                recordingPath = await uploadRecordedVideo();
            }

            // Navigate to log with all session data
            navigate('/log', { 
                state: { 
                    topic: topic, 
                    duration: Math.max(1, Math.round(time / 60)),
                    notes: notes,
                    link: sessionLink,
                    youtubeId: youtubeId,
                    recordingPath: recordingPath
                } 
            });
        } catch (error) {
            console.error('Error finishing session:', error);
            alert('Error saving session. Please try again.');
        } finally {
            setIsUploading(false);
            setUploadProgress([]);
        }
    };

    const handlePlaylistVideoSelect = (videoId: string, title: string) => {
        setYoutubeId(videoId);
        setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);
        setShowYouTube(true);
    };

    if (!topic) {
        return null;
    }

    return (
        <div className="p-8 flex flex-col min-h-full bg-slate-900 overflow-y-auto">
            {/* Upload Progress Modal */}
            {isUploading && uploadProgress.length > 0 && (
                <UploadProgress files={uploadProgress} />
            )}

            <div className="w-full max-w-7xl mx-auto">
                {/* Main Practice Section */}
                <div className="bg-surface p-6 sm:p-8 rounded-xl shadow-2xl mb-6">
                    <div className="text-center mb-6">
                        <p className="text-text-secondary">NOW PRACTICING</p>
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary my-4 break-words">{topic}</h1>
                        
                        <div className="my-8 sm:my-10 font-mono text-7xl sm:text-8xl text-text-primary tracking-widest">
                            {formatTime(time)}
                        </div>

                        <div className="flex justify-center space-x-4">
                            <button 
                                onClick={() => setIsPaused(!isPaused)}
                                className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-10 rounded-md w-36 sm:w-40"
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button 
                                onClick={handleFinishSession}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-md w-36 sm:w-40"
                                disabled={isUploading}
                            >
                                {isUploading ? 'Saving...' : 'Finish'}
                            </button>
                        </div>
                    </div>
                    
                    <Metronome />
                </div>

                {/* Resource Controls */}
                <div className="bg-surface p-6 rounded-xl shadow-2xl mb-6">
                    <h2 className="text-xl font-bold text-text-primary mb-4">Practice Resources</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <button
                            onClick={() => setShowYouTube(!showYouTube)}
                            className={`p-3 rounded-md font-semibold transition-colors ${
                                showYouTube ? 'bg-red-600 text-white' : 'bg-background hover:bg-border text-text-primary'
                            }`}
                        >
                            📺 {showYouTube ? 'Hide YouTube' : 'Show YouTube'}
                        </button>
                        
                        <button
                            onClick={() => setShowPlaylistManager(true)}
                            className="bg-background hover:bg-border text-text-primary p-3 rounded-md font-semibold transition-colors"
                        >
                            📋 Practice Playlists
                        </button>
                        
                        <button
                            onClick={() => setShowGoogleDoc(!showGoogleDoc)}
                            className={`p-3 rounded-md font-semibold transition-colors ${
                                showGoogleDoc ? 'bg-blue-600 text-white' : 'bg-background hover:bg-border text-text-primary'
                            }`}
                        >
                            📄 {showGoogleDoc ? 'Hide Google Doc' : 'Show Google Doc'}
                        </button>
                        
                        <button
                            onClick={() => showCamera ? stopCamera() : startCamera()}
                            className={`p-3 rounded-md font-semibold transition-colors ${
                                showCamera ? 'bg-green-600 text-white' : 'bg-background hover:bg-border text-text-primary'
                            }`}
                        >
                            📹 {showCamera ? 'Stop Camera' : 'Start Camera'}
                        </button>
                    </div>

                    {/* YouTube URL Input */}
                    {showYouTube && (
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-text-secondary">
                                    YouTube URL
                                </label>
                                <button
                                    onClick={() => setShowPlaylistManager(true)}
                                    className="text-xs text-primary hover:underline"
                                >
                                    📋 Load from Playlist
                                </button>
                            </div>
                            <input
                                type="url"
                                value={youtubeUrl}
                                onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full bg-background p-3 rounded-md border border-border"
                            />
                        </div>
                    )}

                    {/* Google Doc URL Input */}
                    {showGoogleDoc && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Google Doc/Drive URL
                                <span className="text-xs text-text-secondary block mt-1">
                                    For best results, use "Share" → "Anyone with link can view" and copy the link
                                </span>
                            </label>
                            <input
                                type="url"
                                value={googleDocUrl}
                                onChange={(e) => handleGoogleDocUrlChange(e.target.value)}
                                placeholder="https://docs.google.com/document/... or Google Drive link"
                                className="w-full bg-background p-3 rounded-md border border-border"
                            />
                        </div>
                    )}

                    {/* Camera Device Selection */}
                    {showCamera && (
                        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Camera Device
                                </label>
                                <select
                                    value={selectedVideoDeviceId}
                                    onChange={e => setSelectedVideoDeviceId(e.target.value)}
                                    className="w-full bg-background p-2 rounded-md border border-border text-sm"
                                    disabled={isRecording || mediaStream}
                                >
                                    {videoDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Microphone
                                </label>
                                <select
                                    value={selectedAudioDeviceId}
                                    onChange={e => setSelectedAudioDeviceId(e.target.value)}
                                    className="w-full bg-background p-2 rounded-md border border-border text-sm"
                                    disabled={isRecording || mediaStream}
                                >
                                    {audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Camera Error Display */}
                    {cameraError && (
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-md text-red-400 text-sm">
                            {cameraError}
                        </div>
                    )}
                </div>

                {/* Resource Display Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* YouTube Player */}
                    {showYouTube && youtubeId && (
                        <div className="bg-surface p-6 rounded-xl shadow-2xl">
                            <h3 className="text-lg font-bold text-text-primary mb-4">📺 YouTube Video</h3>
                            <div className="aspect-video">
                                <YouTube
                                    videoId={youtubeId}
                                    opts={{
                                        width: '100%',
                                        height: '100%',
                                        playerVars: {
                                            autoplay: 0,
                                        },
                                    }}
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Google Doc Viewer */}
                    {showGoogleDoc && embedDocUrl && (
                        <div className="bg-surface p-6 rounded-xl shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-text-primary">📄 Document</h3>
                                <a 
                                    href={googleDocUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                >
                                    Open in New Tab
                                </a>
                            </div>
                            <div className="aspect-[3/4] border border-border rounded-md overflow-hidden">
                                {!docLoadError ? (
                                    <iframe
                                        src={embedDocUrl}
                                        className="w-full h-full"
                                        onError={() => setDocLoadError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-background text-text-secondary">
                                        <div className="text-center">
                                            <p className="mb-2">Could not embed document</p>
                                            <a 
                                                href={googleDocUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                Open in New Tab →
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Camera Section */}
                    {showCamera && (
                        <div className="bg-surface p-6 rounded-xl shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-text-primary">📹 Camera</h3>
                                <div className="flex space-x-2">
                                    {!isRecording && (
                                        <button
                                            onClick={startRecording}
                                            disabled={!mediaStream}
                                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                                        >
                                            ● Record
                                        </button>
                                    )}
                                    {isRecording && (
                                        <button
                                            onClick={stopRecording}
                                            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                                        >
                                            ■ Stop
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Live camera feed */}
                            <div className="aspect-video bg-black rounded-md overflow-hidden mb-2">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            
                            {/* Recording status */}
                            {isRecording && (
                                <div className="flex items-center justify-center text-red-400 text-sm">
                                    <span className="animate-pulse mr-2">●</span>
                                    Recording in progress...
                                </div>
                            )}
                            
                            {/* Recorded video preview */}
                            {recordedChunks.length > 0 && !isRecording && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-text-secondary mb-2">Recorded Video Preview:</h4>
                                    <video
                                        ref={recordedVideoRef}
                                        controls
                                        className="w-full max-h-32 bg-black rounded"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Session Notes - Always Visible */}
                <div className="mt-6 bg-surface p-6 rounded-xl shadow-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Session Notes</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Jot down any thoughts, discoveries, or challenges..."
                                className="w-full bg-background p-3 rounded-md border border-border h-24"
                            ></textarea>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Instructor Link (optional)
                                <span className="text-xs text-text-secondary block mt-1">Link to lesson notes, assignments, etc.</span>
                            </label>
                            <input 
                                type="url"
                                value={sessionLink}
                                onChange={(e) => setSessionLink(e.target.value)}
                                placeholder="https://docs.google.com/..."
                                className="w-full bg-background p-3 rounded-md border border-border"
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Playlist Manager Modal */}
            <PlaylistManager
                isOpen={showPlaylistManager}
                onClose={() => setShowPlaylistManager(false)}
                onVideoSelect={handlePlaylistVideoSelect}
            />
        </div>
    );
};