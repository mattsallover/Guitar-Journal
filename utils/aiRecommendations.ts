import { Note, NoteFinderAttempt } from '../types';
import { ALL_NOTES } from '../constants';

interface NotePerformance {
  note: Note;
  accuracy: number; // 0-1
  avgTimeMs: number;
  totalAttempts: number;
  lastPracticed?: Date;
  difficultyScore: number; // 0-1, higher = more difficult for user
  needsPractice: boolean;
}

interface AIRecommendation {
  priorityNotes: Note[]; // Notes to focus on (weak areas)
  maintenanceNotes: Note[]; // Notes to maintain (strong areas)  
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  maxFrets: number; // Limit fretboard range based on skill level
  recommendedMode: 'find-any' | 'find-all' | 'find-on-string';
  reasoning: string; // Human-readable explanation
}

/**
 * Analyzes user's note finder attempts and calculates performance metrics
 */
export function analyzeNotePerformance(attempts: NoteFinderAttempt[]): NotePerformance[] {
  const noteMap = new Map<Note, {
    correct: number;
    total: number;
    totalTime: number;
    lastDate?: Date;
  }>();

  // Initialize all notes
  ALL_NOTES.forEach(note => {
    noteMap.set(note as Note, { correct: 0, total: 0, totalTime: 0 });
  });

  // Process attempts
  attempts.forEach(attempt => {
    const data = noteMap.get(attempt.noteName)!;
    data.total++;
    if (attempt.correct) data.correct++;
    data.totalTime += attempt.timeSeconds * 1000; // Convert to ms
    
    const attemptDate = new Date(attempt.createdAt);
    if (!data.lastDate || attemptDate > data.lastDate) {
      data.lastDate = attemptDate;
    }
  });

  // Calculate performance metrics
  return Array.from(noteMap.entries()).map(([note, data]) => {
    const accuracy = data.total > 0 ? data.correct / data.total : 0;
    const avgTimeMs = data.total > 0 ? data.totalTime / data.total : 0;
    
    // Calculate difficulty score (higher = more difficult for user)
    let difficultyScore = 0;
    
    // Factor 1: Low accuracy increases difficulty
    difficultyScore += (1 - accuracy) * 0.4;
    
    // Factor 2: Slow response time increases difficulty  
    const slowTime = avgTimeMs > 3000 ? (avgTimeMs - 3000) / 5000 : 0; // Normalize slow times
    difficultyScore += Math.min(slowTime, 0.3) * 0.3;
    
    // Factor 3: Few attempts means unknown difficulty
    const fewAttempts = data.total < 5 ? (5 - data.total) / 5 : 0;
    difficultyScore += fewAttempts * 0.2;
    
    // Factor 4: Not practiced recently increases difficulty
    const daysSinceLastPractice = data.lastDate 
      ? (Date.now() - data.lastDate.getTime()) / (1000 * 60 * 60 * 24)
      : 30; // Assume 30 days if never practiced
    const staleness = Math.min(daysSinceLastPractice / 7, 1); // Normalize to weeks
    difficultyScore += staleness * 0.1;
    
    difficultyScore = Math.min(difficultyScore, 1); // Cap at 1.0
    
    return {
      note,
      accuracy,
      avgTimeMs,
      totalAttempts: data.total,
      lastPracticed: data.lastDate,
      difficultyScore,
      needsPractice: difficultyScore > 0.4 || data.total < 3 // High difficulty or low exposure
    };
  });
}

/**
 * Generates AI-powered recommendations for note finder practice
 */
