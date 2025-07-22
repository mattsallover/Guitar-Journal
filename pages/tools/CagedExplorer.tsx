import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { Modal } from '../../components/Modal';
import { CagedShape, Note, CAGEDSession } from '../../types';
import { CAGED_SHAPES, ALL_NOTES, GUITAR_TUNING } from '../../constants';
import { supabase } from '../../services/supabase';
import { computeCAGEDScore, getAccuracyLabel, getScoreColor, formatTime } from '../../utils/cagedUtils';
import { compressVideo, compressImage, formatFileSize } from '../../utils/mediaUtils';
import { aiService, AICoachingResponse } from '../../services/aiService';

// Helper to get the name of a note at a specific fret and string
const getNoteNameOnFret = (stringIndex: number, fret: number): Note => {
    const openNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[stringIndex]);
    const finalNoteIndex = (openNoteIndex + fret) % 12;
    return ALL_NOTES[finalNoteIndex];
};

// Helper to find the first fret position of a given note on a string
const getNotePosition = (noteToFind: Note, stringIndex: number): number => {
    const openStringNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[stringIndex]);
    const targetNoteIndex = ALL_NOTES.indexOf(noteToFind);
    let fret = targetNoteIndex - openStringNoteIndex;
    if (fret < 0) fret += 12;
    return fret;
};

