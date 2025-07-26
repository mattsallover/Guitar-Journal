import { NoteFinderAttempt, Note, PracticeSession, Goal } from '../types';
import { analyzeNotePerformance, generateNoteRecommendations } from '../utils/aiRecommendations';
export interface AIQuestionContext {
  // Recent activity (last 2 weeks)
  recentPracticeSessions: Array<{
    date: string;
    duration: number;
    techniques: string[];
    songs: string[];
    notes: string;
    mood: string;
  }>;
  recentRepertoire: Array<{
    title: string;
    artist: string;
    difficulty: string;
    mastery: number;
    lastPracticed?: string;
  }>;
  recentGoals: Array<{
    title: string;
    description: string;
    progress: number;
    status: string;
    category: string;
  }>;
  recentCAGEDSessions: Array<{
    sessionDate: string;
    shapes: string[];
    accuracy: number;
    score: number;
  }>;
  recentNoteFinderAttempts: Array<{
    noteName: string;
    correct: boolean;
    timeSeconds: number;
    createdAt: string;
  }>;
  
  // Current conversation
  chatHistory: Array<{
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
  }>;
  
  // User profile
  userLevel: string;
  totalPracticeTime: number;
  totalSongs: number;
  activeGoals: number;
}
</action>
import { supabase } from './supabase';

export interface AICoachingResponse {
  coaching: string;
  recommendations: string[];
  insights: string[];
}

export interface AIExerciseRoutine {
  title: string;
  description: string;
  exercises: {
    name: string;
    instructions: string;
    duration: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }[];
  estimatedTime: string;
}

class AIService {
  async generateNaturalLanguageCoaching(
    attempts: NoteFinderAttempt[], 
    goals: Goal[] = []
  ): Promise<AICoachingResponse> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coaching`;
      
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          attempts: attempts.map(a => ({
            noteName: a.noteName,
            correct: a.correct,
            timeSeconds: a.timeSeconds,
            createdAt: a.createdAt
          })),
          goals: goals.map(g => ({
            title: g.title,
            progress: g.progress
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AI Coaching Error:', error);
      // Fallback response
      return {
        coaching: "I notice you're making great progress! Keep focusing on the notes that challenge you most.",
        recommendations: [
          "Practice your weakest notes in short, focused sessions",
          "Try playing scales that contain your problem notes",
          "Use a metronome to build speed gradually"
        ],
        insights: [
          "Sharp and flat notes are often more challenging because they appear less frequently in popular music",
          "Notes on the B and high E strings can be trickier due to the different tuning interval"
        ]
      };
    }
  }

  async analyzePracticeJournal(sessions: PracticeSession[]): Promise<string> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-journal-analysis`;
      
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessions: sessions.slice(0, 5).map(session => ({
            date: session.date,
            duration: session.duration,
            techniques: session.techniques,
            songs: session.songs,
            notes: session.notes
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Journal Analysis Error:', error);
      return "I'm having trouble analyzing your practice journal right now. Your consistent practice is still building great habits!";
    }
  }

  async generatePersonalizedExercise(
    attempts: NoteFinderAttempt[],
    goals: Goal[],
    focusArea?: string
  ): Promise<AIExerciseRoutine> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-exercise-generator`;
      
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          attempts: attempts.map(a => ({
            noteName: a.noteName,
            correct: a.correct,
            timeSeconds: a.timeSeconds
          })),
          goals: goals.map(g => ({
            title: g.title,
            category: g.category
          })),
          focusArea
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Exercise Generation Error:', error);
      
      const recommendations = generateNoteRecommendations(attempts);
      
      // Fallback routine
      return {
        title: "Basic Note Recognition Practice",
        description: "A simple routine to improve your fretboard knowledge",
        exercises: [
          {
            name: "Problem Note Drilling",
            instructions: "Practice identifying your weakest notes using the Note Finder tool for 5 minutes, focusing on accuracy over speed.",
            duration: "5 minutes",
            difficulty: recommendations.difficultyLevel
          },
          {
            name: "String-by-String Practice",
            instructions: "Choose one string and find all notes on that string from the open position to the 12th fret.",
            duration: "5 minutes", 
            difficulty: recommendations.difficultyLevel
          },
          {
            name: "Speed Building",
            instructions: "Practice finding your strongest notes as quickly as possible to build confidence and muscle memory.",
            duration: "5 minutes",
            difficulty: recommendations.difficultyLevel
          }
        ],
        estimatedTime: "15 minutes"
      };
    }
  }

  async answerMusicTheoryQuestion(question: string, context?: {
  }
  )
  async answerMusicTheoryQuestion(
    question: string, 
    context?: AIQuestionContext
  ): Promise<string> {</action>
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-theory-qa`;
      
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          context
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Theory Question Error:', error);
      return "I'm having trouble accessing music theory information right now. Keep practicing, and feel free to ask again later!";
    }
  }
}

export const aiService = new AIService();