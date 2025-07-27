import { Note, CagedShape, FretPosition } from './types';

export const ALL_NOTES: Note[] = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// High E to Low E - Standard Tablature Order
export const GUITAR_TUNING: Note[] = ['E', 'B', 'G', 'D', 'A', 'E'];

export const FRET_COUNT = 15;

// String numbers: 0=High E, 1=B, 2=G, 3=D, 4=A, 5=Low E
export const CAGED_SHAPES: Record<CagedShape, { 
  name: CagedShape; 
  rootString: number;
  rootStringName: string;
  intervals: { string: number; fretOffset: number; type: 'R' | '3' | '5' }[] 
}> = {
    C: { 
        name: 'C', 
        rootString: 4,
        rootStringName: 'A string',
        intervals: [ 
            { string: 4, fretOffset: 0, type: 'R' }, // Root on A string
            { string: 3, fretOffset: -1, type: '3' }, // 3rd on D string, 1 fret lower
            { string: 2, fretOffset: -3, type: '5' }, // 5th on G string, 3 frets lower  
            { string: 1, fretOffset: -2, type: 'R' }, // Root on B string, 2 frets lower
            { string: 0, fretOffset: -3, type: '3' } // 3rd on high E, 3 frets lower
        ] 
    },
    A: { 
        name: 'A', 
        rootString: 4,
        rootStringName: 'A string',
        intervals: [ 
            { string: 4, fretOffset: 0, type: 'R' }, // Root on A string
            { string: 3, fretOffset: 2, type: '5' }, // 5th on D string, 2 frets higher
            { string: 2, fretOffset: 2, type: 'R' }, // Root on G string, 2 frets higher
            { string: 1, fretOffset: 2, type: '3' }, // 3rd on B string, 2 frets higher
            { string: 0, fretOffset: 0, type: '5' } // 5th on high E, same fret
        ] 
    },
    G: { 
        name: 'G', 
        rootString: 5,
        rootStringName: 'Low E string',
        intervals: [ 
            { string: 5, fretOffset: 0, type: 'R' }, // Root on low E
            { string: 4, fretOffset: -1, type: '3' }, // 3rd on A string, 1 fret lower
            { string: 3, fretOffset: -3, type: '5' }, // 5th on D string, 3 frets lower
            { string: 2, fretOffset: -3, type: 'R' }, // Root on G string, 3 frets lower
            { string: 1, fretOffset: -3, type: '3' }, // 3rd on B string, 3 frets lower
            { string: 0, fretOffset: 0, type: 'R' } // Root on high E, same fret
        ] 
    },
    E: { 
        name: 'E', 
        rootString: 5,
        rootStringName: 'Low E string',
        intervals: [ 
            { string: 5, fretOffset: 0, type: 'R' }, // Root on low E
            { string: 4, fretOffset: 2, type: '5' }, // 5th on A string, 2 frets higher
            { string: 3, fretOffset: 2, type: 'R' }, // Root on D string, 2 frets higher
            { string: 2, fretOffset: 1, type: '3' }, // 3rd on G string, 1 fret higher
            { string: 1, fretOffset: 0, type: '5' }, // 5th on B string, same fret
            { string: 0, fretOffset: 0, type: 'R' } // Root on high E, same fret
        ] 
    },
    D: { 
        name: 'D', 
        rootString: 3,
        rootStringName: 'D string',
        intervals: [ 
            { string: 3, fretOffset: 0, type: 'R' }, // Root on D string
            { string: 2, fretOffset: 2, type: '5' }, // 5th on G string, 2 frets higher
            { string: 1, fretOffset: 3, type: 'R' }, // Root on B string, 3 frets higher
            { string: 0, fretOffset: 2, type: '3' } // 3rd on high E, 2 frets higher
        ] 
    },
};

export const MOOD_OPTIONS = ['Excellent', 'Good', 'Okay', 'Challenging', 'Frustrated'];
export const DIFFICULTY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
export const GOAL_STATUS_OPTIONS = ['Active', 'Completed'];
export const GOAL_CATEGORY_OPTIONS = ['Technique', 'Song', 'Theory', 'Performance'];