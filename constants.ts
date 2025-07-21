import { Note, CagedShape, FretPosition } from './types';

export const ALL_NOTES: Note[] = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// High E to Low E - Standard Tablature Order
export const GUITAR_TUNING: Note[] = ['E', 'B', 'G', 'D', 'A', 'E'];

export const FRET_COUNT = 15;

// String numbers: 0=High E, 1=B, 2=G, 3=D, 4=A, 5=Low E
export const CAGED_SHAPES: Record<CagedShape, { name: CagedShape; intervals: { string: number; fret: number; type: 'R' | '3' | '5' }[] }> = {
    C: { name: 'C', intervals: [ { string: 4, fret: 3, type: 'R' }, { string: 3, fret: 2, type: '3' }, { string: 2, fret: 0, type: '5' }, { string: 1, fret: 1, type: 'R' }, { string: 0, fret: 0, type: '3' } ] },
    A: { name: 'A', intervals: [ { string: 4, fret: 0, type: 'R' }, { string: 3, fret: 2, type: '5' }, { string: 2, fret: 2, type: 'R' }, { string: 1, fret: 2, type: '3' }, { string: 0, fret: 0, type: '5' } ] },
    G: { name: 'G', intervals: [ { string: 5, fret: 3, type: 'R' }, { string: 4, fret: 2, type: '3' }, { string: 3, fret: 0, type: '5' }, { string: 2, fret: 0, type: 'R' }, { string: 1, fret: 0, type: '3' }, { string: 0, fret: 3, type: 'R' } ] },
    E: { name: 'E', intervals: [ { string: 5, fret: 0, type: 'R' }, { string: 4, fret: 2, type: '5' }, { string: 3, fret: 2, type: 'R' }, { string: 2, fret: 1, type: '3' }, { string: 1, fret: 0, type: '5' }, { string: 0, fret: 0, type: 'R' } ] },
    D: { name: 'D', intervals: [ { string: 3, fret: 0, type: 'R' }, { string: 2, fret: 2, type: '5' }, { string: 1, fret: 3, type: 'R' }, { string: 0, fret: 2, type: '3' } ] },
};

export const MOOD_OPTIONS = ['Excellent', 'Good', 'Okay', 'Challenging', 'Frustrated'];
export const DIFFICULTY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];