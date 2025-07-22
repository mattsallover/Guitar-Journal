
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { UploadProgress } from '../components/UploadProgress';
import { Recording } from '../types';
import { compressVideo, generateVideoThumbnail } from '../utils/mediaUtils';
import { supabase } from '../services/supabase';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

export const LiveSession: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    const [topic, setTopic] = useState<string | null>(null);
    const [time, setTime] = useState(0);
    const [notes, setNotes] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    
    // Video recording state
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [uploadProgressData, setUploadProgressData] = useState<Array<{
        name: string;
        progress: number;
        status: 'uploading' | 'compressing' | 'completed' | 'error';
        error?: string;
        originalSize?: number;
        compressedSize?: number;
    }>>([]);
    const [sessionRecordings, setSessionRecordings] = useState<Recording[]>([]);
    
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

    // Cleanup effect for media resources
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [previewUrl, mediaStream]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            setMediaStream(stream);
            
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus'
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
                setPreviewUrl(url);
                setRecordedChunks([blob]);
                
                // Stop the stream
                stream.getTracks().forEach(track => track.stop());
                setMediaStream(null);
            };
            
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            
            // Show live preview
            const videoElement = document.getElementById('recordingVideo') as HTMLVideoElement;
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Failed to access camera/microphone. Please check your permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setMediaRecorder(null);
            setIsRecording(false);
            
            // Clear live preview
            const videoElement = document.getElementById('recordingVideo') as HTMLVideoElement;
            if (videoElement) {
                videoElement.srcObject = null;
            }
        }
    };

    const clearRecording = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setRecordedChunks([]);
    };

    const uploadRecording = async (): Promise<Recording[]> => {
        if (recordedChunks.length === 0) return [];
        
        setUploadingFiles(true);
        const recordings: Recording[] = [];
        
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('Authentication error');
            
            const blob = recordedChunks[0];
            const originalFile = new File([blob], `practice-recording-${Date.now()}.webm`, { type: 'video/webm' });
            
            // Update progress for compression
            setUploadProgressData([{
                name: originalFile.name,
                progress: 0,
                status: 'compressing',
                originalSize: originalFile.size
            }]);
            
            // Compress video
            const compressedFile = await compressVideo(originalFile, {
                maxWidth: 1280,
                maxHeight: 720,
                quality: 0.7,
                maxSizeMB: 25
            });
            
            // Update progress for upload
            setUploadProgressData([{
                name: originalFile.name,
                progress: 50,
                status: 'uploading',
                originalSize: originalFile.size,
                compressedSize: compressedFile.size
            }]);
            
            // Upload to Supabase Storage
            const fileName = `practice-${Date.now()}-${compressedFile.name}`;
            const filePath = `${user.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('recordings')
                .upload(filePath, compressedFile);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('recordings')
                .getPublicUrl(filePath);
            
            if (!urlData?.publicUrl) throw new Error('Failed to get public URL');
            
            // Generate thumbnail
            let thumbnailUrl = '';
            try {
                const thumbnailFile = await generateVideoThumbnail(compressedFile);
                const thumbnailPath = `${user.id}/thumb-${fileName}.jpg`;
                
                const { error: thumbUploadError } = await supabase.storage
                    .from('recordings')
                    .upload(thumbnailPath, thumbnailFile);
                
                if (!thumbUploadError) {
                    const { data: thumbUrlData } = supabase.storage
                        .from('recordings')
                        .getPublicUrl(thumbnailPath);
                    
                    thumbnailUrl = thumbUrlData?.publicUrl || '';
                }
            } catch (thumbError) {
                console.warn('Failed to generate thumbnail:', thumbError);
            }
            
            const recording: Recording = {
                id: filePath,
                name: `Practice Recording - ${new Date().toLocaleString()}`,
                type: 'video',
                url: urlData.publicUrl,
                thumbnailUrl,
                originalSize: originalFile.size,
                compressedSize: compressedFile.size
            };
            
            recordings.push(recording);
            
            // Update progress to completed
            setUploadProgressData([{
                name: originalFile.name,
                progress: 100,
                status: 'completed',
                originalSize: originalFile.size,
                compressedSize: compressedFile.size
            }]);
            
        } catch (error) {
            console.error('Error uploading recording:', error);
            setUploadProgressData([{
                name: recordedChunks[0] ? `recording-${Date.now()}.webm` : 'recording.webm',
                progress: 0,
                status: 'error',
                error: 'Upload failed'
            }]);
            throw error;
        }
        
        return recordings;
    };

    const handleFinishSession = async () => {
        let recordings: Recording[] = [];
        
        // Upload recording if exists
        if (recordedChunks.length > 0) {
            try {
                recordings = await uploadRecording();
                setSessionRecordings(recordings);
            } catch (error) {
                if (!window.confirm('Failed to upload recording. Continue without saving the recording?')) {
                    setUploadingFiles(false);
                    return;
                }
            }
        }
        
        setUploadingFiles(false);
        
        navigate('/log', { 
            state: { 
                topic: topic, 
                duration: Math.max(1, Math.round(time / 60)), // ensure duration is at least 1 minute
                notes: notes,
                recordings: recordings
            } 
        });
    };

    if (!topic) {
        return null; // or a loading spinner
    }

    return (
        <>
        <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-full bg-slate-900 overflow-y-auto">
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
                            disabled={uploadingFiles}
                        >
                            {uploadingFiles ? 'Saving...' : 'Finish'}
                        </button>
                    </div>
                </div>
                
                {/* Video Recording Section */}
                <div className="mt-8 border-t border-border pt-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 text-center">📹 Practice Recording</h3>
                    
                    {/* Video Element */}
                    <div className="mb-4 flex justify-center">
                        <video 
                            id="recordingVideo"
                            className="w-full max-w-md rounded-lg border border-border bg-black"
                            style={{ aspectRatio: '16/9' }}
                            autoPlay
                            muted
                            playsInline
                            src={previewUrl || undefined}
                        />
                    </div>
                    
                    {/* Recording Controls */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {!isRecording && !previewUrl && (
                            <button 
                                onClick={startRecording}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                            >
                                <span className="w-3 h-3 bg-white rounded-full"></span>
                                <span>Start Recording</span>
                            </button>
                        )}
                        
                        {isRecording && (
                            <button 
                                onClick={stopRecording}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2 animate-pulse"
                            >
                                <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                                <span>Stop Recording</span>
                            </button>
                        )}
                        
                        {previewUrl && (
                            <>
                                <button 
                                    onClick={clearRecording}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md"
                                >
                                    Clear & Re-record
                                </button>
                            </>
                        )}
                    </div>
                    
                    {previewUrl && (
                        <p className="text-center text-sm text-green-400 mt-2">
                            ✅ Recording ready! It will be uploaded when you finish the session.
                        </p>
                    )}
                    
                    {isRecording && (
                        <p className="text-center text-sm text-red-400 mt-2">
                            🔴 Recording in progress...
                        </p>
                    )}
                </div>
                
                <Metronome />

                <div className="mt-8 text-left">
                    <label className="block text-sm font-medium text-text-secondary mb-2">Session Notes (optional)</label>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Jot down any thoughts or discoveries..."
                        className="w-full bg-background p-3 rounded-md border border-border h-28"
                    ></textarea>
                </div>
            </div>
        </div>
        
        {/* Upload Progress Modal */}
        {uploadingFiles && (
            <UploadProgress 
                files={uploadProgressData}
                onCancel={() => {
                    setUploadingFiles(false);
                    setUploadProgressData([]);
                }}
            />
        )}
        </>
    );
};
