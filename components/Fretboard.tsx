import React from 'react';
import { FRET_COUNT, GUITAR_TUNING, ALL_NOTES } from '../constants';
import { Note } from '../types';

interface FretboardProps {
    highlightedNotes?: { string: number; fret: number; color: string; label?: string }[];
    onFretClick?: (string: number, fret: number, note: Note) => void;
    showFretNumbers?: boolean;
    fretCount?: number;
    allFretsClickable?: boolean;
    targetString?: number; // Highlight a specific string
}

const getNoteOnFret = (stringIndex: number, fret: number): Note => {
    const openNoteIndex = ALL_NOTES.indexOf(GUITAR_TUNING[stringIndex]);
    const finalNoteIndex = (openNoteIndex + fret) % 12;
    return ALL_NOTES[finalNoteIndex];
};

export const Fretboard: React.FC<FretboardProps> = ({ highlightedNotes = [], onFretClick, showFretNumbers = true, fretCount = FRET_COUNT, allFretsClickable = false, targetString }) => {
    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

    return (
        <div className="bg-gray-900 p-4 sm:p-6 rounded-lg shadow-xl select-none">
            <div className="relative">
                {/* Layer 1: Fretboard Grid (Background, Nut, Fret Wires) */}
                <div className="flex bg-slate-800 rounded-md overflow-hidden">
                    <div className="w-8 shrink-0 bg-slate-300"></div> {/* Nut */}
                    {Array.from({ length: fretCount }).map((_, fretIndex) => (
                        <div key={fretIndex} className="w-16 h-48 border-l-2 border-slate-600"></div>
                    ))}
                </div>

                {/* Layer 2: Inlays (Under Strings) */}
                <div className="absolute inset-0 flex pointer-events-none">
                    <div className="w-8 shrink-0"></div> {/* Nut spacing */}
                    {Array.from({ length: fretCount }).map((_, fretIndex) => {
                        const fretNumber = fretIndex + 1;
                        return (
                            <div key={fretIndex} className="w-16 h-full flex justify-center items-center relative">
                                {fretMarkers.includes(fretNumber) && fretNumber !== 12 && fretNumber !== 24 && (
                                    <div className="w-5 h-5 bg-slate-700 rounded-full"></div>
                                )}
                                {(fretNumber === 12 || fretNumber === 24) && (
                                    <>
                                        <div className="absolute top-1/3 -translate-y-1/2 w-5 h-5 bg-slate-700 rounded-full"></div>
                                        <div className="absolute top-2/3 -translate-y-1/2 w-5 h-5 bg-slate-700 rounded-full"></div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Layer 3: Strings & Interactive Notes */}
                <div className="absolute inset-0 flex flex-col justify-around">
                    {GUITAR_TUNING.map((_, stringIndex) => { // stringIndex 0 is high E, 5 is low E
                        const isTargetString = targetString !== undefined && targetString === stringIndex;
                        return (
                            <div key={stringIndex} className="relative w-full flex items-center h-8">
                                <div 
                                    className={`absolute top-1/2 -translate-y-1/2 w-full z-0 ${
                                        isTargetString ? 'bg-blue-400 opacity-60' : 'bg-slate-500'
                                    }`} 
                                    style={{ height: `${1 + stringIndex * 0.25}px` }}
                                ></div>
                                <div className="flex w-full relative z-10">
                                    <div className="w-8 shrink-0"></div> {/* Nut spacing */}
                                    {Array.from({ length: fretCount }).map((_, fretIndex) => {
                                        const fretNumber = fretIndex + 1;
                                        const note = getNoteOnFret(stringIndex, fretNumber);
                                        const highlight = highlightedNotes.find(n => n.string === stringIndex && n.fret === fretNumber);
                                        const shouldShowClickableArea = highlight || (allFretsClickable && onFretClick);
                                        return (
                                            <div
                                                key={fretIndex}
                                                className={`w-16 h-full flex justify-center items-center ${shouldShowClickableArea ? 'cursor-pointer' : ''}`}
                                                onClick={() => shouldShowClickableArea && onFretClick && onFretClick(stringIndex, fretNumber, note)}
                                            >
                                                {highlight && (
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm ${highlight.color} ring-1 ring-white/70 shadow-lg ${onFretClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}>
                                                        {highlight.label || note}
                                                    </div>
                                                )}
                                                {!highlight && allFretsClickable && onFretClick && (
                                                    <div className="w-8 h-8 rounded-full border border-gray-400 border-dashed flex items-center justify-center text-xs text-gray-400 hover:border-white hover:text-white hover:bg-gray-600/30 transition-all">
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Fret Numbers */}
            {showFretNumbers && (
                <div className="flex mt-2">
                    <div className="w-8 shrink-0" /> {/* Nut spacing */}
                    {Array.from({ length: fretCount }).map((_, fretIndex) => (
                        <div key={fretIndex} className="w-16 text-center text-text-secondary font-semibold text-sm">
                            {fretMarkers.includes(fretIndex + 1) ? fretIndex + 1 : ''}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};