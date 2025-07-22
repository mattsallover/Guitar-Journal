// AI Tutor Service - Intelligent practice recommendations and difficulty adjustment
import { CAGEDSession, NoteFinderAttempt, Goal, RepertoireItem, CagedShape, Note } from '../types';
import { ALL_NOTES } from '../constants';
import { 
  analyzeNotePerformance, 
  analyzeCAGEDPerformance, 
  calculateWeakAreas, 
  calculateStrongAreas,
  getRecommendationWeights
} from '../utils/performanceAnalysis';

export interface AIRecommendation {
  type: 'note-finder' | 'caged-explorer';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  content: any; // Specific content to practice
  difficulty: DifficultyAdjustment;
}

export interface DifficultyAdjustment {
  level: 'beginner' | 'intermediate' | 'advanced';
  fretRange?: [number, number];
  stringRange?: number[];
  quizMode?: 'find-any' | 'find-all' | 'find-on-string' | 'combo';
  numQuestions?: number;
  timeLimit?: number;
}

export interface UserPerformanceProfile {
  // Note Finder Performance
  noteAccuracy: Record<Note, number>; // 0-100
  noteSpeed: Record<Note, number>; // average seconds
  noteAttempts: Record<Note, number>;
  noteLastPracticed: Record<Note, string>; // ISO date string
  
  // CAGED Performance
  shapeAccuracy: Record<CagedShape, number>; // 0-100
  shapeSpeed: Record<CagedShape, number>; // average seconds
  shapeAttempts: Record<CagedShape, number>;
  shapeLastPracticed: Record<CagedShape, string>; // ISO date string
  
  // Overall Progress
  overallAccuracy: number;
  totalPracticeTime: number; // minutes
  practiceStreak: number; // days
  lastPracticeDate: string;
}

