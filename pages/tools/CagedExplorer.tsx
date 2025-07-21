import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Fretboard } from '../../components/Fretboard';
import { CagedShape, Note } from '../../types';
import { CAGED_SHAPES, ALL_NOTES, GUITAR_TUNING } from '../../constants';

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
    const [rootNote, setRootNote] = useState<Note>('C');
    const [cagedShape, setCagedShape] = useState<CagedShape>('C');
    const [mode, setMode] = useState<'explore' | 'quiz-question' | 'quiz-answer'>('explore');
    const [quizQuestion, setQuizQuestion] = useState<{ root: Note; shape: CagedShape } | null>(null);

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
    
    const quizAnswerNotes = useMemo(() => {
        if (!quizQuestion) return [];
        const shapeInfo = CAGED_SHAPES[quizQuestion.shape];
        const rootInterval = shapeInfo.intervals.find(i => i.type === 'R')!;

        let rootFret = getNotePosition(quizQuestion.root, rootInterval.string);
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
    }, [quizQuestion]);

    const startQuiz = () => {
        const randomRoot = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
        const randomShapeKey = Object.keys(CAGED_SHAPES)[Math.floor(Math.random() * 5)] as CagedShape;
        setQuizQuestion({ root: randomRoot, shape: randomShapeKey });
        setMode('quiz-question');
    };

    const handleReveal = () => {
        setMode('quiz-answer');
    };
    
    const notesToDisplay = mode === 'explore' ? highlightedNotes : mode === 'quiz-answer' ? quizAnswerNotes : [];

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-4">CAGED System Explorer</h1>
            
            <div className="mb-6 p-4 bg-surface rounded-lg">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold">Practice Sessions</h2>
                        <p className="text-text-secondary text-sm">Track your CAGED system progress with timed sessions</p>
                    </div>
                    <Link 
                        to="/tools/caged-sessions"
                        className="bg-secondary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md"
                    >
                        View Sessions
                    </Link>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Fretboard 
                        highlightedNotes={notesToDisplay}
                        onFretClick={undefined} // Interaction is now handled by buttons
                    />
                </div>
                <div className="bg-gray-900 p-6 rounded-lg shadow-xl">
                    {mode === 'explore' && (
                        <>
                            <h2 className="text-xl font-semibold mb-4">Controls</h2>
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
                             <button onClick={startQuiz} className="w-full mt-8 bg-secondary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                                Start Quiz
                            </button>
                        </>
                    )}
                    
                    {mode === 'quiz-question' && quizQuestion && (
                         <>
                            <h2 className="text-xl font-semibold mb-4">Quiz Mode</h2>
                            <div className="text-center bg-surface p-4 rounded-md">
                                <p className="text-text-secondary">On your guitar, find:</p>
                                <p className="text-2xl font-bold text-primary my-2">{quizQuestion.root} Major</p>
                                <p className="text-text-secondary">using the</p>
                                <p className="text-2xl font-bold text-primary my-2">{quizQuestion.shape} shape</p>
                            </div>
                            <button onClick={handleReveal} className="w-full mt-8 bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                                Reveal Answer
                            </button>
                            <button onClick={() => { setMode('explore'); }} className="w-full mt-4 bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md">
                                Back to Explore
                            </button>
                        </>
                    )}
                    
                    {mode === 'quiz-answer' && quizQuestion && (
                        <>
                            <h2 className="text-xl font-semibold mb-4">Answer</h2>
                            <div className="text-center bg-surface p-4 rounded-md">
                                <p className="text-text-primary font-semibold">This is {quizQuestion.root} Major ({quizQuestion.shape} shape)</p>
                            </div>
                            
                            <div className="mt-6 text-center">
                                <p className="text-text-secondary mb-3">Did you get it right?</p>
                                <div className="flex space-x-4">
                                    <button onClick={startQuiz} className="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-300 font-bold py-2 px-4 rounded-md transition-colors">
                                        ✅ Yes!
                                    </button>
                                    <button onClick={startQuiz} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 font-bold py-2 px-4 rounded-md transition-colors">
                                        ❌ Not quite
                                    </button>
                                </div>
                            </div>

                            <button onClick={() => { setMode('explore'); }} className="w-full mt-6 bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md">
                                Exit Quiz
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};