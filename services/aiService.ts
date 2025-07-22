import { NoteFinderAttempt, Note, PracticeSession, Goal } from '../types';
import { analyzeNotePerformance, generateNoteRecommendations } from '../utils/aiRecommendations';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

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
  private async callOpenAI(messages: any[], temperature = 0.7) {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async generateNaturalLanguageCoaching(
    attempts: NoteFinderAttempt[], 
    goals: Goal[] = []
  ): Promise<AICoachingResponse> {
    const performance = analyzeNotePerformance(attempts);
    const recommendations = generateNoteRecommendations(attempts);
    
    // Get the most problematic notes
    const weakNotes = performance
      .filter(p => p.needsPractice)
      .sort((a, b) => b.difficultyScore - a.difficultyScore)
      .slice(0, 5);

    // Get strong notes for context
    const strongNotes = performance
      .filter(p => p.accuracy > 0.8 && p.totalAttempts >= 5)
      .slice(0, 3);

    const userGoalsContext = goals.length > 0 
      ? `The user has the following active goals: ${goals.map(g => `"${g.title}" (${g.progress}% complete)`).join(', ')}.`
      : 'The user has not set any specific goals yet.';

    const prompt = `You are an expert guitar teacher providing personalized coaching based on a student's fretboard note-finding practice data.

PERFORMANCE DATA:
- Total practice attempts: ${attempts.length}
- Overall skill level: ${recommendations.difficultyLevel}
- Recommended fret range: 0-${recommendations.maxFrets}

WEAK AREAS (need practice):
${weakNotes.map(note => 
  `- ${note.note}: ${Math.round(note.accuracy * 100)}% accuracy, avg ${(note.avgTimeMs/1000).toFixed(1)}s response time, ${note.totalAttempts} attempts`
).join('\n')}

STRONG AREAS:
${strongNotes.map(note => 
  `- ${note.note}: ${Math.round(note.accuracy * 100)}% accuracy, avg ${(note.avgTimeMs/1000).toFixed(1)}s response time`
).join('\n')}

GOALS CONTEXT:
${userGoalsContext}

Please provide:
1. Natural, encouraging coaching commentary (2-3 sentences) that identifies patterns and explains WHY certain notes are challenging
2. 3-4 specific practice recommendations
3. 2-3 musical insights about the problem areas (theory, common keys, etc.)

Be conversational, encouraging, and educational. Mention specific musical concepts when helpful.

Respond in JSON format:
{
  "coaching": "Your encouraging analysis here...",
  "recommendations": ["Specific practice tip 1", "Tip 2", "Tip 3"],
  "insights": ["Musical insight 1", "Insight 2"]
}`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are an expert guitar instructor providing personalized coaching.' },
        { role: 'user', content: prompt }
      ]);

      return JSON.parse(response);
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
    if (sessions.length === 0) {
      return "No practice sessions to analyze yet. Start logging your practice to get personalized insights!";
    }

    const recentSessions = sessions.slice(0, 5);
    const sessionSummary = recentSessions.map(session => ({
      date: session.date,
      duration: session.duration,
      techniques: session.techniques,
      songs: session.songs,
      notes: session.notes,
    }));

    const prompt = `As an expert guitar instructor, analyze these recent practice sessions and provide insights:

${sessionSummary.map((session, i) => `
Session ${i + 1} (${session.date}):
- Duration: ${session.duration} minutes
- Techniques: ${session.techniques.join(', ') || 'None specified'}
- Songs: ${session.songs.join(', ') || 'None specified'}
- Notes: "${session.notes || 'No notes'}"
`).join('\n')}

Provide a thoughtful analysis in 2-3 paragraphs covering:
1. Practice patterns and consistency
2. Areas of focus and progress
3. Suggestions for improvement

Be encouraging and specific.`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are an expert guitar instructor analyzing practice journals.' },
        { role: 'user', content: prompt }
      ]);

      return response;
    } catch (error) {
      console.error('Journal Analysis Error:', error);
      return "I'm having trouble analyzing your practice journal right now. Please check your AI service configuration.";
    }
  }

  async generatePersonalizedExercise(
    attempts: NoteFinderAttempt[],
    goals: Goal[],
    focusArea?: string
  ): Promise<AIExerciseRoutine> {
    const recommendations = generateNoteRecommendations(attempts);
    
    const prompt = `Create a personalized guitar practice routine based on this data:

STUDENT PROFILE:
- Skill level: ${recommendations.difficultyLevel}
- Fret range: 0-${recommendations.maxFrets}
- Problem notes: ${recommendations.priorityNotes.slice(0, 3).join(', ')}
- Strong notes: ${recommendations.maintenanceNotes.slice(0, 2).join(', ')}
- Goals: ${goals.map(g => g.title).join(', ') || 'No specific goals'}
- Focus area: ${focusArea || 'General improvement'}

Create a 15-20 minute practice routine with 3-4 specific exercises that address the student's weak areas while maintaining their strengths.

Respond in JSON format:
{
  "title": "Routine name",
  "description": "Brief description of what this routine accomplishes",
  "exercises": [
    {
      "name": "Exercise name",
      "instructions": "Detailed step-by-step instructions",
      "duration": "X minutes",
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "estimatedTime": "X minutes"
}`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are an expert guitar instructor creating personalized practice routines.' },
        { role: 'user', content: prompt }
      ], 0.8);

      return JSON.parse(response);
    } catch (error) {
      console.error('Exercise Generation Error:', error);
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
    attempts?: NoteFinderAttempt[];
    currentNote?: Note;
    userLevel?: string;
  }): Promise<string> {
    const contextInfo = context ? `
STUDENT CONTEXT:
- Current skill level: ${context.userLevel || 'Unknown'}
- Currently working on: ${context.currentNote || 'Various notes'}
- Practice history available: ${context.attempts ? 'Yes' : 'No'}
` : '';

    const prompt = `You are an expert guitar instructor answering a music theory question. Be clear, practical, and educational.

${contextInfo}

QUESTION: ${question}

Provide a helpful answer that:
1. Explains the concept clearly
2. Relates it to guitar playing when possible
3. Gives practical examples
4. Matches the student's level

Keep it conversational and encouraging.`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are a patient, knowledgeable guitar instructor explaining music theory concepts.' },
        { role: 'user', content: prompt }
      ]);

      return response;
    } catch (error) {
      console.error('Theory Question Error:', error);
      return "I'm having trouble accessing music theory information right now. Please check your AI service configuration and try again.";
    }
  }
}

export const aiService = new AIService();