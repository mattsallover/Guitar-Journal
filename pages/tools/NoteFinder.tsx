import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { Note, NoteFinderAttempt } from '../../types';
import { ALL_NOTES, GUITAR_TUNING } from '../../constants';
import { generateAIQuizSequence, analyzeNotePerformance } from '../../utils/aiRecommendations';
import { supabase } from '../../services/supabase';

type ViewMode = 'learn' | 'practice' | 'analytics';
type PracticeMode = 'find-any' | 'find-all' | 'find-on-string';

interface NoteFinderProps {
    isEmbedded?: boolean;
}

export const NoteFinder: React.FC<NoteFinderProps> = ({ isEmbedded = false }) => {
    const { state, refreshData } = useAppContext();
    const [viewMode, setViewMode] = useState<ViewMode>('learn');
    
    // Learn mode state
    const [selectedNote, setSelectedNote] = useState<Note>('C');
    
    // Practice mode state
    const [practiceMode, setPracticeMode] = useState<PracticeMode>('find-any');
    const [targetNote, setTargetNote] = useState<Note | null>(null);
    const [targetString, setTargetString] = useState<number | null>(null);
    const [isWaitingForAnswer, setIsWaitingForAnswer] = useState(false);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
    const [startTime, setStartTime] = useState<number>(0);
    const [showResult, setShowResult] = useState<string | null>(null);

    // Generate new practice question
    const generateQuestion = () => {
        if (practiceMode === 'find-on-string') {
            // Random note, specific string
            const randomNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
            const randomString = Math.floor(Math.random() * 6); // 0-5 (high E to low E)
            setTargetNote(randomNote);
            setTargetString(randomString);
        } else {
            // Use AI recommendations for smarter question selection
            const recommendations = generateAIQuizSequence(state.noteFinderAttempts, 1);
            if (recommendations.length > 0) {
                setTargetNote(recommendations[0].note);
                setTargetString(null);
            } else {
                // Fallback to random
                const randomNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
                setTargetNote(randomNote);
                setTargetString(null);
            }
        }
        setIsWaitingForAnswer(true);
        setStartTime(Date.now());
        setShowResult(null);
    };

    // Start practice session
    const startPractice = () => {
        setSessionStats({ correct: 0, total: 0 });
        generateQuestion();
    };

    // Handle fret click during practice
    const handleFretClick = async (stringIndex: number, fret: number, clickedNote: Note) => {
        if (!isWaitingForAnswer || !targetNote || !state.user) return;

        const timeSeconds = (Date.now() - startTime) / 1000;
        let isCorrect = false;

        if (practiceMode === 'find-on-string') {
            // Must be correct note AND correct string
            isCorrect = clickedNote === targetNote && stringIndex === targetString;
        } else {
            // Any instance of the correct note
            isCorrect = clickedNote === targetNote;
        }

        // Save attempt to database
        try {
            await supabase.from('note_finder_practice').insert([{
                user_id: state.user.uid,
                session_date: new Date().toISOString().split('T')[0],
                note_name: targetNote,
                string_num: stringIndex + 1, // DB uses 1-6, not 0-5
                fret_num: fret,
                correct: isCorrect,
                time_seconds: Math.round(timeSeconds)
            }]);
            
            await refreshData();
        } catch (error) {
            console.error('Error saving note finder attempt:', error);
        }

        // Update session stats
        const newStats = {
            correct: sessionStats.correct + (isCorrect ? 1 : 0),
            total: sessionStats.total + 1
        };
        setSessionStats(newStats);

        // Show result
        setShowResult(isCorrect ? 'correct' : 'incorrect');
        setIsWaitingForAnswer(false);

        // Auto-generate next question after delay
        setTimeout(() => {
            generateQuestion();
        }, 1500);
    };

    // Calculate highlighted notes for learn mode
    const learnHighlightedNotes = useMemo(() => {
        if (viewMode !== 'learn') return [];
        
        const highlighted = [];
        for (let string = 0; string < 6; string++) {
            for (let fret = 0; fret <= 15; fret++) {
                const noteIndex = (ALL_NOTES.indexOf(GUITAR_TUNING[string]) + fret) % 12;
                const note = ALL_NOTES[noteIndex];
                
                if (note === selectedNote) {
                    highlighted.push({
                        string,
                        fret,
                        color: 'bg-primary',
                        label: note
                    });
                }
            }
        }
        return highlighted;
    }, [selectedNote, viewMode]);

    // Calculate performance analytics
    const performanceData = useMemo(() => {
        return analyzeNotePerformance(state.noteFinderAttempts);
    }, [state.noteFinderAttempts]);

    // Handle random note selection
    const handleRandomize = () => {
        const randomNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
        setSelectedNote(randomNote);
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                {!isEmbedded && (
                    <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-text-primary mb-2">Note Finder</h1>
                    <p className="text-text-secondary">
                        Master every note on the fretboard with intelligent practice
                    </p>
                </div>
                )}

                {/* Mode Toggle */}
                {!isEmbedded && (
                    <div className="flex justify-center mb-8">
                    <div className="flex bg-background rounded-lg p-1 border border-border">
                        <button 
                            onClick={() => setViewMode('learn')}
                            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                                viewMode === 'learn' 
                                    ? 'bg-primary text-white' 
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            🎸 Learn Notes
                        </button>
                        <button 
                            onClick={() => setViewMode('practice')}
                            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                                viewMode === 'practice' 
                                    ? 'bg-primary text-white' 
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            🧠 Practice Mode
                        </button>
                        <button 
                            onClick={() => setViewMode('analytics')}
                            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                                viewMode === 'analytics' 
                                    ? 'bg-primary text-white' 
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            📊 View Analytics
                        </button>
                    </div>
                </div>
                )}

                {/* Learn Mode */}
                {viewMode === 'learn' && (
                    <>
                        <div className="bg-surface p-6 rounded-lg mb-8">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <label className="block text-sm font-medium text-text-secondary mb-2">Select Note</label>
                                        <select 
                                            value={selectedNote}
                                            onChange={(e) => setSelectedNote(e.target.value as Note)}
                                            className="bg-background p-3 rounded-lg border border-border text-xl font-bold text-center min-w-[80px]"
                                        >
                                            {ALL_NOTES.map(note => (
                                                <option key={note} value={note}>{note}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-3xl font-bold text-primary mb-1">
                                        {selectedNote}
                                    </div>
                                    <div className="text-sm text-text-secondary">
                                        All instances on fretboard
                                    </div>
                                </div>

                                <button 
                                    onClick={handleRandomize}
                                    className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2"
                                >
                                    <span>🎲</span>
                                    <span>Random Note</span>
                                </button>
                            </div>
                        </div>

                        <div className="mb-8">
                            <Fretboard 
                                highlightedNotes={learnHighlightedNotes}
                                showFretNumbers={true}
                                fretCount={15}
                            />
                        </div>

                        <div className="bg-surface p-4 rounded-lg text-center">
                            <p className="text-text-secondary">
                                <span className="font-bold text-primary">{selectedNote}</span> appears in 
                                <span className="font-bold text-primary ml-1">{learnHighlightedNotes.length}</span> positions on the fretboard
                            </p>
                        </div>
                    </>
                )}

                {/* Practice Mode */}
                {viewMode === 'practice' && (
                    <>
                        {!isWaitingForAnswer && !targetNote ? (
                            <div className="bg-surface p-12 rounded-lg text-center">
                                <div className="text-6xl mb-6">🎯</div>
                                <h2 className="text-2xl font-bold text-text-primary mb-4">Ready to Practice?</h2>
                                
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">Practice Mode</label>
                                    <select 
                                        value={practiceMode}
                                        onChange={(e) => setPracticeMode(e.target.value as PracticeMode)}
                                        className="bg-background p-2 rounded-lg border border-border"
                                    >
                                        <option value="find-any">Find Any Instance</option>
                                        <option value="find-on-string">Find on Specific String</option>
                                    </select>
                                </div>

                                <button 
                                    onClick={startPractice}
                                    className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 hover:scale-105"
                                >
                                    Start Practice Session
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Practice Question */}
                                <div className="bg-surface p-8 rounded-lg mb-8 text-center">
                                    <div className="mb-4">
                                        <div className="text-sm text-text-secondary mb-2">
                                            {practiceMode === 'find-on-string' ? 'Find this note on the highlighted string:' : 'Find this note anywhere:'}
                                        </div>
                                        <div className="text-6xl font-bold text-primary mb-4">
                                            {targetNote}
                                        </div>
                                        {practiceMode === 'find-on-string' && targetString !== null && (
                                            <div className="text-sm text-text-secondary">
                                                String {targetString + 1} ({GUITAR_TUNING[targetString]} string)
                                            </div>
                                        )}
                                    </div>

                                    {/* Results */}
                                    {showResult && (
                                        <div className={`text-2xl font-bold mb-4 ${
                                            showResult === 'correct' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {showResult === 'correct' ? '✅ Correct!' : '❌ Try Again!'}
                                        </div>
                                    )}

                                    {/* Session Stats */}
                                    <div className="flex justify-center space-x-6 text-sm text-text-secondary">
                                        <span>Correct: <strong className="text-green-400">{sessionStats.correct}</strong></span>
                                        <span>Total: <strong className="text-text-primary">{sessionStats.total}</strong></span>
                                        <span>Accuracy: <strong className="text-primary">
                                            {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
                                        </strong></span>
                                    </div>
                                </div>

                                {/* Interactive Fretboard */}
                                <div className="mb-8">
                                    <Fretboard 
                                        highlightedNotes={[]}
                                        onFretClick={handleFretClick}
                                        showFretNumbers={true}
                                        fretCount={15}
                                        allFretsClickable={true}
                                        targetString={practiceMode === 'find-on-string' ? targetString : undefined}
                                    />
                                </div>

                                <div className="text-center">
                                    <button 
                                        onClick={() => {
                                            setTargetNote(null);
                                            setIsWaitingForAnswer(false);
                                            setShowResult(null);
                                        }}
                                        className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-6 rounded-lg"
                                    >
                                        End Practice Session
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* Analytics Mode */}
                {viewMode === 'analytics' && (
                    <div className="space-y-6">
                        {state.noteFinderAttempts.length === 0 ? (
                            <div className="bg-surface p-12 rounded-lg text-center">
                                <div className="text-6xl mb-6">📊</div>
                                <h2 className="text-2xl font-bold text-text-primary mb-4">No Practice Data Yet</h2>
                                <p className="text-text-secondary mb-6">
                                    Complete some practice sessions to see your performance analytics!
                                </p>
                                <button 
                                    onClick={() => setViewMode('practice')}
                                    className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg"
                                >
                                    Start Practicing
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Overall Stats */}
                                <div className="bg-surface p-6 rounded-lg">
                                    <h2 className="text-xl font-bold mb-4">Practice Summary</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-primary">{state.noteFinderAttempts.length}</div>
                                            <div className="text-sm text-text-secondary">Total Attempts</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-primary">
                                                {Math.round((state.noteFinderAttempts.filter(a => a.correct).length / state.noteFinderAttempts.length) * 100)}%
                                            </div>
                                            <div className="text-sm text-text-secondary">Overall Accuracy</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-primary">
                                                {(state.noteFinderAttempts.reduce((sum, a) => sum + a.timeSeconds, 0) / state.noteFinderAttempts.length).toFixed(1)}s
                                            </div>
                                            <div className="text-sm text-text-secondary">Avg Response Time</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-primary">
                                                {performanceData.filter(p => p.needsPractice).length}
                                            </div>
                                            <div className="text-sm text-text-secondary">Notes Need Practice</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Note Performance Grid */}
                                <div className="bg-surface p-6 rounded-lg">
                                    <h3 className="text-lg font-bold mb-4">Note Performance</h3>
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {performanceData
                                            .filter(p => p.totalAttempts > 0)
                                            .sort((a, b) => b.accuracy - a.accuracy)
                                            .map(note => (
                                                <div key={note.note} className="text-center p-3 bg-background rounded-md">
                                                    <div className="text-lg font-bold text-primary">{note.note}</div>
                                                    <div className={`text-sm font-medium ${
                                                        note.accuracy >= 0.8 ? 'text-green-400' :
                                                        note.accuracy >= 0.6 ? 'text-yellow-400' :
                                                        'text-red-400'
                                                    }`}>
                                                        {Math.round(note.accuracy * 100)}%
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {note.totalAttempts} tries
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {(note.avgTimeMs / 1000).toFixed(1)}s avg
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Recommendations */}
                                <div className="bg-surface p-6 rounded-lg">
                                    <h3 className="text-lg font-bold mb-4">Practice Recommendations</h3>
                                    <div className="space-y-2">
                                        {performanceData
                                            .filter(p => p.needsPractice)
                                            .slice(0, 5)
                                            .map(note => (
                                                <div key={note.note} className="flex items-center justify-between p-3 bg-background rounded-md">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="font-bold text-primary">{note.note}</div>
                                                        <div className="text-sm text-text-secondary">
                                                            {Math.round(note.accuracy * 100)}% accuracy • {(note.avgTimeMs / 1000).toFixed(1)}s avg
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-orange-400 font-medium">
                                                        Needs Practice
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};