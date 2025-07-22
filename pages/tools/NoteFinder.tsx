import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { Modal } from '../../components/Modal';
import { generateNoteRecommendations, generateAIQuizSequence, analyzeNotePerformance } from '../../utils/aiRecommendations';
import { aiService, AICoachingResponse, AIExerciseRoutine } from '../../services/aiService';
import { Note, NoteFinderAttempt } from '../../types';
import { ALL_NOTES, GUITAR_TUNING } from '../../constants';
import { supabase } from '../../services/supabase';

// Helper to get the note at a specific string and fret
const getNoteAt = (stringIndex: number, fret: number): Note => {
    const openNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[stringIndex]);
    const finalNoteIndex = (openNoteIndex + fret) % 12;
    return ALL_NOTES[finalNoteIndex];
};

// Helper to shuffle array
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Quiz prompt types
type QuizPromptType = 'find-all' | 'find-any' | 'find-on-string';

// Quiz mode types
type QuizModeType = 'find-any' | 'find-all' | 'find-on-string' | 'combo';

interface QuizQuestion {
    note: Note;
    promptType: QuizPromptType;
    targetString?: number; // for 'find-on-string' mode
}

// Helper to find all positions of a note on the fretboard
const findAllNotePositions = (note: Note): Array<{ stringIndex: number; fret: number }> => {
    const positions = [];
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
        for (let fret = 0; fret <= 15; fret++) {
            if (getNoteAt(stringIndex, fret) === note) {
                positions.push({ stringIndex, fret });
            }
        }
    }
    return positions;
};
interface NoteStats {
    note: Note;
    attempts: number;
    correct: number;
    accuracy: number;
    avgTime: number;
}

