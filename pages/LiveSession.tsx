
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Metronome } from '../components/Metronome';
import { UploadProgress } from '../components/UploadProgress';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { Recording, Mood } from '../types';
import { TagInput } from '../components/TagInput';
import { MOOD_OPTIONS } from '../constants';
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
    const { state, refreshData } = useAppContext();
    
    const [topic, setTopic] = useState<string | null>(null);
    const [time, setTime] = useState(0);
    const [notes, setNotes] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    
    // Practice session details
    const [topics, setTopics] = useState<string[]>([]);
    const [link, setLink] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // Video recording state
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<{
        videoInputs: MediaDeviceInfo[];
        audioInputs: MediaDeviceInfo[];
        audioOutputs: MediaDeviceInfo[];
    }>({ videoInputs: [], audioInputs: [], audioOutputs: [] });
    const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
    const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
    const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
    const [videoQuality, setVideoQuality] = useState<'480p' | '720p' | '1080p'>('720p');
    const [frameRate, setFrameRate] = useState<number>(30);
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

    // Load available media devices
    useEffect(() => {
        const loadDevices = async () => {
            try {
                // Request permissions first
                await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
                
                setAvailableDevices({ videoInputs, audioInputs, audioOutputs });
                
                // Set default selections
                if (videoInputs.length > 0) setSelectedVideoInput(videoInputs[0].deviceId);
                if (audioInputs.length > 0) setSelectedAudioInput(audioInputs[0].deviceId);
                if (audioOutputs.length > 0) setSelectedAudioOutput(audioOutputs[0].deviceId);
                
            } catch (error) {
                console.error('Error accessing media devices:', error);
            }
        };
        
        loadDevices();
        
        // Listen for device changes
        navigator.mediaDevices.addEventListener('devicechange', loadDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    }, []);

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

    const getVideoConstraints = () => {
        const constraints: MediaTrackConstraints = {
            deviceId: selectedVideoInput ? { exact: selectedVideoInput } : undefined,
            frameRate: frameRate
        };
        
        switch (videoQuality) {
            case '480p':
                constraints.width = { ideal: 640 };
                constraints.height = { ideal: 480 };
                break;
            case '720p':
                constraints.width = { ideal: 1280 };
                constraints.height = { ideal: 720 };
                break;
            case '1080p':
                constraints.width = { ideal: 1920 };
                constraints.height = { ideal: 1080 };
                break;
        }
        
        return constraints;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: getVideoConstraints(),
                audio: {
                    deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined
                }
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
                setShowPreviewModal(true);
                
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
        setShowPreviewModal(false);
    };
    
    const keepRecording = () => {
        setShowPreviewModal(false);
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
        if (!state.user) return;
        
        setIsSaving(true);
        let recordings: Recording[] = [];
        
        // Upload recording if exists
        if (previewUrl && recordedChunks.length > 0) {
            try {
                recordings = await uploadRecording();
                setSessionRecordings(recordings);
            } catch (error) {
                if (!window.confirm('Failed to upload recording. Continue without saving the recording?')) {
                    setIsSaving(false);
                    setUploadingFiles(false);
                    return;
                }
            }
        }
        
        setUploadingFiles(false);
        
        // Save practice session directly to database
        try {
            // Split topics into songs (from repertoire) and techniques (everything else)
            const repertoireTitles = state.repertoire.map(r => r.title.toLowerCase());
            const songs = topics.filter(topic => 
                repertoireTitles.includes(topic.toLowerCase())
            );
            const techniques = topics.filter(topic => 
                !repertoireTitles.includes(topic.toLowerCase())
            );
            
            const sessionData = {
                user_id: state.user.uid,
                date: new Date().toISOString().split('T')[0],
                duration: Math.max(1, Math.round(time / 60)),
                mood: 'Good', // Default mood since field is required
                techniques: techniques,
                songs: topic ? [topic, ...songs.filter(s => s !== topic)] : songs,
                notes: notes,
                tags: [], // Empty tags array since field exists in DB
                recordings: recordings,
                link: link
            };
            
            const { error } = await supabase
                .from('practice_sessions')
                .insert([sessionData]);
            
            if (error) throw error;
            
            // Update repertoire last_practiced if this was a song
            if (topic) {
                const matchingSong = state.repertoire.find(item => 
                    item.title.toLowerCase() === topic.toLowerCase()
                );
                
                if (matchingSong) {
                    await supabase
                        .from('repertoire')
                        .update({ last_practiced: new Date().toISOString() })
                        .eq('id', matchingSong.id);
                }
            }
            
            await refreshData();
            navigate('/');
        } catch (error) {
            console.error('Error saving practice session:', error);
            alert('Failed to save practice session. Please try again.');
        } finally {
            setIsSaving(false);
        }
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
                            disabled={uploadingFiles || isSaving}
                        >
                            {uploadingFiles ? 'Uploading...' : isSaving ? 'Saving...' : 'Finish'}
                        </button>
                    </div>
                </div>
                
                {/* Video Recording Section */}
                <div className="mt-8 border-t border-border pt-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 text-center">📹 Practice Recording</h3>
                    
                    {/* Recording Settings */}
                    {!isRecording && (
                        <div className="mb-6 bg-background p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-text-secondary mb-3">Recording Settings</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Video Input */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Camera</label>
                                    <select 
                                        value={selectedVideoInput}
                                        onChange={(e) => setSelectedVideoInput(e.target.value)}
                                        className="w-full bg-surface p-2 rounded text-xs border border-border"
                                    >
                                        {availableDevices.videoInputs.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Audio Input */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Microphone</label>
                                    <select 
                                        value={selectedAudioInput}
                                        onChange={(e) => setSelectedAudioInput(e.target.value)}
                                        className="w-full bg-surface p-2 rounded text-xs border border-border"
                                    >
                                        {availableDevices.audioInputs.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Video Quality */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Quality</label>
                                    <select 
                                        value={videoQuality}
                                        onChange={(e) => setVideoQuality(e.target.value as '480p' | '720p' | '1080p')}
                                        className="w-full bg-surface p-2 rounded text-xs border border-border"
                                    >
                                        <option value="480p">480p (640x480)</option>
                                        <option value="720p">720p (1280x720)</option>
                                        <option value="1080p">1080p (1920x1080)</option>
                                    </select>
                                </div>
                                
                                {/* Frame Rate */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Frame Rate</label>
                                    <select 
                                        value={frameRate}
                                        onChange={(e) => setFrameRate(Number(e.target.value))}
                                        className="w-full bg-surface p-2 rounded text-xs border border-border"
                                    >
                                        <option value={15}>15 FPS</option>
                                        <option value={24}>24 FPS</option>
                                        <option value={30}>30 FPS</option>
                                        <option value={60}>60 FPS</option>
                                    </select>
                                </div>
                                
                                {/* Audio Output */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Speakers</label>
                                    <select 
                                        value={selectedAudioOutput}
                                        onChange={(e) => setSelectedAudioOutput(e.target.value)}
                                        className="w-full bg-surface p-2 rounded text-xs border border-border"
                                    >
                                        {availableDevices.audioOutputs.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Speaker ${device.deviceId.slice(0, 8)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    
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
                        {!isRecording && !showPreviewModal && (
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
                        
                        {previewUrl && !showPreviewModal && (
                            <button 
                                onClick={() => setShowPreviewModal(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
                            >
                                📹 Review Recording
                            </button>
                        )}
                    </div>
                    
                    {previewUrl && !showPreviewModal && (
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

                {/* Practice Session Details */}
                <div className="mt-8 border-t border-border pt-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4 text-center">📝 Session Details</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Link (optional)</label>
                            <input 
                                type="url" 
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                What did you practice? {topic && <span className="text-xs">({topic} is already included)</span>}
                            </label>
                            <TagInput 
                                values={topics}
                                onChange={setTopics}
                                suggestions={[
                                    ...state.repertoire.map(r => r.title),
                                    'Alternate Picking', 'Sweep Picking', 'Legato', 'Tapping',
                                    'Bending', 'Vibrato', 'Slides', 'Hammer-ons', 'Pull-offs',
                                    'Palm Muting', 'Fingerpicking', 'Tremolo', 'Harmonics',
                                    'Scales', 'Chords', 'Arpeggios', 'Rhythm', 'Lead'
                                ]}
                                placeholder="Add songs, techniques, concepts (press Enter)"
                            />
                        </div>
                    </div>
                </div>
                
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
        
        {/* Video Preview Modal */}
        {showPreviewModal && previewUrl && (
            <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4">
                <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-border">
                        <h2 className="text-xl font-bold text-text-primary">📹 Review Your Recording</h2>
                        <button 
                            onClick={() => setShowPreviewModal(false)}
                            className="text-text-secondary hover:text-text-primary text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface transition-all"
                        >
                            &times;
                        </button>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-auto">
                        <div className="mb-4">
                            <video 
                                className="w-full rounded-lg border border-border bg-black"
                                controls
                                src={previewUrl}
                                style={{ aspectRatio: '16/9' }}
                            />
                        </div>
                        
                        <p className="text-text-secondary text-center mb-6">
                            Review your recording and decide if you want to keep it or record again.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button 
                                onClick={keepRecording}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition-all"
                            >
                                ✅ Keep This Recording
                            </button>
                            <button 
                                onClick={clearRecording}
                                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-md transition-all"
                            >
                                🔄 Record Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
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
