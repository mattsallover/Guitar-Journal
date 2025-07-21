
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { AudioPlayer } from '../components/AudioPlayer';

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
    const [sessionLink, setSessionLink] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    
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

    const handleFinishSession = () => {
        navigate('/log', { 
            state: { 
                topic: topic, 
                duration: Math.max(1, Math.round(time / 60)), // ensure duration is at least 1 minute
                notes: notes,
                link: sessionLink
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
        </div>
    );
};