export const NoteFinder: React.FC = () => {
    const { state, refreshData } = useAppContext();
    
    // AI Recommendations State
    const [aiRecommendations, setAiRecommendations] = useState<any>(null);
    const [showAIInsights, setShowAIInsights] = useState(false);
    
    // Intelligent Mode State
    const [intelligentMode, setIntelligentMode] = useState(false);
    const [aiCoaching, setAiCoaching] = useState<AICoachingResponse | null>(null);
    const [journalAnalysis, setJournalAnalysis] = useState<string>('');
    const [aiPanelExpanded, setAiPanelExpanded] = useState(false);
    const [personalizedRoutine, setPersonalizedRoutine] = useState<AIExerciseRoutine | null>(null);
    const [theoryQuestion, setTheoryQuestion] = useState('');
    const [theoryAnswer, setTheoryAnswer] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showCoaching, setShowCoaching] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [showRoutine, setShowRoutine] = useState(false);
    const [showTheory, setShowTheory] = useState(false);
    
    // Quiz State
    const [mode, setMode] = useState<'menu' | 'quiz' | 'results'>('menu');
    const [quizSequence, setQuizSequence] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [foundPositions, setFoundPositions] = useState<Set<string>>(new Set());
    const [quizResults, setQuizResults] = useState<{
        note: Note;
        promptType: QuizPromptType;
        correct: boolean;
        timeSeconds: number;
        stringNum: number;
        fretNum: number;
    }[]>([]);
    
    // Feedback State
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastClickFeedback, setLastClickFeedback] = useState<{
        clickedNote: Note;
        correct: boolean;
        expectedNote: Note;
    } | null>(null);
    
    // Per-note scoring state
    const [quizNoteStats, setQuizNoteStats] = useState<Record<Note, { correct: number; incorrect: number }>>({});
    
    // Statistics State
    const [noteStats, setNoteStats] = useState<NoteStats[]>([]);
    const [recentAttempts, setRecentAttempts] = useState<NoteFinderAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [showStatsModal, setShowStatsModal] = useState(false);

    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        if (state.user) {
            fetchNoteFinderData();
        }
    }, [state.user]);

    useEffect(() => {
        if (recentAttempts.length > 0) {
            const recommendations = generateNoteRecommendations(recentAttempts);
            setAiRecommendations(recommendations);
            
            // Auto-generate AI coaching if intelligent mode is on and we have enough data
            if (intelligentMode && recentAttempts.length >= 20) {
                generateAICoaching();
            }
        }
    }, [recentAttempts, intelligentMode]);

    const generateAICoaching = async () => {
        if (aiLoading) return;
        setAiLoading(true);
        try {
            const coaching = await aiService.generateNaturalLanguageCoaching(recentAttempts, state.goals);
            setAiCoaching(coaching);
        } catch (error) {
            console.error('Failed to generate AI coaching:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const generateJournalAnalysis = async () => {
        if (aiLoading) return;
        setAiLoading(true);
        try {
            const analysis = await aiService.analyzePracticeJournal(state.practiceSessions);
            setJournalAnalysis(analysis);
            setShowJournal(true);
        } catch (error) {
            console.error('Failed to analyze journal:', error);
            setJournalAnalysis('Sorry, I encountered an error analyzing your practice journal. Please check your AI configuration.');
            setShowJournal(true);
        } finally {
            setAiLoading(false);
        }
    };

    const generatePersonalizedRoutine = async () => {
        if (aiLoading) return;
        setAiLoading(true);
        try {
            const routine = await aiService.generatePersonalizedExercise(recentAttempts, state.goals);
            setPersonalizedRoutine(routine);
            setShowRoutine(true);
        } catch (error) {
            console.error('Failed to generate routine:', error);
        } finally {
            setAiLoading(false);
        }
    };

    const askTheoryQuestion = async () => {
        if (aiLoading || !theoryQuestion.trim()) return;
        setAiLoading(true);
        try {
            const answer = await aiService.answerMusicTheoryQuestion(theoryQuestion, {
                attempts: recentAttempts,
                userLevel: aiRecommendations?.difficultyLevel,
                currentNote: currentQuestion?.note
            });
            setTheoryAnswer(answer);
            setShowTheory(true);
        } catch (error) {
            console.error('Failed to answer theory question:', error);
            setTheoryAnswer('Sorry, I encountered an error. Please check your AI configuration.');
            setShowTheory(true);
        } finally {
            setAiLoading(false);
        }
    };

    const fetchNoteFinderData = async () => {
        if (!state.user) return;
        
        try {
            const { data, error } = await supabase
                .from('note_finder_practice')
                .select('*')
                .eq('user_id', state.user.uid)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            const attempts: NoteFinderAttempt[] = data.map(row => ({
                id: row.id,
                userId: row.user_id,
                sessionDate: row.session_date,
                noteName: row.note_name as Note,
                stringNum: row.string_num,
                fretNum: row.fret_num,
                correct: row.correct,
                timeSeconds: row.time_seconds,
                createdAt: row.created_at,
            }));

            setRecentAttempts(attempts);
            calculateNoteStats(attempts);
        } catch (error) {
            console.error('Error fetching note finder data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateNoteStats = (attempts: NoteFinderAttempt[]) => {
        const statsMap = new Map<Note, { total: number; correct: number; totalTime: number }>();
        
        // Initialize all notes
        ALL_NOTES.forEach(note => {
            statsMap.set(note as Note, { total: 0, correct: 0, totalTime: 0 });
        });

        // Aggregate attempts
        attempts.forEach(attempt => {
            const current = statsMap.get(attempt.noteName)!;
            current.total++;
            if (attempt.correct) current.correct++;
            current.totalTime += attempt.timeSeconds;
        });

        // Convert to stats array
        const stats: NoteStats[] = Array.from(statsMap.entries()).map(([note, data]) => ({
            note,
            attempts: data.total,
            correct: data.correct,
            accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
            avgTime: data.total > 0 ? data.totalTime / data.total : 0,
        }));

        setNoteStats(stats);
    };

    const startQuiz = (mode: QuizModeType, numQuestions: number = 12) => {
        // Use AI-generated sequence if we have enough data, otherwise fallback to random
        let sequence: QuizQuestion[] = [];
        
        if (recentAttempts.length >= 10) {
            // Use AI recommendations
            const aiSequence = generateAIQuizSequence(recentAttempts, numQuestions);
            
            sequence = aiSequence.map(item => {
                const question: QuizQuestion = { 
                    note: item.note, 
                    promptType: item.mode as QuizPromptType 
                };
                
                // For find-on-string mode, pick a random string that has this note
                if (item.mode === 'find-on-string') {
                    const availableStrings = [];
                    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
                        for (let fret = 0; fret <= (aiRecommendations?.maxFrets || 15); fret++) {
                            if (getNoteAt(stringIndex, fret) === item.note) {
                                availableStrings.push(stringIndex);
                                break;
                            }
                        }
                    }
                    question.targetString = availableStrings[Math.floor(Math.random() * availableStrings.length)];
                }
                
                return question;
            });
        } else {
            // Fallback to original random logic for new users
            let notes: Note[] = [];
            
            if (mode === 'combo') {
                notes = shuffle([...ALL_NOTES].slice(0, numQuestions)) as Note[];
            } else {
                notes = shuffle([...ALL_NOTES].slice(0, numQuestions)) as Note[];
            }
            
            sequence = notes.map(note => {
                let promptType: QuizPromptType;
                
                if (mode === 'combo') {
                    const promptTypes: QuizPromptType[] = ['find-all', 'find-any', 'find-on-string'];
                    promptType = promptTypes[Math.floor(Math.random() * promptTypes.length)];
                } else {
                    promptType = mode as QuizPromptType;
                }
                
                const question: QuizQuestion = { note, promptType };
                
                // For find-on-string mode, pick a random string that has this note
                if (promptType === 'find-on-string') {
                    const availableStrings = [];
                    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
                        for (let fret = 0; fret <= 15; fret++) {
                            if (getNoteAt(stringIndex, fret) === note) {
                                availableStrings.push(stringIndex);
                                break;
                            }
                        }
                    }
                    question.targetString = availableStrings[Math.floor(Math.random() * availableStrings.length)];
                }
                
                return question;
            });
        }
        
        setQuizSequence(sequence);
        setCurrentIndex(0);
        setQuizResults([]);
        setFoundPositions(new Set());
        setQuizNoteStats({});
        setMode('quiz');
        setStartTime(Date.now());
        startTimeRef.current = Date.now();
    };

    const handleFretClick = async (stringIndex: number, fret: number, clickedNote: Note) => {
        if (mode !== 'quiz') return;

        const currentQuestion = quizSequence[currentIndex];
        const targetNote = currentQuestion.note;
        const timeSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        let correct = false;
        let shouldAdvance = false;
        
        // Check correctness based on prompt type
        if (currentQuestion.promptType === 'find-any') {
            correct = clickedNote === targetNote;
            shouldAdvance = true; // Always advance after first click
        } else if (currentQuestion.promptType === 'find-on-string') {
            correct = clickedNote === targetNote && stringIndex === currentQuestion.targetString;
            shouldAdvance = true; // Always advance after first click
        } else if (currentQuestion.promptType === 'find-all') {
            correct = clickedNote === targetNote;
            if (correct) {
                // Mark this position as found
                const positionKey = `${stringIndex}-${fret}`;
                setFoundPositions(prev => new Set([...prev, positionKey]));
                
                // Check if all positions have been found
                const allPositions = findAllNotePositions(targetNote);
                const newFoundPositions = new Set([...foundPositions, positionKey]);
                shouldAdvance = allPositions.every(pos => 
                    newFoundPositions.has(`${pos.stringIndex}-${pos.fret}`)
                );
            } else {
                shouldAdvance = false; // Let them keep trying until they find all
            }
        }
        
        // Show feedback
        setLastClickFeedback({
            clickedNote,
            correct,
            expectedNote: targetNote
        });
        setShowFeedback(true);
        
        // Update per-note statistics for this quiz
        setQuizNoteStats(prev => {
            const current = prev[targetNote] || { correct: 0, incorrect: 0 };
            return {
                ...prev,
                [targetNote]: {
                    correct: current.correct + (correct ? 1 : 0),
                    incorrect: current.incorrect + (correct ? 0 : 1)
                }
            };
        });
        
        // Convert stringIndex (0-5, high to low E) to stringNum (1-6, high to low E)
        const stringNum = stringIndex + 1;

        // Save to database
        try {
            await supabase.from('note_finder_practice').insert({
                user_id: state.user!.uid,
                session_date: new Date().toISOString().split('T')[0],
                note_name: targetNote,
                string_num: stringNum,
                fret_num: fret,
                correct,
                time_seconds: timeSeconds
            });
        } catch (error) {
            console.error('Error saving note finder attempt:', error);
        }

        // Add to results
        setQuizResults(prev => [...prev, {
            note: targetNote,
            promptType: currentQuestion.promptType,
            correct,
            timeSeconds,
            stringNum,
            fretNum: fret
        }]);

        // Wait 1.5 seconds to show feedback, then advance
        setTimeout(() => {
            setShowFeedback(false);
            setLastClickFeedback(null);
            
            if (shouldAdvance && currentIndex < quizSequence.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setFoundPositions(new Set()); // Reset for next question
                startTimeRef.current = Date.now();
            } else if (shouldAdvance) {
                setMode('results');
                // Refresh data to show updated stats
                setTimeout(() => {
                    fetchNoteFinderData();
                    // Force recalculation of note stats with new data
                    calculateNoteStats([...recentAttempts]);
                }, 500);
            }
        }, 1500);
    };

    const resetQuiz = () => {
        setMode('menu');
        setQuizSequence([]);
        setCurrentIndex(0);
        setQuizResults([]);
        setFoundPositions(new Set());
        setQuizNoteStats({});
    };

    const getAccuracyColor = (accuracy: number) => {
        if (accuracy >= 80) return 'text-green-400';
        if (accuracy >= 60) return 'text-yellow-400';
        if (accuracy >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const currentQuestion = mode === 'quiz' && quizSequence.length > 0 ? quizSequence[currentIndex] : null;
    
    // Generate highlights for current question
    const getQuizHighlights = () => {
        if (!currentQuestion) return [];
        
        // For "find-all" mode, show correctly found positions as green circles
        if (currentQuestion.promptType === 'find-all') {
            const allPositions = findAllNotePositions(currentQuestion.note);
            return allPositions
                .filter(pos => foundPositions.has(`${pos.stringIndex}-${pos.fret}`))
                .map(pos => ({
                    string: pos.stringIndex,
                    fret: pos.fret,
                    color: 'bg-green-500',
                    label: currentQuestion.note
                }));
        }
        
        // No highlights for other modes
        return [];
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center">
                <div className="text-text-secondary">Loading note finder data...</div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Note Finder Practice</h1>
                <div className="flex items-center justify-between">
                    <p className="text-text-secondary">Master fretboard navigation with intelligent quizzes and progress tracking</p>
                    <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 text-sm">
                            <input
                                type="checkbox"
                                checked={intelligentMode}
                                onChange={(e) => setIntelligentMode(e.target.checked)}
                                className="rounded border-border"
                            />
                            <span className="text-text-secondary">🤖 Intelligent Mode</span>
                        </label>
                    </div>
                </div>
            </div>
            
            {/* Statistics Overview */}
            {noteStats.some(s => s.attempts > 0) && (
                <div className="mb-8 bg-surface/80 backdrop-blur-sm border border-border/50 p-6 rounded-xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold flex items-center">
                            <span className="text-2xl mr-2">📊</span>
                            Your Performance
                        </h2>
                        <button 
                            onClick={() => setShowStatsModal(true)}
                            className="text-primary hover:text-primary-hover text-sm font-medium hover:underline transition-colors duration-200"
                        >
                            📋 View Details
                        </button>
                    </div>
                    
                    {/* Note Performance Heatmap */}
                    <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mb-6">
                        {ALL_NOTES.map(note => {
                            const stat = noteStats.find(s => s.note === note);
                            const accuracy = stat?.accuracy || 0;
                            const attempts = stat?.attempts || 0;
                            
                            let bgColor = 'bg-gray-700/50'; // No data
                            if (attempts > 0) {
                                if (accuracy >= 80) bgColor = 'bg-green-500/80 border-green-400/50';
                                else if (accuracy >= 60) bgColor = 'bg-yellow-500/80 border-yellow-400/50';
                                else if (accuracy >= 40) bgColor = 'bg-orange-500/80 border-orange-400/50';
                                else bgColor = 'bg-red-500/80 border-red-400/50';
                            }
                            
                            return (
                                <div
                                    key={note}
                                    className={`h-10 rounded-lg border backdrop-blur-sm flex items-center justify-center text-white text-sm font-bold ${bgColor} cursor-help transition-all duration-200 hover:scale-110 hover:shadow-lg`}
                                    title={attempts > 0 ? `${note}: ${Math.round(accuracy)}% (${attempts} attempts)` : `${note}: No attempts yet`}
                                >
                                    {note}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="text-xs text-text-secondary text-center">
                        🟢 80%+ • 🟡 60-79% • 🟠 40-59% • 🔴 &lt;40% • ⚫ No Data
                    </div>
                </div>
            )}

            {mode === 'menu' && (
                <div className="space-y-6">
                    {intelligentMode && recentAttempts.length >= 10 && aiCoaching && (
                        <div className="bg-surface/80 backdrop-blur-sm border border-blue-500/50 p-6 rounded-xl shadow-lg mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center">
                                    <span className="text-2xl mr-2">🤖</span>
                                    AI Coach Insights
                                </h2>
                                <button 
                                    onClick={() => setShowCoaching(!showCoaching)}
                                    className="text-sm bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1 rounded-md transition-colors duration-200"
                                >
                                    {showCoaching ? 'Hide' : 'Show'} Details
                                </button>
                            </div>
                            
                            <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-lg mb-4">
                                <p className="text-blue-100">{aiCoaching.coaching}</p>
                            </div>
                            
                            {showCoaching && (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-blue-300 mb-2">🎯 Recommendations</h3>
                                        <ul className="space-y-1">
                                            {aiCoaching.recommendations.map((rec, i) => (
                                                <li key={i} className="text-sm text-text-secondary flex items-start">
                                                    <span className="text-blue-400 mr-2">•</span>
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-sm font-semibold text-blue-300 mb-2">💡 Musical Insights</h3>
                                        <ul className="space-y-1">
                                            {aiCoaching.insights.map((insight, i) => (
                                                <li key={i} className="text-sm text-text-secondary flex items-start">
                                                    <span className="text-blue-400 mr-2">•</span>
                                                    {insight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Intelligent Mode Panel */}
                    {intelligentMode && (
                        <div className="bg-surface/80 backdrop-blur-sm border border-purple-500/50 p-6 rounded-xl shadow-lg mb-8">
                            <h2 className="text-xl font-bold mb-6 flex items-center">
                                <span className="text-2xl mr-2">🧠</span>
                                AI-Powered Tools
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <button 
                                    onClick={generateAICoaching}
                                    disabled={aiLoading || recentAttempts.length < 10}
                                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="text-2xl mb-1">🎯</div>
                                    <div className="text-sm">Get Coaching</div>
                                    {recentAttempts.length < 10 && <div className="text-xs mt-1">Need 10+ attempts</div>}
                                </button>
                                
                                <button 
                                    onClick={generateJournalAnalysis}
                                    disabled={aiLoading || state.practiceSessions.length === 0}
                                    className="bg-green-600/20 hover:bg-green-600/40 text-green-300 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="text-2xl mb-1">📝</div>
                                    <div className="text-sm">Analyze Journal</div>
                                    {state.practiceSessions.length === 0 && <div className="text-xs mt-1">Need practice logs</div>}
                                </button>
                                
                                <button 
                                    onClick={generatePersonalizedRoutine}
                                    disabled={aiLoading || recentAttempts.length < 5}
                                    className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-300 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="text-2xl mb-1">🏃</div>
                                    <div className="text-sm">Custom Routine</div>
                                    {recentAttempts.length < 5 && <div className="text-xs mt-1">Need 5+ attempts</div>}
                                </button>
                                
                                <div className="bg-purple-600/20 text-purple-300 font-bold py-3 px-4 rounded-lg">
                                    <div className="text-2xl mb-1">💬</div>
                                    <div className="text-sm mb-2">Ask Theory</div>
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={theoryQuestion}
                                            onChange={(e) => setTheoryQuestion(e.target.value)}
                                            placeholder="Ask about music theory..."
                                            className="flex-1 text-xs px-2 py-1 bg-purple-900/50 border border-purple-500/30 rounded-l text-white placeholder-purple-300/50"
                                            onKeyPress={(e) => e.key === 'Enter' && askTheoryQuestion()}
                                        />
                                        <button 
                                            onClick={askTheoryQuestion}
                                            disabled={aiLoading || !theoryQuestion.trim()}
                                            className="ml-1 text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                                        >
                                            Ask
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {aiLoading && (
                                <div className="mt-4 text-center">
                                    <div className="text-primary">🤖 AI is thinking...</div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Quiz Mode Selection */}
                    <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-6 rounded-xl shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center">
                                <span className="text-2xl mr-2">🎯</span>
                                Choose Your Challenge
                            </h2>
                            {aiRecommendations && (
                                <button 
                                    onClick={() => setShowAIInsights(true)}
                                    className="text-sm bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1 rounded-md transition-colors duration-200"
                                >
                                    🤖 AI Insights
                                </button>
                            )}
                        </div>
                        
                        {/* AI Recommendation Banner */}
                        {aiRecommendations && aiRecommendations.priorityNotes.length > 0 && (
                            <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-lg mb-6">
                                <div className="flex items-center mb-2">
                                    <span className="text-xl mr-2">🧠</span>
                                    <strong className="text-blue-300">AI Recommendation</strong>
                                </div>
                                <p className="text-sm text-text-secondary mb-3">{aiRecommendations.reasoning}</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-xs text-text-secondary">Focus on:</span>
                                    {aiRecommendations.priorityNotes.slice(0, 4).map((note: Note) => (
                                        <span key={note} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">
                                            {note}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <button 
                                onClick={() => startQuiz('find-any', 12)}
                                className={`group bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] border border-blue-500/30 ${
                                    aiRecommendations && aiRecommendations.recommendedMode === 'find-any' ? 'ring-2 ring-yellow-400' : ''
                                }`}
                            >
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">🚀</div>
                                <div className="text-lg font-bold mb-1">Find Any Mode</div>
                                <div className="text-sm opacity-90">Click one occurrence (speed mode)</div>
                                {aiRecommendations && aiRecommendations.recommendedMode === 'find-any' && (
                                    <div className="text-xs text-yellow-300 mt-1">🤖 AI Recommended</div>
                                )}
                            </button>
                            <button 
                                onClick={() => startQuiz('find-all', 12)}
                                className="group bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] border border-yellow-500/30"
                            >
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">🔍</div>
                                <div className="text-lg font-bold mb-1">Find All Mode</div>
                                <div className="text-sm opacity-90">Find every occurrence on fretboard</div>
                            </button>
                            <button 
                                onClick={() => startQuiz('find-on-string', 12)}
                                className="group bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] border border-purple-500/30"
                            >
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">🎯</div>
                                <div className="text-lg font-bold mb-1">On String Mode</div>
                                <div className="text-sm opacity-90">Find note on specific string</div>
                            </button>
                            <button 
                                onClick={() => startQuiz('combo', 12)}
                                className="group bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] border border-green-500/30"
                            >
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">🎲</div>
                                <div className="text-lg font-bold mb-1">Combo Mode</div>
                                <div className="text-sm opacity-90">Random mix of all three modes</div>
                            </button>
                        </div>
                    </div>
                    
                    {/* Mode Explanations */}
                    <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-6 flex items-center">
                            <span className="text-2xl mr-2">ℹ️</span>
                            How Each Mode Works
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                                <div className="flex items-center mb-2">
                                    <span className="text-2xl mr-2">🚀</span>
                                    <strong className="text-blue-400">Find Any</strong>
                                </div>
                                <p className="text-sm text-text-secondary">"Find any C♯" → Click one C♯ anywhere (speed mode)</p>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                                <div className="flex items-center mb-2">
                                    <span className="text-2xl mr-2">🔍</span>
                                    <strong className="text-yellow-400">Find All</strong>
                                </div>
                                <p className="text-sm text-text-secondary">"Find all the C♯" → Click every C♯ on the fretboard</p>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                                <div className="flex items-center mb-2">
                                    <span className="text-2xl mr-2">🎯</span>
                                    <strong className="text-purple-400">On String</strong>
                                </div>
                                <p className="text-sm text-text-secondary">"Find C♯ on string 3" → Click the specific C♯</p>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <p className="text-sm text-text-secondary text-center">
                                <strong className="text-green-400">💡 Pro Tip:</strong> Combo mode randomly mixes all three modes to test different recall skills!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'quiz' && currentQuestion && (
                <div className="space-y-6">
                    <div className="text-center bg-surface/80 backdrop-blur-sm border border-border/50 p-8 rounded-xl shadow-lg relative">
                        {!showFeedback ? (
                            <>
                                <div className="bg-background/50 backdrop-blur-sm px-4 py-2 rounded-full inline-block mb-4">
                                    <p className="text-text-secondary text-sm">Question {currentIndex + 1} of {quizSequence.length}</p>
                                </div>
                                <div className="text-5xl font-bold mb-6 leading-tight">
                                    {currentQuestion.promptType === 'find-any' && (
                                        <span className="text-blue-400">Find any <span className="text-white bg-blue-500/20 px-3 py-1 rounded-lg">{currentQuestion.note}</span></span>
                                    )}
                                    {currentQuestion.promptType === 'find-all' && (
                                        <span className="text-yellow-400">Find all the <span className="text-white bg-yellow-500/20 px-3 py-1 rounded-lg">{currentQuestion.note}</span></span>
                                    )}
                                    {currentQuestion.promptType === 'find-on-string' && (
                                        <span className="text-purple-400">Find <span className="text-white bg-purple-500/20 px-3 py-1 rounded-lg">{currentQuestion.note}</span> on string {(currentQuestion.targetString! + 1)}</span>
                                    )}
                                </div>
                                <div className="text-base text-text-secondary bg-background/30 backdrop-blur-sm px-4 py-2 rounded-lg inline-block">
                                    {currentQuestion.promptType === 'find-any' && "⚡ Click one occurrence for speed"}
                                    {currentQuestion.promptType === 'find-all' && `🎯 Found: ${foundPositions.size} / ${findAllNotePositions(currentQuestion.note).length}`}
                                    {currentQuestion.promptType === 'find-on-string' && "🎯 Click the specific string location"}
                                </div>
                                
                                {/* Add "Give Up" button for find-all mode */}
                                {currentQuestion.promptType === 'find-all' && foundPositions.size < findAllNotePositions(currentQuestion.note).length && (
                                    <div className="mt-6">
                                    <button 
                                        onClick={() => {
                                            // Force advance to next question
                                            if (currentIndex < quizSequence.length - 1) {
                                                setCurrentIndex(prev => prev + 1);
                                                setFoundPositions(new Set());
                                                startTimeRef.current = Date.now();
                                            } else {
                                                setMode('results');
                                                setTimeout(fetchNoteFinderData, 500);
                                            }
                                        }}
                                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        🏳️ Give Up & Skip to Next Note
                                    </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-3xl font-bold">
                                    You clicked: <span className="text-white">{lastClickFeedback?.clickedNote}</span>
                                </div>
                                {lastClickFeedback?.correct ? (
                                    <div className="bg-green-500/20 border border-green-500/50 p-6 rounded-xl">
                                        <div className="text-4xl text-green-400 mb-2">
                                        ✅ Correct!
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-red-500/20 border border-red-500/50 p-6 rounded-xl">
                                        <div className="text-4xl text-red-400 mb-2">
                                        ❌ Wrong! 
                                        </div>
                                        <div className="text-lg mt-2">
                                            Expected: <span className="text-white">{lastClickFeedback?.expectedNote}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <Fretboard
                        onFretClick={handleFretClick}
                        highlightedNotes={getQuizHighlights()}
                        showFretNumbers={true}
                        allFretsClickable={true}
                        fretCount={aiRecommendations?.maxFrets || 15}
                        targetString={currentQuestion.promptType === 'find-on-string' ? currentQuestion.targetString : undefined}
                    />
                    
                    <div className="text-center mt-6">
                        <button 
                            onClick={resetQuiz}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            🛑 End Quiz Early
                        </button>
                    </div>
                </div>
            )}

            {mode === 'results' && (
                <div className="space-y-6">
                    <div className="bg-surface/80 backdrop-blur-sm border border-border/50 p-8 rounded-xl shadow-lg text-center">
                        <div className="text-4xl mb-4">🎉</div>
                        <h2 className="text-3xl font-bold mb-6 text-green-400">Quiz Complete!</h2>
                        
                        {/* Overall Results */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-background/50 backdrop-blur-sm p-4 rounded-lg">
                                <div className="text-2xl mb-2">🎯</div>
                                <div className="text-3xl font-bold text-primary">
                                    {quizResults.filter(r => r.correct).length}/{quizResults.length}
                                </div>
                                <div className="text-text-secondary">Correct</div>
                            </div>
                            <div className="bg-background/50 backdrop-blur-sm p-4 rounded-lg">
                                <div className="text-2xl mb-2">📊</div>
                                <div className="text-3xl font-bold text-primary">
                                    {Math.round((quizResults.filter(r => r.correct).length / quizResults.length) * 100)}%
                                </div>
                                <div className="text-text-secondary">Accuracy</div>
                            </div>
                            <div className="bg-background/50 backdrop-blur-sm p-4 rounded-lg">
                                <div className="text-2xl mb-2">⏱️</div>
                                <div className="text-3xl font-bold text-primary">
                                    {(quizResults.reduce((sum, r) => sum + r.timeSeconds, 0) / quizResults.length).toFixed(1)}s
                                </div>
                                <div className="text-text-secondary">Avg Time</div>
                            </div>
                        </div>
                        
                        {/* Per-Note Breakdown */}
                        {Object.keys(quizNoteStats).length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-lg font-bold mb-4">📈 Performance by Note</h3>
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                    {Object.entries(quizNoteStats).map(([note, stats]) => {
                                        const accuracy = Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100);
                                        const color = accuracy >= 80 ? 'bg-green-500' : 
                                                     accuracy >= 60 ? 'bg-yellow-500' : 
                                                     accuracy >= 40 ? 'bg-orange-500' : 'bg-red-500';
                                        return (
                                            <div key={note} className={`${color} p-3 rounded-lg text-white text-center transition-all duration-200 hover:scale-105`}>
                                                <div className="font-bold">{note}</div>
                                                <div className="text-xs">{accuracy}%</div>
                                                <div className="text-xs">{stats.correct}/{stats.correct + stats.incorrect}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <button 
                                onClick={resetQuiz}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                🎯 Choose Another Quiz Mode
                            </button>
                            <button 
                                onClick={resetQuiz}
                                className="w-full bg-surface hover:bg-border text-text-primary font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                🏠 Back to Menu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Stats Modal */}
            {showStatsModal && (
                <Modal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} title="Detailed Note Performance">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {noteStats
                                .filter(s => s.attempts > 0)
                                .sort((a, b) => b.accuracy - a.accuracy)
                                .map(stat => (
                                    <div key={stat.note} className="bg-background/50 backdrop-blur-sm border border-border/30 p-4 rounded-lg hover:bg-background/80 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-lg">{stat.note}</span>
                                            <span className={`font-bold ${getAccuracyColor(stat.accuracy)}`}>
                                                {Math.round(stat.accuracy)}%
                                            </span>
                                        </div>
                                        <div className="text-sm text-text-secondary">
                                            {stat.correct}/{stat.attempts} correct • {stat.avgTime.toFixed(1)}s avg
                                        </div>
                                    </div>
                                ))}
                        </div>
                        
                        {noteStats.every(s => s.attempts === 0) && (
                            <div className="text-center p-8 text-text-secondary">
                                <div className="text-4xl mb-4">🤔</div>
                                <h3 className="text-lg font-bold mb-2">No Data Yet</h3>
                                <p>Take a quiz to see your performance!</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
            {showAIInsights && aiRecommendations && (
                <Modal isOpen={showAIInsights} onClose={() => setShowAIInsights(false)} title="🤖 AI Performance Insights">
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className={`text-4xl mb-2 ${
                                aiRecommendations.difficultyLevel === 'beginner' ? 'text-green-400' :
                                aiRecommendations.difficultyLevel === 'intermediate' ? 'text-yellow-400' :
                                'text-red-400'
                            }`}>
                                {aiRecommendations.difficultyLevel === 'beginner' ? '🌱' :
                                 aiRecommendations.difficultyLevel === 'intermediate' ? '🌿' : '🌳'}
                            </div>
                            <h3 className="text-xl font-bold capitalize">{aiRecommendations.difficultyLevel} Level</h3>
                            <p className="text-text-secondary mt-2">{aiRecommendations.reasoning}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Priority Notes */}
                            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                                <h4 className="font-bold text-red-300 mb-3 flex items-center">
                                    <span className="mr-2">🎯</span>
                                    Needs Practice
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {aiRecommendations.priorityNotes.slice(0, 6).map((note: Note) => (
                                        <div key={note} className="bg-red-500/20 text-red-200 text-center py-2 rounded font-bold">
                                            {note}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Maintenance Notes */}
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                                <h4 className="font-bold text-green-300 mb-3 flex items-center">
                                    <span className="mr-2">✅</span>
                                    Keep Sharp
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {aiRecommendations.maintenanceNotes.slice(0, 6).map((note: Note) => (
                                        <div key={note} className="bg-green-500/20 text-green-200 text-center py-2 rounded font-bold">
                                            {note}
                                        </div>
                                    ))}
                                </div>
                                {aiRecommendations.maintenanceNotes.length === 0 && (
                                    <p className="text-text-secondary text-sm text-center py-4">
                                        Keep practicing to build your strengths! 💪
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        <div className="bg-background/50 p-4 rounded-lg">
                            <h4 className="font-bold mb-2">Current Settings</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-text-secondary">Fretboard Range:</span>
                                    <span className="ml-2 font-bold">0-{aiRecommendations.maxFrets} frets</span>
                                </div>
                                <div>
                                    <span className="text-text-secondary">Recommended Mode:</span>
                                    <span className="ml-2 font-bold capitalize">{aiRecommendations.recommendedMode.replace('-', ' ')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-center">
                            <button 
                                onClick={() => {
                                    setShowAIInsights(false);
                                    startQuiz(aiRecommendations.recommendedMode.replace('-', '_') as QuizModeType, 12);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                            >
                                🎯 Start AI-Optimized Quiz
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            
            {/* AI Modals */}
            {showJournal && (
                <Modal isOpen={showJournal} onClose={() => setShowJournal(false)} title="📝 Practice Journal Analysis">
                    <div className="prose prose-invert max-w-none">
                        <div className="whitespace-pre-line text-text-primary">{journalAnalysis}</div>
                    </div>
                </Modal>
            )}
            
            {showRoutine && personalizedRoutine && (
                <Modal isOpen={showRoutine} onClose={() => setShowRoutine(false)} title="🏃 Personalized Practice Routine">
                    <div className="space-y-4">
                        <div className="bg-background/50 p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-primary">{personalizedRoutine.title}</h3>
                            <p className="text-text-secondary mt-1">{personalizedRoutine.description}</p>
                            <p className="text-sm text-text-secondary mt-2">⏱️ Estimated time: {personalizedRoutine.estimatedTime}</p>
                        </div>
                        
                        <div className="space-y-3">
                            {personalizedRoutine.exercises.map((exercise, i) => (
                                <div key={i} className="border border-border/30 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-text-primary">{exercise.name}</h4>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                                                {exercise.difficulty}
                                            </span>
                                            <span className="text-sm text-text-secondary">{exercise.duration}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-secondary">{exercise.instructions}</p>
                                </div>
                            ))}
                        </div>
                        
                        <div className="text-center">
                            <button 
                                onClick={() => setShowRoutine(false)}
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-lg"
                            >
                                Start This Routine
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            
            {showTheory && (
                <Modal isOpen={showTheory} onClose={() => setShowTheory(false)} title="💬 Music Theory Answer">
                    <div className="space-y-4">
                        <div className="bg-background/50 p-4 rounded-lg">
                            <h3 className="font-semibold text-primary mb-2">Your Question:</h3>
                            <p className="text-text-primary italic">"{theoryQuestion}"</p>
                        </div>
                        
                        <div className="prose prose-invert max-w-none">
                            <div className="whitespace-pre-line text-text-primary">{theoryAnswer}</div>
                        </div>
                        
                        <div className="text-center">
                            <button 
                                onClick={() => {
                                    setShowTheory(false);
                                    setTheoryQuestion('');
                                    setTheoryAnswer('');
                                }}
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-lg"
                            >
                                Ask Another Question
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};