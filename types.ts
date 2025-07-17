
export interface User {
  uid: string;
  isAnonymous: boolean;
  name: string | null;
  email: string | null;
}

export enum Mood {
  Excellent = 'Excellent',
  Good = 'Good',
  Okay = 'Okay',
  Challenging = 'Challenging',
  Frustrated = 'Frustrated',
}

export interface Recording {
  id: string; // Will store the full path to the file in Firebase Storage for deletion
  name: string;
  type: 'audio' | 'video';
  url: string; // This will now be a permanent Cloud Storage URL
  // The 'file' property is temporary for upload and not stored in the database.
}

export interface PracticeSession {
  id: string;
  userId: string;
  date: string;
  duration: number; // in minutes
  mood: Mood;
  techniques: string[];
  songs: string[];
  notes: string;
  tags: string[];
  recordings: Recording[];
  link?: string;
}

export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export interface RepertoireItem {
  id: string;
  userId: string;
  title: string;
  artist: string;
  difficulty: Difficulty;
  mastery: number; // 0-100
  dateAdded: string;
  lastPracticed?: string;
  notes: string;
}

export enum GoalStatus {
    Active = 'Active',
    Completed = 'Completed'
}

export enum GoalCategory {
    Technique = 'Technique',
    Song = 'Song',
    Theory = 'Theory',
    Performance = 'Performance'
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate: string;
  status: GoalStatus;
  progress: number; // 0-100
  category: GoalCategory;
}

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';
export type Note = 'A' | 'A#' | 'B' | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#';

export interface FretPosition {
  string: number;
  fret: number;
}