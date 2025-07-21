
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { AudioPlayer } from '../components/AudioPlayer';
import { UploadProgress } from '../components/UploadProgress';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';
import { compressVideo, generateVideoThumbnail, formatFileSize } from '../utils/mediaUtils';

interface VideoRecording {
    blob: Blob;
    url: string;
    thumbnail?: string;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

export const LiveSession: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = useAppContext();
    
    const [topic, setTopic] = useState<string | null>(null);
    const [time, setTime] = useState(0);
    const [notes, setNotes] = useState('');
    const [sessionLink, setSessionLink] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    
    // Video Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [videoRecording, setVideoRecording] = useState<VideoRecording | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    
    // Google Doc Embedding
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [showGoogleDoc, setShowGoogleDoc] = useState(false);
    
    // Upload Progress
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<any[]>([]);
    
    useEffect(() => {
        if (location.state?.topic) {
            setTopic(location.state.topic);
        } else {
            // If no topic is provided, redirect to dashboard
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

    // Initialize camera when component mounts
    useEffect(() => {
        initializeCamera();
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const initializeCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1920, min: 1920 },
                    height: { ideal: 1080, min: 1080 },
                    frameRate: { ideal: 60, min: 30 }
                },
                audio: {
                    sampleRate: 96000,
                    channelCount: 2,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    suppressLocalAudioPlayback: false
                }
            });
            setMediaStream(stream);
            setCameraError(null);
        } catch (error) {
            console.error('Error accessing camera:', error);
            setCameraError('Camera access denied or not available');
        }
    };

    const startVideoRecording = () => {
        if (!mediaStream) {
            setCameraError('No camera stream available');
            return;
        }

        try {
            const recorder = new MediaRecorder(mediaStream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 20000000, // 20 Mbps for ultra high quality
                audioBitsPerSecond: 1500000   // 1.5 Mbps for audiophile quality
            });
            
            const chunks: Blob[] = [];
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setVideoRecording({ blob, url });
                setRecordedChunks(chunks);
            };
            
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordedChunks([]);
        } catch (error) {
            console.error('Error starting recording:', error);
            setCameraError('Failed to start recording');
        }
    };

    const stopVideoRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const uploadVideoRecording = async (recording: VideoRecording): Promise<string | null> => {
        if (!state.user || !recording.blob) return null;

        try {
            setIsUploading(true);
            setUploadProgress([{
                name: 'practice-video.webm',
                progress: 25,
                status: 'uploading',
                originalSize: recording.blob.size
            }]);

            // Generate filename
            const timestamp = Date.now();
            const fileName = `practice-session-${timestamp}.webm`;
            const filePath = `${state.user.uid}/${fileName}`;

            // Upload FULL QUALITY - NO COMPRESSION
            const { error: uploadError } = await supabase.storage
                .from('recordings')
                .upload(filePath, recording.blob);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('recordings')
                .getPublicUrl(filePath);

            setUploadProgress([{
                name: 'practice-video.webm',
                progress: 100,
                status: 'completed',
                originalSize: recording.blob.size
            }]);

            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress([]);
            }, 2000);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading video:', error);
            setUploadProgress([{
                name: 'practice-video.webm',
                progress: 0,
                status: 'error',
                error: 'Upload failed',
                originalSize: recording.blob.size
            }]);
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress([]);
            }, 3000);
            return null;
        }
    };

    const handleFinishSession = async () => {
        let recordings: any[] = [];
        
        // Upload video recording if exists
        if (videoRecording) {
            const videoUrl = await uploadVideoRecording(videoRecording);
            if (videoUrl) {
                recordings.push({
                    id: `video-${Date.now()}`,
                    name: 'Practice Session Recording',
                    type: 'video',
                    url: videoUrl,
                    originalSize: videoRecording.blob.size
                });
            }
        }
        
        navigate('/log', { 
            state: { 
                topic: topic, 
                duration: Math.max(1, Math.round(time / 60)),
                notes: notes,
                link: sessionLink,
                recordings: recordings
            } 
        });
    };


    if (!topic) {
        return null; // or a loading spinner
    }

    return (
        <div className="p-8 flex flex-col items-center justify-center min-h-full bg-slate-900 overflow-y-auto">
            <div className="w-full max-w-2xl bg-surface p-6 sm:p-8 rounded-xl shadow-2xl">
                <div className="text-center">
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
                        >
                            Finish
                        </button>
                    </div>
                </div>
                
                {/* Video Recording Suite */}
                <div className="mt-8 bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl border border-gray-700 shadow-2xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center text-white">
                        <span className="mr-3 text-2xl">🎬</span>
                        Professional Recording Studio
                        <div className="ml-auto text-sm bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/30">
                            Ultra HD • 96kHz Audio
                        </div>
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Camera Preview */}
                        <div className="space-y-4">
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-xl border border-gray-600">
                                {cameraError ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                                        <div className="text-center">
                                            <div className="text-4xl mb-3">📷</div>
                                            <p className="text-sm text-gray-300">{cameraError}</p>
                                            <button 
                                                onClick={initializeCamera}
                                                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                            >
                                                🔄 Retry Camera Access
                                            </button>
                                        </div>
                                    </div>
                                ) : mediaStream ? (
                                    <video
                                        ref={(video) => {
                                            if (video && mediaStream) {
                                                video.srcObject = mediaStream;
                                            }
                                        }}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                                        <div className="text-center">
                                            <div className="animate-spin text-4xl mb-3">🎥</div>
                                            <p className="text-sm text-gray-300">Initializing professional camera...</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Recording indicator */}
                                {isRecording && (
                                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg border border-red-400">
                                        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                        <span className="text-sm font-bold tracking-wide">● RECORDING</span>
                                    </div>
                                )}
                                
                                {/* Quality indicator */}
                                <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    1920×1080 • 60fps
                                </div>
                            </div>
                            
                            {/* Recording Controls */}
                            <div className="flex justify-center space-x-4">
                                {!isRecording ? (
                                    <button
                                        onClick={startVideoRecording}
                                        disabled={!mediaStream || cameraError !== null}
                                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg flex items-center space-x-3 shadow-lg transition-all hover:scale-105 disabled:hover:scale-100"
                                    >
                                        <div className="w-4 h-4 bg-white rounded-full"></div>
                                        <span className="text-lg">Start Recording</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopVideoRecording}
                                        className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-8 rounded-lg flex items-center space-x-3 shadow-lg transition-all hover:scale-105"
                                    >
                                        <div className="w-4 h-4 bg-white"></div>
                                        <span className="text-lg">Stop Recording</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Recording Preview/Playback */}
                        <div className="space-y-4">
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-xl border border-gray-600">
                                {videoRecording ? (
                                    <video
                                        src={videoRecording.url}
                                        controls
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                                        <div className="text-center">
                                            <div className="text-4xl mb-3">🎬</div>
                                            <p className="text-sm">Recording will appear here</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {videoRecording && (
                                <div className="text-center bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                    <p className="text-sm text-blue-300 font-semibold">
                                        🎯 Ultra HD Recording: {formatFileSize(videoRecording.blob.size)}
                                    </p>
                                    <p className="text-xs text-blue-200 mt-1">
                                        Full quality preserved • No compression • Professional grade
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Google Doc Viewer */}
                <div className="mt-8 bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <span className="mr-2">📄</span>
                        Lesson Materials
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="flex space-x-2">
                            <input
                                type="url"
                                value={googleDocUrl}
                                onChange={(e) => setGoogleDocUrl(e.target.value)}
                                placeholder="Paste Google Doc embed URL or /preview link..."
                                className="flex-1 bg-surface p-2 rounded-md border border-border text-sm"
                            />
                            <button
                                onClick={() => setShowGoogleDoc(!showGoogleDoc)}
                                disabled={!googleDocUrl}
                                className="bg-primary hover:bg-primary-hover disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-md"
                            >
                                {showGoogleDoc ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        
                        <div className="text-xs text-text-secondary">
                            <p>💡 Tip: For Google Docs, use "File → Publish to the web" and copy the embed link, or add "/preview" to the end of a sharing link</p>
                        </div>
                        
                        {showGoogleDoc && googleDocUrl && (
                            <div className="relative bg-white rounded-lg overflow-hidden" style={{ height: '400px' }}>
                                <iframe
                                    src={googleDocUrl}
                                    className="w-full h-full border-0"
                                    title="Lesson Materials"
                                    onError={() => {
                                        console.warn('Failed to load Google Doc iframe');
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                <Metronome />

                {/* Audio Player Section */}
                <div className="mt-8 bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <span className="mr-2">🎵</span>
                        Practice Audio
                    </h3>
                    
                    {!audioFile ? (
                        <div className="text-center p-6 border-2 border-dashed border-border rounded-lg">
                            <div className="mb-4">
                                <svg className="mx-auto h-12 w-12 text-text-secondary" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p className="text-text-secondary mb-4">Upload backing track or song to practice with</p>
                            <label className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md cursor-pointer">
                                Choose Audio File
                                <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setAudioFile(file);
                                    }}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-xs text-text-secondary mt-2">MP3, WAV, M4A, and other audio formats supported</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">🎵</span>
                                    <div>
                                        <p className="font-medium text-text-primary truncate max-w-xs" title={audioFile.name}>
                                            {audioFile.name}
                                        </p>
                                        <p className="text-xs text-text-secondary">
                                            {(audioFile.size / (1024 * 1024)).toFixed(1)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAudioFile(null)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    Remove
                                </button>
                            </div>
                            <AudioPlayer audioFile={audioFile} />
                        </div>
                    )}
                </div>
                <div className="mt-8 text-left space-y-4">
                    <label className="block text-sm font-medium text-text-secondary mb-2">Session Notes (optional)</label>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Jot down any thoughts or discoveries..."
                        className="w-full bg-background p-3 rounded-md border border-border h-28"
                    ></textarea>
                    
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Instructor Link (optional)
                            <span className="text-xs text-text-secondary block mt-1">Link to Google Doc, lesson notes, etc.</span>
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
            
            {/* Upload Progress Modal */}
            {isUploading && (
                <UploadProgress files={uploadProgress} />
            )}
        </div>
    );
};
