import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { Modal } from '../../components/Modal';
import { CagedShape, Note, CAGEDSession } from '../../types';
import { CAGED_SHAPES, ALL_NOTES, GUITAR_TUNING } from '../../constants';
import { supabase } from '../../services/supabase';
import { computeCAGEDScore, getAccuracyLabel, getScoreColor, formatTime } from '../../utils/cagedUtils';
import { compressVideo, compressImage, formatFileSize } from '../../utils/mediaUtils';

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

    useEffect(() => {
        if (state.user) {
            fetchSessions();
        }
    }, [state.user]);

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
            await refreshData(); // This will now refresh CAGED sessions too
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
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">CAGED System Explorer & Practice</h1>
            
            {/* Stats Overview */}
            {averageStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-primary">{averageStats.avgScore}</div>
                        <div className="text-sm text-text-secondary">Avg Score</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-primary">{formatTime(averageStats.avgTime)}</div>
                        <div className="text-sm text-text-secondary">Avg Time</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{averageStats.bestScore}</div>
                        <div className="text-sm text-text-secondary">Best Score</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{formatTime(averageStats.bestTime)}</div>
                        <div className="text-sm text-text-secondary">Best Time</div>
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Fretboard 
                        highlightedNotes={notesToDisplay}
                        onFretClick={undefined}
                    />
                </div>
                
                <div className="bg-gray-900 p-6 rounded-lg shadow-xl">
                    {mode === 'explore' && (
                        <>
                            <h2 className="text-xl font-semibold mb-4">Explorer</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">Root Note</label>
                                    <select value={rootNote} onChange={e => setRootNote(e.target.value as Note)} className="w-full bg-surface p-2 rounded-md border border-border">
                                        {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary">CAGED Shape</label>
                                    <select value={cagedShape} onChange={e => setCagedShape(e.target.value as CagedShape)} className="w-full bg-surface p-2 rounded-md border border-border">
                                        {Object.keys(CAGED_SHAPES).map(s => <option key={s} value={s}>{s} Shape</option>)}
                                    </select>
                                </div>
                                <div className="flex space-x-4 pt-4">
                                    <div className="flex items-center"><div className="w-5 h-5 rounded-full bg-red-500 mr-2 ring-1 ring-white/70"></div>Root</div>
                                    <div className="flex items-center"><div className="w-5 h-5 rounded-full bg-black mr-2 ring-1 ring-white/70"></div>Interval</div>
                                </div>
                            </div>

                            <div className="mt-6 space-y-2">
                                <button onClick={startQuizSession} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-md">
                                    🎯 Start Timed Quiz Session
                                </button>
                                <button onClick={() => openSessionModal()} className="w-full bg-secondary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                                    📝 Log Manual Session
                                </button>
                            </div>
                        </>
                    )}
                    
                    {mode === 'quiz-session' && currentQuestion && (
                         <>
                            <h2 className="text-xl font-semibold mb-4">Quiz Session</h2>
                            <div className="text-center">
                                <div className="text-2xl font-mono font-bold text-primary mb-4">
                                    {formatTime(quizTimer)}
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-text-secondary">Question {currentQuestionIndex + 1} of {quizQuestions.length}</p>
                                    <p className="text-sm text-text-secondary">Correct: {correctAnswers}/{Math.max(currentQuestionIndex, 1)}</p>
                                </div>
                            </div>
                            
                            <div className="text-center bg-surface p-4 rounded-md">
                                <p className="text-text-secondary">Find on your guitar:</p>
                                <p className="text-2xl font-bold text-primary my-2">{currentQuestion.root} Major</p>
                                <p className="text-text-secondary">using the</p>
                                <p className="text-2xl font-bold text-primary my-2">{currentQuestion.shape} shape</p>
                            </div>
                            
                            <div className="mt-6 space-y-2">
                                <button onClick={handleReveal} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md">
                                    Show Answer
                                </button>
                                <button onClick={handleCompleteSession} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md">
                                    Complete Session Early
                                </button>
                            </div>
                        </>
                    )}
                    
                    {mode === 'quiz-answer' && currentQuestion && (
                        <>
                            <h2 className="text-xl font-semibold mb-4">Answer</h2>
                            <div className="text-center bg-surface p-4 rounded-md">
                                <p className="text-text-primary font-semibold">This is {currentQuestion.root} Major ({currentQuestion.shape} shape)</p>
                            </div>
                            
                            <div className="mt-6 text-center">
                                <p className="text-text-secondary mb-3">Did you get it right?</p>
                                <div className="flex space-x-2">
                                    <button onClick={handleCorrectAnswer} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-2 rounded-md transition-colors text-sm">
                                        ✅ Correct
                                    </button>
                                    <button onClick={handleIncorrectAnswer} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-2 rounded-md transition-colors text-sm">
                                        ❌ Wrong
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-4">
                                <button onClick={handleCompleteSession} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md">
                                    Complete Session Early
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">Recent Sessions</h2>
                    <div className="space-y-3">
                        {sessions.map(session => (
                            <div key={session.id} className="bg-surface p-4 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-4 mb-2">
                                            <h3 className="text-lg font-semibold">
                                                {new Date(session.sessionDate).toLocaleDateString()}
                                            </h3>
                                            <div className={`text-xl font-bold ${getScoreColor(session.score)}`}>
                                                {session.score}/100
                                            </div>
                                            <div className="text-text-secondary">
                                                {formatTime(session.timeSeconds)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-4 mb-2">
                                            <div className="flex space-x-1">
                                                <span className="text-sm text-text-secondary">Shapes:</span>
                                                {session.shapes.map(shape => (
                                                    <span key={shape} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">
                                                        {shape}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-sm text-text-secondary">
                                                Accuracy: {getAccuracyLabel(session.accuracy)}
                                            </div>
                                        </div>

                                        {session.notes && (
                                            <p className="text-text-primary text-sm">{session.notes}</p>
                                        )}
                                    </div>
                                    
                                    <div className="flex space-x-2 ml-4">
                                        <button 
                                            onClick={() => openSessionModal(session)} 
                                            className="text-sm text-primary hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteSession(session)} 
                                            className="text-sm text-red-400 hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
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