// CAGED Analytics utilities for performance tracking and heatmap generation

import { CAGEDSession, CagedShape, Note } from '../types';
import { ALL_NOTES } from '../constants';

interface ShapePerformance {
  shape: CagedShape;
  totalAttempts: number;
  correctAnswers: number;
  accuracyRate: number; // 0-1
  avgTime: number;
  avgScore: number;
  lastPracticed?: string;
}

interface NotePerformance {
  note: Note;
  totalAttempts: number;
  correctAnswers: number;
  accuracyRate: number; // 0-1
  avgTime: number;
  avgScore: number;
  lastPracticed?: string;
}

interface HeatmapCell {
  shape: CagedShape;
  note: Note;
  attempts: number;
  accuracy: number; // 0-1
  avgScore: number;
  color: string; // hex color for heatmap
}

// Extract performance data from quiz session notes
function extractQuizPerformance(session: CAGEDSession): Array<{
  shape: CagedShape;
  note: Note;
  correct: boolean;
}> {
  const results: Array<{ shape: CagedShape; note: Note; correct: boolean }> = [];
  
  // Parse session notes to extract individual question results
  // Expected format: "Quiz session: 4/5 correct answers (5/5 questions completed)"
  // For now, we'll use a simple heuristic based on shapes and accuracy
  // TODO: In the future, store detailed quiz results in a separate table
  
  // For now, create mock data based on session performance
  // This is a simplified approach - ideally we'd store each question result
  const accuracyRate = (session.accuracy - 1) / 4; // Convert 1-5 to 0-1
  const shapesPerformed = session.shapes as CagedShape[];
  
  shapesPerformed.forEach(shape => {
    // Generate a random note for this shape (this would come from actual quiz data)
    const randomNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
    const wasCorrect = Math.random() < accuracyRate;
    
    results.push({
      shape,
      note: randomNote,
      correct: wasCorrect
    });
  });
  
  return results;
}

export function analyzeShapePerformance(sessions: CAGEDSession[]): ShapePerformance[] {
  const shapeMap = new Map<CagedShape, {
    attempts: number;
    correct: number;
    totalTime: number;
    totalScore: number;
    lastDate?: string;
  }>();
  
  // Initialize all shapes
  (['C', 'A', 'G', 'E', 'D'] as CagedShape[]).forEach(shape => {
    shapeMap.set(shape, { attempts: 0, correct: 0, totalTime: 0, totalScore: 0 });
  });
  
  sessions.forEach(session => {
    const quizResults = extractQuizPerformance(session);
    
    quizResults.forEach(result => {
      const current = shapeMap.get(result.shape)!;
      current.attempts++;
      if (result.correct) current.correct++;
      current.totalTime += session.timeSeconds / session.shapes.length; // Rough average
      current.totalScore += session.score;
      
      if (!current.lastDate || session.sessionDate > current.lastDate) {
        current.lastDate = session.sessionDate;
      }
    });
  });
  
  return Array.from(shapeMap.entries()).map(([shape, data]) => ({
    shape,
    totalAttempts: data.attempts,
    correctAnswers: data.correct,
    accuracyRate: data.attempts > 0 ? data.correct / data.attempts : 0,
    avgTime: data.attempts > 0 ? data.totalTime / data.attempts : 0,
    avgScore: data.attempts > 0 ? data.totalScore / data.attempts : 0,
    lastPracticed: data.lastDate,
  }));
}