export const CagedExplorer: React.FC = () => {
    const { state } = useAppContext();
    const [rootNote, setRootNote] = useState<Note>('C');
    const [cagedShape, setCagedShape] = useState<CagedShape>('C');
    const [mode, setMode] = useState<'explore' | 'quiz-session' | 'quiz-question' | 'quiz-answer'>('explore');
    
    // Quiz Session State
    const [quizTimer, setQuizTimer] = useState(0);
    const [quizInterval, setQuizInterval] = useState<number | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<{ root: Note; shape: CagedShape }[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [completedShapes, setCompletedShapes] = useState<string[]>([]);
    
    // Session Logging State
    const [sessions, setSessions] = useState<CAGEDSession[]>([]);
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [currentSession, setCurrentSession] = useState<Partial<CAGEDSession> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    
    // AI Mode State
    const [isAIMode, setIsAIMode] = useState(false);
    const [aiCoaching, setAiCoaching] = useState<AICoachingResponse | null>(null);
    const [isAILoading, setIsAILoading] = useState(false);
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');

    useEffect(() => {
        if (state.user) {
            fetchSessions();
        }
    }, [state.user]);

    // Load AI coaching when sessions change and AI mode is on
    useEffect(() => {
        if (isAIMode && sessions.length >= 3) {
            loadAICoaching();
        }
    }, [isAIMode, sessions]);
    useEffect(() => {
        return () => {
            if (quizInterval) {
                clearInterval(quizInterval);
            }
        };
    }, [quizInterval]);

    const fetchSessions = async () => {
        if (!state.user) return;
        
        try {
            const { data, error } = await supabase
                .from('caged_sessions')
                .select('*')
                .eq('user_id', state.user.uid)
                .order('session_date', { ascending: false })
                .limit(5);

            if (error) throw error;

            const mappedSessions: CAGEDSession[] = data.map(row => ({
                id: row.id,
                userId: row.user_id,
                sessionDate: row.session_date,
                shapes: row.shapes,
                accuracy: row.accuracy,
                timeSeconds: row.time_seconds,
                score: row.score,
                notes: row.notes || '',
                recording: row.recording || '',
                createdAt: row.created_at,
            }));

            setSessions(mappedSessions);
        } catch (error) {
            console.error('Error fetching CAGED sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const highlightedNotes = useMemo(() => {
        const shapeInfo = CAGED_SHAPES[cagedShape];
        const rootInterval = shapeInfo.intervals.find(i => i.type === 'R')!;
        
        let rootFret = getNotePosition(rootNote, rootInterval.string);
        while(rootFret < rootInterval.fret) {
            rootFret += 12;
        }

        const fretOffset = rootFret - rootInterval.fret;

        return shapeInfo.intervals.map(interval => {
            const finalFret = interval.fret + fretOffset;
            const noteName = getNoteNameOnFret(interval.string, finalFret);
            const color = interval.type === 'R' ? 'bg-red-500' : 'bg-black';
            
            return {
                string: interval.string,
                fret: finalFret,
                color,
                label: noteName
            };
        });
    }, [rootNote, cagedShape]);
    
    const currentQuestion = quizQuestions[currentQuestionIndex];
    
    const quizAnswerNotes = useMemo(() => {
        if (!currentQuestion) return [];
        const shapeInfo = CAGED_SHAPES[currentQuestion.shape];
        const rootInterval = shapeInfo.intervals.find(i => i.type === 'R')!;

        let rootFret = getNotePosition(currentQuestion.root, rootInterval.string);
        while(rootFret < rootInterval.fret) {
            rootFret += 12;
        }
        
        const fretOffset = rootFret - rootInterval.fret;

        return shapeInfo.intervals.map(interval => {
            const finalFret = interval.fret + fretOffset;
            const noteName = getNoteNameOnFret(interval.string, finalFret);
            const color = interval.type === 'R' ? 'bg-red-500' : 'bg-black';
            
            return {
                string: interval.string,
                fret: finalFret,
                color,
                label: noteName
            };
        });
    }, [currentQuestion]);

    const startQuizSession = () => {
        // Generate 5 random questions (one for each CAGED shape)
        const shapes: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];
        const questions = shapes.map(shape => ({
            root: ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)],
            shape
        }));
        
        setQuizQuestions(questions);
        setCurrentQuestionIndex(0);
        setCorrectAnswers(0);
        setCompletedShapes([]);
        setQuizTimer(0);
        setMode('quiz-session');
        
        // Start timer
        const interval = window.setInterval(() => {
            setQuizTimer(time => time + 1);
        }, 1000);
        setQuizInterval(interval);
    };

    const handleCorrectAnswer = () => {
        const shape = currentQuestion.shape;
        setCorrectAnswers(prev => prev + 1);
        setCompletedShapes(prev => [...prev, shape]);
        
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setMode('quiz-session');
        } else {
            // Quiz complete - stop timer and show results
            if (quizInterval) {
                clearInterval(quizInterval);
                setQuizInterval(null);
            }
            showQuizResults();
        }
    };

    const handleIncorrectAnswer = () => {
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setMode('quiz-session');
        } else {
            // Quiz complete - stop timer and show results
            if (quizInterval) {
                clearInterval(quizInterval);
                setQuizInterval(null);
            }
            showQuizResults();
        }
    };

    const handleCompleteSession = () => {
        // Stop timer
        if (quizInterval) {
            clearInterval(quizInterval);
            setQuizInterval(null);
        }
        showQuizResults();
    };

    const showQuizResults = () => {
        // Calculate accuracy based on questions actually answered
        const questionsAnswered = Math.max(currentQuestionIndex + 1, 1); // At least 1 to avoid division by zero
        const accuracyRatio = correctAnswers / questionsAnswered;
        const accuracy = Math.round(accuracyRatio * 4) + 1; // Convert to 1-5 scale
        
        const score = computeCAGEDScore({
            shapes: completedShapes,
            accuracy,
            time_seconds: quizTimer
        });

        setCurrentSession({
            sessionDate: new Date().toISOString().split('T')[0],
            shapes: completedShapes,
            accuracy,
            timeSeconds: quizTimer,
            score,
            notes: `Quiz session: ${correctAnswers}/${questionsAnswered} correct answers (${questionsAnswered}/${quizQuestions.length} questions completed)`
        });
        setIsSessionModalOpen(true);
    };

    const handleReveal = () => {
        setMode('quiz-answer');
    };

    const openSessionModal = (session: Partial<CAGEDSession> | null = null) => {
        setCurrentSession(session || {
            sessionDate: new Date().toISOString().split('T')[0],
            shapes: [],
            accuracy: 3,
            timeSeconds: 0,
            notes: ''
        });
        setSelectedFile(null);
        setIsSessionModalOpen(true);
    };

    const closeSessionModal = () => {
        setIsSessionModalOpen(false);
        setCurrentSession(null);
        setSelectedFile(null);
        setMode('explore');
    };

    const handleSaveSession = async () => {
        if (!currentSession || !state.user) {
            alert('Please complete the session details');
            return;
        }

        setIsSaving(true);

        try {
            // Upload recording if provided
            let recordingPath = currentSession.recording || '';
            
            if (selectedFile) {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) throw new Error('Authentication error');

                // Compress file if needed
                let processedFile = selectedFile;
                if (selectedFile.type.startsWith('video/')) {
                    processedFile = await compressVideo(selectedFile, { 
                        maxWidth: 1280, 
                        maxHeight: 720, 
                        quality: 0.7,
                        maxSizeMB: 25 
                    });
                } else if (selectedFile.type.startsWith('image/')) {
                    processedFile = await compressImage(selectedFile, {
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.8,
                        maxSizeMB: 5
                    });
                }

                const fileName = `caged-${Date.now()}-${processedFile.name}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('recordings')
                    .upload(filePath, processedFile);

                if (uploadError) throw uploadError;
                recordingPath = filePath;
            }

            // Calculate final score
            const score = computeCAGEDScore({
                shapes: currentSession.shapes || [],
                accuracy: currentSession.accuracy || 3,
                time_seconds: currentSession.timeSeconds || 0
            });

            const sessionData = {
                user_id: state.user.uid,
                session_date: currentSession.sessionDate,
                shapes: currentSession.shapes || [],
                accuracy: currentSession.accuracy || 3,
                time_seconds: currentSession.timeSeconds || 0,
                score,
                notes: currentSession.notes || '',
                recording: recordingPath
            };

            if (currentSession.id) {
                const { error } = await supabase
                    .from('caged_sessions')
                    .update(sessionData)
                    .eq('id', currentSession.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('caged_sessions')
                    .insert([sessionData]);
                if (error) throw error;
            }

            await fetchSessions();
            closeSessionModal();
        } catch (error) {
            console.error('Error saving CAGED session:', error);
            alert('Failed to save session. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSession = async (session: CAGEDSession) => {
        if (!window.confirm('Are you sure you want to delete this CAGED session?')) return;

        try {
            if (session.recording) {
                await supabase.storage
                    .from('recordings')
                    .remove([session.recording]);
            }

            const { error } = await supabase
                .from('caged_sessions')
                .delete()
                .eq('id', session.id);

            if (error) throw error;
            await fetchSessions(); // This will now refresh CAGED sessions too
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete session. Please try again.');
        }
    };
    
    const notesToDisplay = mode === 'explore' ? highlightedNotes : mode === 'quiz-answer' ? quizAnswerNotes : [];

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const averageStats = sessions.length > 0 ? {
        avgScore: Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length),
        avgTime: Math.round(sessions.reduce((sum, s) => sum + s.timeSeconds, 0) / sessions.length),
        bestScore: Math.max(...sessions.map(s => s.score)),
        bestTime: Math.min(...sessions.filter(s => s.timeSeconds > 0).map(s => s.timeSeconds))
    } : null;

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">CAGED System Explorer</h1>
                <p className="text-text-secondary">Master chord shapes with interactive exploration and timed quizzes</p>
            </div>
            
            {/* Performance Stats - Micro Cards */}
            {averageStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div className="bg-surface/50 backdrop-blur-sm border border-border/30 p-3 rounded-xl text-center hover:bg-surface/80 transition-all duration-300 hover:scale-[1.02] group">
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-200">🧠</div>
                        <div className="text-xl font-bold text-primary">{averageStats.avgScore}</div>
                        <div className="text-xs text-text-secondary">Avg Score</div>
                    </div>
                    <div className="bg-surface/50 backdrop-blur-sm border border-border/30 p-3 rounded-xl text-center hover:bg-surface/80 transition-all duration-300 hover:scale-[1.02] group">
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-200">⏱️</div>
                        <div className="text-xl font-bold text-primary">{formatTime(averageStats.avgTime)}</div>
                        <div className="text-xs text-text-secondary">Avg Time</div>
                    </div>
                    <div className="bg-surface/50 backdrop-blur-sm border border-border/30 p-3 rounded-xl text-center hover:bg-surface/80 transition-all duration-300 hover:scale-[1.02] group">
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-200">💯</div>
                        <div className="text-xl font-bold text-green-400">{averageStats.bestScore}</div>
                        <div className="text-xs text-text-secondary">Best Score</div>
                    </div>
                    <div className="bg-surface/50 backdrop-blur-sm border border-border/30 p-3 rounded-xl text-center hover:bg-surface/80 transition-all duration-300 hover:scale-[1.02] group">
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-200">⚡</div>
                        <div className="text-xl font-bold text-green-400">{formatTime(averageStats.bestTime)}</div>
                        <div className="text-xs text-text-secondary">Best Time</div>
                    </div>
                </div>
            )}
            
            {/* AI Assistant Panel - Only show if user has enough data */}
            {hasEnoughDataForAI && (
                <div className="mt-6">
                    {!isAIMode && (
                        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 p-4 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="text-2xl">🤖</div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-blue-300">AI Coach Available</h3>
                                        <p className="text-sm text-blue-200/80">Get personalized CAGED insights and coaching</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAIMode(true)}
                                    className="bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105"
                                >
                                    Enable AI Coach
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {isAIMode && (
                        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-sm border border-blue-400/30 rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-4 border-b border-blue-400/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xl">🤖</span>
                                        <h3 className="text-lg font-bold text-blue-100">AI CAGED Coach</h3>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-xs text-green-300 font-medium">ACTIVE</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setShowAIPanel(!showAIPanel)}
                                            className="text-blue-200 hover:text-blue-100 transition-colors duration-200"
                                        >
                                            <span className={`transform transition-transform duration-200 ${showAIPanel ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setIsAIMode(false)}
                                            className="text-blue-200 hover:text-red-300 transition-colors duration-200"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className={`transition-all duration-300 ${showAIPanel ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                <div className="p-4 space-y-4">
                                    {/* AI Coaching Content */}
                                    {isAILoading && (
                                        <div className="flex items-center justify-center p-8">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-blue-200">AI Coach is analyzing your CAGED performance...</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {aiCoaching && !isAILoading && (
                                        <div className="space-y-4">
                                            {/* Main Coaching Message */}
                                            <div className="bg-blue-950/50 border border-blue-400/20 p-4 rounded-lg">
                                                <h4 className="text-blue-200 font-semibold mb-2 flex items-center">
                                                    <span className="text-lg mr-2">💡</span>
                                                    AI Insights
                                                </h4>
                                                <p className="text-blue-100 leading-relaxed">{aiCoaching.coaching}</p>
                                            </div>
                                            
                                            {/* Recommendations */}
                                            {aiCoaching.recommendations.length > 0 && (
                                                <div className="bg-purple-950/50 border border-purple-400/20 p-4 rounded-lg">
                                                    <h4 className="text-purple-200 font-semibold mb-3 flex items-center">
                                                        <span className="text-lg mr-2">🎯</span>
                                                        Practice Recommendations
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {aiCoaching.recommendations.map((rec, index) => (
                                                            <li key={index} className="text-purple-100 flex items-start">
                                                                <span className="text-purple-300 mr-2">•</span>
                                                                {rec}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {/* Musical Insights */}
                                            {aiCoaching.insights.length > 0 && (
                                                <div className="bg-green-950/50 border border-green-400/20 p-4 rounded-lg">
                                                    <h4 className="text-green-200 font-semibold mb-3 flex items-center">
                                                        <span className="text-lg mr-2">🎵</span>
                                                        Musical Insights
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {aiCoaching.insights.map((insight, index) => (
                                                            <li key={index} className="text-green-100 flex items-start">
                                                                <span className="text-green-300 mr-2">•</span>
                                                                {insight}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Music Theory Q&A */}
                                    <div className="bg-indigo-950/50 border border-indigo-400/20 p-4 rounded-lg">
                                        <h4 className="text-indigo-200 font-semibold mb-3 flex items-center">
                                            <span className="text-lg mr-2">❓</span>
                                            Ask About CAGED Theory
                                        </h4>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={aiQuestion}
                                                onChange={(e) => setAiQuestion(e.target.value)}
                                                placeholder="e.g., 'Why is the G shape harder than E shape?'"
                                                className="flex-1 bg-indigo-900/30 border border-indigo-400/30 rounded-lg px-3 py-2 text-indigo-100 placeholder-indigo-300/50 focus:border-indigo-400 focus:outline-none"
                                                onKeyPress={(e) => e.key === 'Enter' && handleAIQuestion()}
                                                disabled={isAILoading}
                                            />
                                            <button
                                                onClick={handleAIQuestion}
                                                disabled={isAILoading || !aiQuestion.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:scale-100"
                                            >
                                                Ask
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Quick Actions */}
                                    <div className="flex space-x-2 pt-2">
                                        <button
                                            onClick={() => loadAICoaching()}
                                            disabled={isAILoading}
                                            className="flex-1 bg-blue-600/80 hover:bg-blue-600 disabled:bg-blue-800 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:scale-100"
                                        >
                                            🔄 Refresh Insights
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {!hasEnoughDataForAI && (
                <div className="mt-6 bg-gray-800/50 border border-gray-600/30 p-4 rounded-xl text-center">
                    <div className="text-3xl mb-2">🎯</div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-1">AI Coach Coming Soon</h3>
                    <p className="text-sm text-gray-400">
                        Complete {3 - sessions.length} more CAGED session{3 - sessions.length !== 1 ? 's' : ''} to unlock personalized AI coaching
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Main Fretboard */}
                <div className="xl:col-span-3 order-2 xl:order-1">
                    <Fretboard 
                        highlightedNotes={notesToDisplay}
                        onFretClick={undefined}
                    />
                </div>
                
                {/* Control Panel - Sticky on larger screens */}
                <div className="order-1 xl:order-2 xl:sticky xl:top-4 space-y-6">
                    {mode === 'explore' && (
                        <>
                            {/* Shape Explorer Card */}
                            <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-5 rounded-xl shadow-lg">
                                <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center">
                                    <span className="text-xl mr-2">🎛️</span>
                                    Shape Explorer
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">Root Note</label>
                                        <select 
                                            value={rootNote} 
                                            onChange={e => setRootNote(e.target.value as Note)} 
                                            className="w-full bg-background/50 backdrop-blur-sm border border-border/60 p-3 rounded-lg text-text-primary hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                                        >
                                            {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">CAGED Shape</label>
                                        <select 
                                            value={cagedShape} 
                                            onChange={e => setCagedShape(e.target.value as CagedShape)} 
                                            className="w-full bg-background/50 backdrop-blur-sm border border-border/60 p-3 rounded-lg text-text-primary hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                                        >
                                            {Object.keys(CAGED_SHAPES).map(s => <option key={s} value={s}>{s} Shape</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* Legend */}
                                    <div className="flex items-center justify-center space-x-6 pt-3 border-t border-border/30">
                                        <div className="flex items-center text-sm">
                                            <div className="w-4 h-4 rounded-full bg-red-500 mr-2 ring-1 ring-white/70"></div>
                                            <span className="text-text-secondary">Root</span>
                                        </div>
                                        <div className="flex items-center text-sm">
                                            <div className="w-4 h-4 rounded-full bg-black mr-2 ring-1 ring-white/70"></div>
                                            <span className="text-text-secondary">Interval</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons Card */}
                            <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-5 rounded-xl shadow-lg">
                                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                                    <span className="text-xl mr-2">🎯</span>
                                    Practice Mode
                                </h3>
                                <div className="space-y-3">
                                    <button 
                                        onClick={startQuizSession} 
                                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
                                    >
                                        <span className="text-lg mr-2">🎯</span>
                                        Start Timed Quiz
                                    </button>
                                    <button 
                                        onClick={() => openSessionModal()} 
                                        className="w-full bg-gradient-to-r from-secondary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
                                    >
                                        <span className="text-lg mr-2">📝</span>
                                        Log Manual Session
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {mode === 'quiz-session' && currentQuestion && (
                        <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-5 rounded-xl shadow-lg">
                            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center">
                                <span className="text-xl mr-2">⏱️</span>
                                Quiz Session
                            </h2>
                            <div className="text-center space-y-4">
                                <div className="bg-background/50 p-4 rounded-lg">
                                    <div className="text-3xl font-mono font-bold text-primary mb-2">
                                        {formatTime(quizTimer)}
                                    </div>
                                    <div className="text-sm text-text-secondary">
                                        Question {currentQuestionIndex + 1} of {quizQuestions.length} • Correct: {correctAnswers}
                                    </div>
                                </div>
                                
                                <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg">
                                    <p className="text-sm text-text-secondary mb-1">Find on your guitar:</p>
                                    <p className="text-xl font-bold text-primary mb-1">{currentQuestion.root} Major</p>
                                    <p className="text-sm text-text-secondary mb-1">using the</p>
                                    <p className="text-xl font-bold text-primary">{currentQuestion.shape} Shape</p>
                                </div>
                                
                                <div className="space-y-2">
                                    <button 
                                        onClick={handleReveal} 
                                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        💡 Show Answer
                                    </button>
                                    <button 
                                        onClick={handleCompleteSession} 
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-sm"
                                    >
                                        🏁 Complete Early
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {mode === 'quiz-answer' && currentQuestion && (
                        <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-5 rounded-xl shadow-lg">
                            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center">
                                <span className="text-xl mr-2">💡</span>
                                Answer Revealed
                            </h2>
                            <div className="text-center space-y-4">
                                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                                    <p className="text-green-400 font-bold">
                                        {currentQuestion.root} Major ({currentQuestion.shape} shape)
                                    </p>
                                </div>
                                
                                <div>
                                    <p className="text-text-secondary mb-3 text-sm">Did you get it right?</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={handleCorrectAnswer} 
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
                                        >
                                            <span className="text-lg mr-1">✅</span>
                                            Yes
                                        </button>
                                        <button 
                                            onClick={handleIncorrectAnswer} 
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
                                        >
                                            <span className="text-lg mr-1">❌</span>
                                            No
                                        </button>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={handleCompleteSession} 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] text-sm"
                                >
                                    🏁 Complete Early
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-6 flex items-center">
                        <span className="text-2xl mr-3">📊</span>
                        Recent Sessions
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sessions.map(session => (
                            <div key={session.id} className="bg-surface/80 backdrop-blur-sm border border-border/50 p-4 rounded-xl hover:bg-surface transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-sm font-medium text-text-secondary">
                                            {new Date(session.sessionDate).toLocaleDateString()}
                                        </h3>
                                        <div className="flex items-center space-x-3 mt-1">
                                            <div className={`text-lg font-bold ${getScoreColor(session.score)}`}>
                                                {session.score}/100
                                            </div>
                                            <div className="text-text-secondary text-sm">
                                                {formatTime(session.timeSeconds)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <button 
                                            onClick={() => openSessionModal(session)} 
                                            className="text-xs text-primary hover:text-primary-hover"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteSession(session)} 
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Shape Tags */}
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {session.shapes.map(shape => (
                                        <span key={shape} className="inline-block bg-primary/20 border border-primary/30 text-primary px-2 py-1 rounded-full text-xs font-medium">
                                            {shape}
                                        </span>
                                    ))}
                                </div>
                                
                                {/* Accuracy Badge */}
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-text-secondary">
                                        {getAccuracyLabel(session.accuracy)}
                                    </div>
                                    {/* Optional: Mini trend indicator */}
                                    <div className="text-xs text-green-400 flex items-center">
                                        📈
                                    </div>
                                </div>
                                
                                {session.notes && (
                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <p className="text-xs text-text-primary line-clamp-2">{session.notes}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Session Modal */}
            {isSessionModalOpen && currentSession && (
                <Modal 
                    isOpen={isSessionModalOpen} 
                    onClose={closeSessionModal} 
                    title={currentSession.id ? "Edit CAGED Session" : "Save CAGED Session"}
                >
                    <div className="space-y-4">
                        {/* Show quiz results if coming from quiz */}
                        {currentSession.score && (
                            <div className="bg-background p-4 rounded-md">
                                <h3 className="text-lg font-bold mb-2">Quiz Results</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className={`text-2xl font-bold ${getScoreColor(currentSession.score)}`}>
                                            {currentSession.score}/100
                                        </div>
                                        <div className="text-sm text-text-secondary">Score</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-primary">
                                            {formatTime(currentSession.timeSeconds || 0)}
                                        </div>
                                        <div className="text-sm text-text-secondary">Time</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-primary">
                                            {currentSession.shapes?.length || 0}/5
                                        </div>
                                        <div className="text-sm text-text-secondary">Shapes</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Notes (optional)</label>
                            <textarea 
                                value={currentSession.notes || ''} 
                                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })}
                                className="w-full bg-background p-2 rounded-md border border-border h-20"
                                placeholder="Any observations, difficulties, or improvements..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Recording (optional)</label>
                            <input 
                                type="file" 
                                accept="audio/*,video/*" 
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                            {selectedFile && (
                                <p className="text-xs text-text-secondary mt-1">
                                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            <button 
                                onClick={closeSessionModal} 
                                disabled={isSaving}
                                className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveSession} 
                                disabled={isSaving}
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};