export function generateNoteRecommendations(attempts: NoteFinderAttempt[]): AIRecommendation {
  const performance = analyzeNotePerformance(attempts);
  
  // Sort by difficulty (most difficult first)
  const sortedByDifficulty = [...performance].sort((a, b) => b.difficultyScore - a.difficultyScore);
  
  // Identify weak areas (top 6 most difficult notes)
  const priorityNotes = sortedByDifficulty
    .filter(p => p.needsPractice)
    .slice(0, 6)
    .map(p => p.note);
    
  // Identify strong areas for maintenance (notes with good accuracy and recent practice)
  const maintenanceNotes = performance
    .filter(p => p.accuracy > 0.7 && p.totalAttempts >= 5 && !p.needsPractice)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)
    .map(p => p.note);
  
  // Determine overall skill level
  const averageAccuracy = performance
    .filter(p => p.totalAttempts > 0)
    .reduce((sum, p) => sum + p.accuracy, 0) / Math.max(1, performance.filter(p => p.totalAttempts > 0).length);
    
  const totalAttempts = performance.reduce((sum, p) => sum + p.totalAttempts, 0);
  
  let difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  let maxFrets: number;
  let recommendedMode: 'find-any' | 'find-all' | 'find-on-string';
  
  if (totalAttempts < 50 || averageAccuracy < 0.6) {
    difficultyLevel = 'beginner';
    maxFrets = 5; // Only first 5 frets
    recommendedMode = 'find-any';
  } else if (totalAttempts < 200 || averageAccuracy < 0.8) {
    difficultyLevel = 'intermediate';
    maxFrets = 12; // Up to 12th fret
    recommendedMode = Math.random() > 0.5 ? 'find-any' : 'find-on-string';
  } else {
    difficultyLevel = 'advanced';
    maxFrets = 15; // Full fretboard
    recommendedMode = ['find-any', 'find-all', 'find-on-string'][Math.floor(Math.random() * 3)] as any;
  }
  
  // Generate reasoning
  let reasoning = `Based on your practice history: `;
  if (priorityNotes.length > 0) {
    reasoning += `Focus on ${priorityNotes.slice(0, 3).join(', ')} (these need more practice). `;
  }
  if (maintenanceNotes.length > 0) {
    reasoning += `Review ${maintenanceNotes.slice(0, 2).join(', ')} to maintain your progress. `;
  }
  reasoning += `Difficulty: ${difficultyLevel} (${Math.round(averageAccuracy * 100)}% avg accuracy).`;
  
  return {
    priorityNotes,
    maintenanceNotes,
    difficultyLevel,
    maxFrets,
    recommendedMode,
    reasoning
  };
}

/**
 * Generates an AI-optimized quiz question sequence
 */
export function generateAIQuizSequence(
  attempts: NoteFinderAttempt[], 
  numQuestions: number = 12
): { note: Note; mode: 'find-any' | 'find-all' | 'find-on-string'; targetString?: number }[] {
  const recommendations = generateNoteRecommendations(attempts);
  const sequence = [];
  
  // 70% priority notes, 20% maintenance notes, 10% random variety
  const priorityCount = Math.ceil(numQuestions * 0.7);
  const maintenanceCount = Math.ceil(numQuestions * 0.2);
  const varietyCount = numQuestions - priorityCount - maintenanceCount;
  
  // Add priority questions
  for (let i = 0; i < priorityCount; i++) {
    const note = recommendations.priorityNotes[i % recommendations.priorityNotes.length] || 
                 ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
    sequence.push({
      note,
      mode: recommendations.difficultyLevel === 'beginner' ? 'find-any' : recommendations.recommendedMode
    });
  }
  
  // Add maintenance questions
  for (let i = 0; i < maintenanceCount; i++) {
    const note = recommendations.maintenanceNotes[i % recommendations.maintenanceNotes.length] || 
                 ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
    sequence.push({
      note,
      mode: 'find-any' // Keep maintenance simple
    });
  }
  
  // Add variety questions
  for (let i = 0; i < varietyCount; i++) {
    const note = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)] as Note;
    sequence.push({
      note,
      mode: recommendations.recommendedMode
    });
  }
  
  // Shuffle the sequence to avoid patterns
  return shuffleArray(sequence);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}