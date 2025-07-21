import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { Modal } from '../../components/Modal';
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
const shuffle = <T,>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

// Quiz prompt types
type QuizPromptType = 'find-all' | 'find-any' | 'find-on-string';

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
    const { state } = useAppContext();
    
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

    const startQuiz = (numQuestions: number = 12) => {
        // Create varied quiz questions
        const notes = shuffle([...ALL_NOTES].slice(0, numQuestions)) as Note[];
        const sequence: QuizQuestion[] = notes.map(note => {
            const promptTypes: QuizPromptType[] = ['find-all', 'find-any', 'find-on-string'];
            const promptType = promptTypes[Math.floor(Math.random() * promptTypes.length)];
            
            const question: QuizQuestion = { note, promptType };
            
            // For find-on-string mode, pick a random string that has this note
            if (promptType === 'find-on-string') {
                const availableStrings = [];
                for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
                    for (let fret = 0; fret <= 15; fret++) {
                        if (getNoteAt(stringIndex, fret) === note) {
                            availableStrings.push(stringIndex);
                            break; // Found this note on this string, move to next string
                        }
                    }
                }
                question.targetString = availableStrings[Math.floor(Math.random() * availableStrings.length)];
            }
            
            return question;
        });
        
        setQuizSequence(sequence);
        setCurrentIndex(0);
        setQuizResults([]);
        setFoundPositions(new Set());
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
                shouldAdvance = true; // Wrong click ends the question
            }
        }
        
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

        // Move to next question or finish
        if (shouldAdvance && currentIndex < quizSequence.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setFoundPositions(new Set()); // Reset for next question
            startTimeRef.current = Date.now();
        } else if (shouldAdvance) {
            setMode('results');
            // Refresh data to show updated stats
            setTimeout(fetchNoteFinderData, 500);
        }
    };

    const resetQuiz = () => {
        setMode('menu');
        setQuizSequence([]);
        setCurrentIndex(0);
        setQuizResults([]);
        setFoundPositions(new Set());
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
        
        if (currentQuestion.promptType === 'find-all') {
            // Highlight remaining positions for "find all" mode
            const allPositions = findAllNotePositions(currentQuestion.note);
            return allPositions
                .filter(pos => !foundPositions.has(`${pos.stringIndex}-${pos.fret}`))
                .map(pos => ({
                    string: pos.stringIndex,
                    fret: pos.fret,
                    color: 'bg-blue-500/30', // Semi-transparent hint
                    label: ''
                }));
        }
        
        return []; // No highlights for other modes
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
            <h1 className="text-3xl font-bold mb-6">Note Finder Practice</h1>
            
            {/* Statistics Overview */}
            {noteStats.some(s => s.attempts > 0) && (
                <div className="mb-6 bg-surface p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Your Performance</h2>
                        <button 
                            onClick={() => setShowStatsModal(true)}
                            className="text-primary hover:underline text-sm"
                        >
                            View Detailed Stats
                        </button>
                    </div>
                    
                    {/* Note Performance Heatmap */}
                    <div className="grid grid-cols-12 gap-1 mb-4">
                        {ALL_NOTES.map(note => {
                            const stat = noteStats.find(s => s.note === note);
                            const accuracy = stat?.accuracy || 0;
                            const attempts = stat?.attempts || 0;
                            
                            let bgColor = 'bg-gray-600'; // No data
                            if (attempts > 0) {
                                if (accuracy >= 80) bgColor = 'bg-green-500';
                                else if (accuracy >= 60) bgColor = 'bg-yellow-500';
                                else if (accuracy >= 40) bgColor = 'bg-orange-500';
                                else bgColor = 'bg-red-500';
                            }
                            
                            return (
                                <div
                                    key={note}
                                    className={`h-8 rounded flex items-center justify-center text-white text-sm font-bold ${bgColor} cursor-help`}
                                    title={attempts > 0 ? `${note}: ${Math.round(accuracy)}% (${attempts} attempts)` : `${note}: No attempts yet`}
                                >
                                    {note}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="text-xs text-text-secondary">
                        🟢 80%+ • 🟡 60-79% • 🟠 40-59% • 🔴 &lt;40% • ⚫ No Data
                    </div>
                </div>
            )}

            {mode === 'menu' && (
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-lg">
                        <h2 className="text-xl font-bold mb-4">Practice Options</h2>
                        <div className="space-y-4">
                            <button 
                                onClick={() => startQuiz(12)}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-md"
                            >
                                🎯 Full Quiz (All 12 Notes)
                            </button>
                            <button 
                                onClick={() => startQuiz(6)}
                                className="w-full bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md"
                            >
                                ⚡ Quick Quiz (6 Random Notes)
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-surface p-6 rounded-lg">
                        <h2 className="text-xl font-bold mb-4">Three Quiz Modes</h2>
                        <div className="space-y-3 text-text-secondary">
                            <div>
                                <strong className="text-primary">Find Any:</strong> "Find any C♯" → Click one C♯ anywhere (speed mode)
                            </div>
                            <div>
                                <strong className="text-yellow-400">Find All:</strong> "Find all the C♯" → Click every C♯ on the fretboard
                            </div>
                            <div>
                                <strong className="text-blue-400">Find on String:</strong> "Find C♯ on string 3" → Click the specific C♯
                            </div>
                            <p className="mt-3 text-sm">The quiz randomly mixes all three modes to test different recall skills!</p>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'quiz' && currentQuestion && (
                <div className="space-y-6">
                    <div className="text-center bg-surface p-6 rounded-lg">
                        <p className="text-text-secondary mb-2">Question {currentIndex + 1} of {quizSequence.length}</p>
                        <div className="text-4xl font-bold mb-4">
                            {currentQuestion.promptType === 'find-any' && (
                                <span className="text-primary">Find any <span className="text-white">{currentQuestion.note}</span></span>
                            )}
                            {currentQuestion.promptType === 'find-all' && (
                                <span className="text-yellow-400">Find all the <span className="text-white">{currentQuestion.note}</span></span>
                            )}
                            {currentQuestion.promptType === 'find-on-string' && (
                                <span className="text-blue-400">Find <span className="text-white">{currentQuestion.note}</span> on string {(currentQuestion.targetString! + 1)}</span>
                            )}
                        </div>
                        <div className="text-sm text-text-secondary">
                            {currentQuestion.promptType === 'find-any' && "Click one occurrence for speed"}
                            {currentQuestion.promptType === 'find-all' && `Found: ${foundPositions.size} / ${findAllNotePositions(currentQuestion.note).length}`}
                            {currentQuestion.promptType === 'find-on-string' && "Click the specific string location"}
                        </div>
                    </div>
                    
                    <Fretboard
                        onFretClick={handleFretClick}
                        highlightedNotes={getQuizHighlights()}
                        showFretNumbers={true}
                        allFretsClickable={true}
                        targetString={currentQuestion.promptType === 'find-on-string' ? currentQuestion.targetString : undefined}
                    />
                    
                    <div className="text-center">
                        <button 
                            onClick={resetQuiz}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md"
                        >
                            End Quiz Early
                        </button>
                    </div>
                </div>
            )}

            {mode === 'results' && (
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-lg text-center">
                        <h2 className="text-2xl font-bold mb-4">Quiz Complete!</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <div className="text-3xl font-bold text-primary">
                                    {quizResults.filter(r => r.correct).length}/{quizResults.length}
                                </div>
                                <div className="text-text-secondary">Correct</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-primary">
                                    {Math.round((quizResults.filter(r => r.correct).length / quizResults.length) * 100)}%
                                </div>
                                <div className="text-text-secondary">Accuracy</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-primary">
                                    {(quizResults.reduce((sum, r) => sum + r.timeSeconds, 0) / quizResults.length).toFixed(1)}s
                                </div>
                                <div className="text-text-secondary">Avg Time</div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <button 
                                onClick={() => startQuiz(quizSequence.length)}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md"
                            >
                                Take Another Quiz
                            </button>
                            <button 
                                onClick={resetQuiz}
                                className="w-full bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md"
                            >
                                Back to Menu
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
                                    <div key={stat.note} className="bg-background p-3 rounded-md">
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
                                No practice data yet. Take a quiz to see your performance!
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};