
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { GuitarRecorder } from '../components/GuitarRecorder';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';

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
    const [recordingPath, setRecordingPath] = useState<string>('');
    
    // Google Doc Embedding
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [showGoogleDoc, setShowGoogleDoc] = useState(false);
    
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

    const handleFinishSession = async () => {
        navigate('/log', { 
            state: { 
                topic: topic, 
                duration: Math.max(1, Math.round(time / 60)),
                notes: notes,
                link: sessionLink,
                recordingPath: recordingPath
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

                {/* Guitar Recorder */}
                <GuitarRecorder 
                    topic={topic}
                    autoSave={false}
                    onRecordingSaved={(path) => setRecordingPath(path)}
                />
                
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