export class AITutorService {
  /**
   * Generate personalized practice recommendations
   */
  static generateRecommendations(
    userProfile: UserPerformanceProfile,
    goals: Goal[],
    recentActivity: { cagedSessions: CAGEDSession[]; noteFinderAttempts: NoteFinderAttempt[] }
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    
    // 1. Goal-Aligned Recommendations (Highest Priority)
    const goalRecommendations = this.generateGoalAlignedRecommendations(userProfile, goals);
    recommendations.push(...goalRecommendations);
    
    // 2. Weakness-Targeted Recommendations (High Priority)
    const weaknessRecommendations = this.generateWeaknessRecommendations(userProfile);
    recommendations.push(...weaknessRecommendations);
    
    // 3. Maintenance Recommendations (Medium Priority)
    const maintenanceRecommendations = this.generateMaintenanceRecommendations(userProfile);
    recommendations.push(...maintenanceRecommendations);
    
    // 4. Variety & Engagement (Low Priority)
    const varietyRecommendations = this.generateVarietyRecommendations(userProfile, recentActivity);
    recommendations.push(...varietyRecommendations);
    
    // Sort by priority and return top recommendations
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 5); // Return top 5 recommendations
  }
  
  /**
   * Generate AI-optimized Note Finder quiz
   */
  static generateNoteFinderQuiz(
    userProfile: UserPerformanceProfile,
    requestedMode?: 'find-any' | 'find-all' | 'find-on-string' | 'combo',
    numQuestions: number = 12
  ): { notes: Note[]; mode: string; difficulty: DifficultyAdjustment } {
    const weakNotes = this.getWeakestNotes(userProfile, 5);
    const mediumNotes = this.getMediumNotes(userProfile, 4);
    const strongNotes = this.getStrongestNotes(userProfile, 3);
    
    // Weighted selection: 60% weak, 30% medium, 10% strong
    const selectedNotes: Note[] = [
      ...this.selectRandomly(weakNotes, Math.ceil(numQuestions * 0.6)),
      ...this.selectRandomly(mediumNotes, Math.ceil(numQuestions * 0.3)),
      ...this.selectRandomly(strongNotes, Math.ceil(numQuestions * 0.1))
    ].slice(0, numQuestions);
    
    // Determine optimal difficulty
    const difficulty = this.calculateNoteDifficulty(userProfile, selectedNotes);
    
    return {
      notes: this.shuffleArray(selectedNotes),
      mode: requestedMode || difficulty.quizMode || 'find-any',
      difficulty
    };
  }
  
  /**
   * Generate AI-optimized CAGED quiz
   */
  static generateCAGEDQuiz(
    userProfile: UserPerformanceProfile,
    numQuestions: number = 5
  ): { shapes: CagedShape[]; roots: Note[]; difficulty: DifficultyAdjustment } {
    const weakShapes = this.getWeakestShapes(userProfile);
    const strongShapes = this.getStrongestShapes(userProfile);
    
    // Prioritize weak shapes, mix in some strong ones for confidence
    const selectedShapes = [
      ...weakShapes.slice(0, Math.ceil(numQuestions * 0.7)),
      ...strongShapes.slice(0, Math.floor(numQuestions * 0.3))
    ].slice(0, numQuestions);
    
    // Select appropriate root notes (start with common keys, expand based on proficiency)
    const rootNotes = this.selectOptimalRootNotes(userProfile, numQuestions);
    
    const difficulty = this.calculateCAGEDDifficulty(userProfile);
    
    return {
      shapes: selectedShapes,
      roots: rootNotes,
      difficulty
    };
  }
  
  /**
   * Provide real-time difficulty adjustment during practice
   */
  static adjustDifficultyRealTime(
    currentPerformance: { correct: number; total: number; avgTime: number },
    currentDifficulty: DifficultyAdjustment,
    practiceType: 'note-finder' | 'caged-explorer'
  ): DifficultyAdjustment {
    const accuracy = currentPerformance.correct / currentPerformance.total;
    const newDifficulty = { ...currentDifficulty };
    
    if (practiceType === 'note-finder') {
      // Adjust fret range based on performance
      if (accuracy >= 0.8 && currentPerformance.avgTime < 2.0) {
        // Performing well, increase difficulty
        if (currentDifficulty.fretRange) {
          newDifficulty.fretRange = [
            currentDifficulty.fretRange[0],
            Math.min(currentDifficulty.fretRange[1] + 2, 15)
          ];
        }
        
        // Upgrade quiz mode
        if (currentDifficulty.quizMode === 'find-any') {
          newDifficulty.quizMode = 'find-on-string';
        } else if (currentDifficulty.quizMode === 'find-on-string') {
          newDifficulty.quizMode = 'find-all';
        }
      } else if (accuracy < 0.5 || currentPerformance.avgTime > 4.0) {
        // Struggling, decrease difficulty
        if (currentDifficulty.fretRange) {
          newDifficulty.fretRange = [
            0,
            Math.max(currentDifficulty.fretRange[1] - 2, 5)
          ];
        }
        
        // Downgrade quiz mode
        if (currentDifficulty.quizMode === 'find-all') {
          newDifficulty.quizMode = 'find-on-string';
        } else if (currentDifficulty.quizMode === 'find-on-string') {
          newDifficulty.quizMode = 'find-any';
        }
      }
    }
    
    return newDifficulty;
  }
  
  // Helper methods
  private static generateGoalAlignedRecommendations(profile: UserPerformanceProfile, goals: Goal[]): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    
    goals.filter(g => g.status === 'Active').forEach(goal => {
      if (goal.category === 'Technique') {
        // Map technique goals to practice recommendations
        if (goal.title.toLowerCase().includes('scale')) {
          recommendations.push({
            type: 'note-finder',
            priority: 'high',
            reason: `Working towards your goal: "${goal.title}"`,
            content: { focus: 'scale-notes' },
            difficulty: { level: 'intermediate', quizMode: 'find-all' }
          });
        }
        
        if (goal.title.toLowerCase().includes('chord')) {
          recommendations.push({
            type: 'caged-explorer',
            priority: 'high',
            reason: `Building chord knowledge for: "${goal.title}"`,
            content: { focus: 'chord-shapes' },
            difficulty: { level: 'intermediate' }
          });
        }
      }
    });
    
    return recommendations;
  }
  
  private static generateWeaknessRecommendations(profile: UserPerformanceProfile): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    
    // Find weakest notes
    const weakNotes = this.getWeakestNotes(profile, 3);
    if (weakNotes.length > 0) {
      recommendations.push({
        type: 'note-finder',
        priority: 'high',
        reason: `Focus on your challenging notes: ${weakNotes.join(', ')}`,
        content: { targetNotes: weakNotes },
        difficulty: { level: 'beginner', quizMode: 'find-any' }
      });
    }
    
    // Find weakest CAGED shapes
    const weakShapes = this.getWeakestShapes(profile);
    if (weakShapes.length > 0) {
      recommendations.push({
        type: 'caged-explorer',
        priority: 'high',
        reason: `Strengthen your ${weakShapes.join(', ')} shapes`,
        content: { targetShapes: weakShapes },
        difficulty: { level: 'beginner' }
      });
    }
    
    return recommendations;
  }
  
  private static generateMaintenanceRecommendations(profile: UserPerformanceProfile): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Find strong areas that haven't been practiced recently
    Object.entries(profile.noteLastPracticed).forEach(([note, lastPracticed]) => {
      if (lastPracticed < oneWeekAgo && profile.noteAccuracy[note as Note] > 80) {
        recommendations.push({
          type: 'note-finder',
          priority: 'medium',
          reason: `Maintain your strong ${note} note knowledge`,
          content: { maintenanceNote: note },
          difficulty: { level: 'intermediate', quizMode: 'find-on-string' }
        });
      }
    });
    
    return recommendations.slice(0, 2); // Limit maintenance recommendations
  }
  
  private static generateVarietyRecommendations(
    profile: UserPerformanceProfile,
    recentActivity: { cagedSessions: CAGEDSession[]; noteFinderAttempts: NoteFinderAttempt[] }
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    
    // Check what was practiced recently
    const recentNotes = recentActivity.noteFinderAttempts
      .slice(0, 10)
      .map(attempt => attempt.noteName);
    
    const recentShapes = recentActivity.cagedSessions
      .slice(0, 3)
      .flatMap(session => session.shapes);
    
    // Suggest variety if user has been focusing on similar content
    if (recentNotes.length > 0 && new Set(recentNotes).size < 3) {
      recommendations.push({
        type: 'note-finder',
        priority: 'low',
        reason: 'Try some variety with different notes',
        content: { variety: true },
        difficulty: { level: 'intermediate', quizMode: 'combo' }
      });
    }
    
    return recommendations;
  }
  
  private static getWeakestNotes(profile: UserPerformanceProfile, count: number): Note[] {
    return Object.entries(profile.noteAccuracy)
      .filter(([_, accuracy]) => accuracy < 70)
      .sort(([, a], [, b]) => a - b)
      .slice(0, count)
      .map(([note]) => note as Note);
  }
  
  private static getMediumNotes(profile: UserPerformanceProfile, count: number): Note[] {
    return Object.entries(profile.noteAccuracy)
      .filter(([_, accuracy]) => accuracy >= 70 && accuracy < 85)
      .sort(([, a], [, b]) => a - b)
      .slice(0, count)
      .map(([note]) => note as Note);
  }
  
  private static getStrongestNotes(profile: UserPerformanceProfile, count: number): Note[] {
    return Object.entries(profile.noteAccuracy)
      .filter(([_, accuracy]) => accuracy >= 85)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([note]) => note as Note);
  }
  
  private static getWeakestShapes(profile: UserPerformanceProfile): CagedShape[] {
    return Object.entries(profile.shapeAccuracy)
      .filter(([_, accuracy]) => accuracy < 70)
      .sort(([, a], [, b]) => a - b)
      .map(([shape]) => shape as CagedShape);
  }
  
  private static getStrongestShapes(profile: UserPerformanceProfile): CagedShape[] {
    return Object.entries(profile.shapeAccuracy)
      .filter(([_, accuracy]) => accuracy >= 80)
      .sort(([, a], [, b]) => b - a)
      .map(([shape]) => shape as CagedShape);
  }
  
  private static selectRandomly<T>(array: T[], count: number): T[] {
    const shuffled = this.shuffleArray([...array]);
    return shuffled.slice(0, Math.min(count, array.length));
  }
  
  private static shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  private static calculateNoteDifficulty(profile: UserPerformanceProfile, notes: Note[]): DifficultyAdjustment {
    const avgAccuracy = notes.reduce((sum, note) => sum + (profile.noteAccuracy[note] || 0), 0) / notes.length;
    
    if (avgAccuracy < 50) {
      return {
        level: 'beginner',
        fretRange: [0, 5],
        quizMode: 'find-any',
        numQuestions: 8
      };
    } else if (avgAccuracy < 80) {
      return {
        level: 'intermediate',
        fretRange: [0, 12],
        quizMode: 'find-on-string',
        numQuestions: 10
      };
    } else {
      return {
        level: 'advanced',
        fretRange: [0, 15],
        quizMode: 'find-all',
        numQuestions: 12
      };
    }
  }
  
  private static calculateCAGEDDifficulty(profile: UserPerformanceProfile): DifficultyAdjustment {
    const avgAccuracy = Object.values(profile.shapeAccuracy).reduce((sum, acc) => sum + acc, 0) / 5;
    
    if (avgAccuracy < 60) {
      return { level: 'beginner' };
    } else if (avgAccuracy < 85) {
      return { level: 'intermediate' };
    } else {
      return { level: 'advanced' };
    }
  }
  
  private static selectOptimalRootNotes(profile: UserPerformanceProfile, count: number): Note[] {
    // Start with common keys, expand based on overall proficiency
    const commonKeys: Note[] = ['C', 'G', 'D', 'A', 'E'];
    const allKeys: Note[] = [...ALL_NOTES] as Note[];
    
    const avgAccuracy = Object.values(profile.noteAccuracy).reduce((sum, acc) => sum + acc, 0) / ALL_NOTES.length;
    
    if (avgAccuracy < 70) {
      return this.selectRandomly(commonKeys, count);
    } else {
      return this.selectRandomly(allKeys, count);
    }
  }
}