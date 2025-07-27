import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Fretboard } from '../../components/Fretboard';
import { CAGEDHeatmap } from '../../components/CAGEDHeatmap';
import { Note, CagedShape } from '../../types';
import { ALL_NOTES, CAGED_SHAPES, GUITAR_TUNING } from '../../constants';
import { supabase } from '../../services/supabase';

export const CagedExplorer: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const [selectedRootNote, setSelectedRootNote] = useState<Note>('C');
    const [selectedCagedShape, setSelectedCagedShape] = useState<CagedShape>('C');
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isQuizMode, setIsQuizMode] = useState(false);
    
    // Quiz state
    const [quizQuestions, setQuizQuestions] = useState<Array<{note: Note, shape: CagedShape}>>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Array<{correct: boolean, timeSeconds: number}>>([]);
    const [quizStartTime, setQuizStartTime] = useState<number>(0);
    const [showQuizResult, setShowQuizResult] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);

    // Calculate highlighted notes for the current selection
    const highlightedNotes = useMemo(() => {
        // In quiz mode, only show highlights after reveal
        if (isQuizMode && !isRevealed) {
            return [];
        }
        
        const shape = CAGED_SHAPES[selectedCagedShape];
        if (!shape) return [];

        // Find what fret the root note appears on the root string
        const rootStringOpenNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[shape.rootString]);
        const rootNoteIndex = ALL_NOTES.indexOf(selectedRootNote);
        const rootFret = (rootNoteIndex - rootStringOpenNoteIndex + 12) % 12;
        
        return shape.intervals.map(interval => {
            const fret = rootFret + interval.fretOffset;
            if (fret < 0 || fret > 15) return null; // Skip if out of range
            
            // Calculate what note is actually at this position
            const stringOpenNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[interval.string]);
            const actualNoteIndex = (stringOpenNoteIndex + fret) % 12;
            const note = ALL_NOTES[actualNoteIndex];
            
            return {
                string: interval.string,
                fret: fret,
                color: getIntervalColor(interval.type),
                label: interval.type === 'R' ? note : interval.type
            };
        }).filter(Boolean);
    }, [selectedRootNote, selectedCagedShape]);

    const handleRandomize = () => {
        const randomNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
        const shapes: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        
        setSelectedRootNote(randomNote);
        setSelectedCagedShape(randomShape);
    };

    const startQuiz = () => {
        // Generate 5 random questions
        const questions = Array.from({ length: 5 }, () => ({
            note: ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note,
            shape: (['C', 'A', 'G', 'E', 'D'] as CagedShape[])[Math.floor(Math.random() * 5)]
        }));
        
        setQuizQuestions(questions);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setIsQuizMode(true);
        setQuizStartTime(Date.now());
        setShowQuizResult(false);
        
        // Set first question
        setSelectedRootNote(questions[0].note);
        setSelectedCagedShape(questions[0].shape);
        setIsRevealed(false);
    };

    const handleReveal = () => {
        setIsRevealed(true);
    };

    const handleQuizAnswer = (correct: boolean) => {
        const timeSeconds = (Date.now() - quizStartTime) / 1000;
        const newAnswers = [...userAnswers, { correct, timeSeconds }];
        setUserAnswers(newAnswers);

        if (currentQuestionIndex < quizQuestions.length - 1) {
            // Next question
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            setSelectedRootNote(quizQuestions[nextIndex].note);
            setSelectedCagedShape(quizQuestions[nextIndex].shape);
            setQuizStartTime(Date.now());
            setIsRevealed(false);
        } else {
            // Quiz complete
            setShowQuizResult(true);
            saveQuizResults(newAnswers, timeSeconds);
        }
    };

    const saveQuizResults = async (answers: Array<{correct: boolean, timeSeconds: number}>, totalTime: number) => {
        if (!state.user) return;

        const accuracy = Math.round((answers.filter(a => a.correct).length / answers.length) * 4) + 1; // 1-5 scale
        const score = Math.round((answers.filter(a => a.correct).length / answers.length) * 100);

        try {
            await supabase.from('caged_sessions').insert([{
                user_id: state.user.uid,
                session_date: new Date().toISOString().split('T')[0],
                shapes: [selectedCagedShape],
                accuracy,
                time_seconds: Math.round(totalTime),
                score,
                notes: `Quiz session: ${answers.filter(a => a.correct).length}/${answers.length} correct answers`,
                recording: ''
            }]);
            
            await refreshData();
        } catch (error) {
            console.error('Error saving quiz results:', error);
        }
    };

    const exitQuiz = () => {
        setIsQuizMode(false);
        setShowQuizResult(false);
        setQuizQuestions([]);
        setUserAnswers([]);
        setIsRevealed(false);
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-text-primary mb-2">CAGED System Explorer</h1>
                    <p className="text-text-secondary">
                        {isQuizMode 
                            ? `Quiz Mode - Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`
                            : "Learn chord shapes and their relationships across the fretboard"
                        }
                    </p>
                </div>

                {/* Main Controls */}
                {!showAnalytics && (
                    <div className="bg-surface p-6 rounded-lg mb-8">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                            {/* Shape & Root Selection */}
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="text-center">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">Root Note</label>
                                    <select 
                                        value={selectedRootNote}
                                        onChange={(e) => setSelectedRootNote(e.target.value as Note)}
                                        disabled={isQuizMode}
                                        className="bg-background p-3 rounded-lg border border-border text-xl font-bold text-center min-w-[80px]"
                                    >
                                        {ALL_NOTES.map(note => (
                                            <option key={note} value={note}>{note}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="text-center">
                                    <label className="block text-sm font-medium text-text-secondary mb-2">CAGED Shape</label>
                                    <select 
                                        value={selectedCagedShape}
                                        onChange={(e) => setSelectedCagedShape(e.target.value as CagedShape)}
                                        disabled={isQuizMode}
                                        className="bg-background p-3 rounded-lg border border-border text-xl font-bold text-center min-w-[80px]"
                                    >
                                        {(['C', 'A', 'G', 'E', 'D'] as CagedShape[]).map(shape => (
                                            <option key={shape} value={shape}>{shape}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Current Chord Display */}
                            <div className="text-center">
                                <div className="text-3xl font-bold text-primary mb-1">
                                    {selectedRootNote} ({selectedCagedShape} Shape)
                                </div>
                                <div className="text-sm text-text-secondary">
                                    {selectedRootNote} Major - {selectedCagedShape} Shape<br/>
                                    <span className="text-xs">Root on {CAGED_SHAPES[selectedCagedShape].rootStringName}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {!isQuizMode ? (
                                    <>
                                        <button 
                                            onClick={handleRandomize}
                                            className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2"
                                        >
                                            <span>🎲</span>
                                            <span>Randomize</span>
                                        </button>
                                        <button 
                                            onClick={startQuiz}
                                            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2"
                                        >
                                            <span>🧠</span>
                                            <span>Quiz Me</span>
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex gap-3">
                                        {!isRevealed ? (
                                            <button 
                                                onClick={handleReveal}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 hover:scale-105"
                                            >
                                                👁️ Reveal Answer
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => handleQuizAnswer(true)}
                                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 hover:scale-105"
                                                >
                                                    ✓ I Got It Right
                                                </button>
                                                <button 
                                                    onClick={() => handleQuizAnswer(false)}
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 hover:scale-105"
                                                >
                                                    ✗ I Got It Wrong
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={exitQuiz}
                                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                                        >
                                            Exit Quiz
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Quiz Results */}
                {showQuizResult && (
                    <div className="bg-surface p-6 rounded-lg mb-8 text-center">
                        <h2 className="text-2xl font-bold text-primary mb-4">Quiz Complete! 🎉</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div>
                                <div className="text-2xl font-bold text-primary">{userAnswers.filter(a => a.correct).length}/{userAnswers.length}</div>
                                <div className="text-sm text-text-secondary">Correct</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-primary">{Math.round((userAnswers.filter(a => a.correct).length / userAnswers.length) * 100)}%</div>
                                <div className="text-sm text-text-secondary">Accuracy</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-primary">{Math.round(userAnswers.reduce((sum, a) => sum + a.timeSeconds, 0))}s</div>
                                <div className="text-sm text-text-secondary">Total Time</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-primary">{Math.round(userAnswers.reduce((sum, a) => sum + a.timeSeconds, 0) / userAnswers.length)}s</div>
                                <div className="text-sm text-text-secondary">Avg Time</div>
                            </div>
                        </div>
                        <button 
                            onClick={exitQuiz}
                            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg"
                        >
                            Continue Learning
                        </button>
                    </div>
                )}

                {/* Mode Toggle */}
                <div className="flex justify-center mb-8">
                    <div className="flex bg-background rounded-lg p-1 border border-border">
                        <button 
                            onClick={() => setShowAnalytics(false)}
                            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                                !showAnalytics 
                                    ? 'bg-primary text-white' 
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            🎸 Learn Shapes
                        </button>
                        <button 
                            onClick={() => setShowAnalytics(true)}
                            className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                                showAnalytics 
                                    ? 'bg-primary text-white' 
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            📊 View Analytics
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                {showAnalytics ? (
                    <CAGEDHeatmap sessions={state.cagedSessions} />
                ) : (
                    <>
                        {/* Fretboard Visualization */}
                        <div className="mb-8">
                            <Fretboard 
                                highlightedNotes={highlightedNotes}
                                showFretNumbers={true}
                                fretCount={15}
                            />
                        </div>

                        {/* Legend */}
                        <div className="bg-surface p-4 rounded-lg">
                            <h3 className="text-lg font-semibold text-text-primary mb-3 text-center">Chord Tone Legend</h3>
                            <div className="flex justify-center space-x-8">
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">R</div>
                                    <span className="text-text-secondary">Root</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">3</div>
                                    <span className="text-text-secondary">Third</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">5</div>
                                    <span className="text-text-secondary">Fifth</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Helper functions
const getIntervalSemitones = (interval: 'R' | '3' | '5'): number => {
    switch (interval) {
        case 'R': return 0;  // Root
        case '3': return 4;  // Major third
        case '5': return 7;  // Perfect fifth
        default: return 0;
    }
};

const getIntervalColor = (interval: 'R' | '3' | '5'): string => {
    switch (interval) {
        case 'R': return 'bg-red-500';   // Root - Red
        case '3': return 'bg-blue-500';  // Third - Blue  
        case '5': return 'bg-green-500'; // Fifth - Green
        default: return 'bg-gray-500';
    }
};