export function analyzeNotePerformance(sessions: CAGEDSession[]): NotePerformance[] {
  const noteMap = new Map<Note, {
    attempts: number;
    correct: number;
    totalTime: number;
    totalScore: number;
    lastDate?: string;
  }>();
  
  // Initialize all notes
  ALL_NOTES.forEach(note => {
    noteMap.set(note as Note, { attempts: 0, correct: 0, totalTime: 0, totalScore: 0 });
  });
  
  sessions.forEach(session => {
    const quizResults = extractQuizPerformance(session);
    
    quizResults.forEach(result => {
      const current = noteMap.get(result.note)!;
      current.attempts++;
      if (result.correct) current.correct++;
      current.totalTime += session.timeSeconds / session.shapes.length;
      current.totalScore += session.score;
      
      if (!current.lastDate || session.sessionDate > current.lastDate) {
        current.lastDate = session.sessionDate;
      }
    });
  });
  
  return Array.from(noteMap.entries()).map(([note, data]) => ({
    note,
    totalAttempts: data.attempts,
    correctAnswers: data.correct,
    accuracyRate: data.attempts > 0 ? data.correct / data.attempts : 0,
    avgTime: data.attempts > 0 ? data.totalTime / data.attempts : 0,
    avgScore: data.attempts > 0 ? data.totalScore / data.attempts : 0,
    lastPracticed: data.lastDate,
  }));
}

export function generateHeatmapData(sessions: CAGEDSession[]): HeatmapCell[] {
  const heatmapMap = new Map<string, {
    attempts: number;
    correct: number;
    totalScore: number;
  }>();
  
  sessions.forEach(session => {
    const quizResults = extractQuizPerformance(session);
    
    quizResults.forEach(result => {
      const key = `${result.shape}-${result.note}`;
      const current = heatmapMap.get(key) || { attempts: 0, correct: 0, totalScore: 0 };
      
      current.attempts++;
      if (result.correct) current.correct++;
      current.totalScore += session.score;
      
      heatmapMap.set(key, current);
    });
  });
  
  const cells: HeatmapCell[] = [];
  
  (['C', 'A', 'G', 'E', 'D'] as CagedShape[]).forEach(shape => {
    ALL_NOTES.forEach(note => {
      const key = `${shape}-${note}`;
      const data = heatmapMap.get(key) || { attempts: 0, correct: 0, totalScore: 0 };
      
      const accuracy = data.attempts > 0 ? data.correct / data.attempts : 0;
      const avgScore = data.attempts > 0 ? data.totalScore / data.attempts : 0;
      
      // Generate color based on performance (red = poor, yellow = ok, green = excellent)
      let color: string;
      if (data.attempts === 0) {
        color = '#374151'; // Gray for no data
      } else if (accuracy >= 0.8) {
        color = '#10b981'; // Green for excellent
      } else if (accuracy >= 0.6) {
        color = '#f59e0b'; // Yellow for good
      } else if (accuracy >= 0.4) {
        color = '#f97316'; // Orange for ok
      } else {
        color = '#ef4444'; // Red for poor
      }
      
      cells.push({
        shape,
        note: note as Note,
        attempts: data.attempts,
        accuracy,
        avgScore,
        color,
      });
    });
  });
  
  return cells;
}

export function getPerformanceSummary(sessions: CAGEDSession[]) {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      avgScore: 0,
      strongestShape: null,
      weakestShape: null,
      strongestNote: null,
      weakestNote: null,
    };
  }
  
  const shapePerformance = analyzeShapePerformance(sessions);
  const notePerformance = analyzeNotePerformance(sessions);
  
  const shapesWithData = shapePerformance.filter(s => s.totalAttempts > 0);
  const notesWithData = notePerformance.filter(n => n.totalAttempts > 0);
  
  return {
    totalSessions: sessions.length,
    avgScore: Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length),
    strongestShape: shapesWithData.length > 0 
      ? shapesWithData.sort((a, b) => b.accuracyRate - a.accuracyRate)[0] 
      : null,
    weakestShape: shapesWithData.length > 0 
      ? shapesWithData.sort((a, b) => a.accuracyRate - b.accuracyRate)[0] 
      : null,
    strongestNote: notesWithData.length > 0 
      ? notesWithData.sort((a, b) => b.accuracyRate - a.accuracyRate)[0] 
      : null,
    weakestNote: notesWithData.length > 0 
      ? notesWithData.sort((a, b) => a.accuracyRate - b.accuracyRate)[0] 
      : null,
  };
}