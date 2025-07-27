import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface JournalAnalysisRequest {
  sessions: Array<{
    date: string;
    duration: number;
    techniques: string[];
    songs: string[];
    notes: string;
  }>;
  repertoire?: Array<{
    title: string;
    artist: string;
    difficulty: string;
    mastery: number;
    lastPracticed?: string;
  }>;
  goals?: Array<{
    title: string;
    category: string;
    status: string;
    progress: number;
    targetDate: string;
  }>;
  noteFinderAttempts?: Array<{
    noteName: string;
    correct: boolean;
  }>;
  userLevel?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { 
      sessions, 
      repertoire = [], 
      goals = [], 
      noteFinderAttempts = [],
      userLevel = 'intermediate'
    }: JournalAnalysisRequest = await req.json();

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify("No practice sessions to analyze yet. Start logging your practice to get personalized insights!"),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const recentSessions = sessions.slice(0, 5);
    
    // Calculate practice statistics
    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const allTechniques = sessions.flatMap(s => s.techniques);
    const allSongs = sessions.flatMap(s => s.songs);
    const techniqueCount = allTechniques.length;
    const songCount = allSongs.length;
    
    const prompt = `You are an expert guitar instructor analyzing a student's comprehensive practice data. Provide insightful, encouraging analysis with specific observations and actionable recommendations.

PRACTICE SESSIONS (${sessions.length} recent sessions, ${totalTime} total minutes):
${recentSessions.map((session, i) => `
${session.date} - ${session.duration}min
Techniques: ${session.techniques.join(', ') || 'None'}
Songs: ${session.songs.join(', ') || 'None'}
Notes: "${session.notes || 'No notes'}"
`).join('')}

REPERTOIRE (${repertoire.length} songs):
${repertoire.slice(0, 10).map(item => `
- "${item.title}" by ${item.artist} (${item.difficulty}, ${item.mastery}% mastery, last: ${item.lastPracticed || 'never'})
`).join('')}

GOALS (${goals.length} total):
${goals.slice(0, 5).map(goal => `
- "${goal.title}" (${goal.category}, ${goal.status}, ${goal.progress}% complete)
`).join('')}

PRACTICE PATTERNS:
- Technique focus: ${Math.round((techniqueCount / (techniqueCount + songCount)) * 100)}% techniques, ${Math.round((songCount / (techniqueCount + songCount)) * 100)}% songs
- Note finder accuracy: ${noteFinderAttempts.length > 0 ? Math.round((noteFinderAttempts.filter(a => a.correct).length / noteFinderAttempts.length) * 100) + '%' : 'No data'}
- Skill level: ${userLevel}

Provide analysis in 3-4 paragraphs covering:
1. Practice consistency and patterns
2. Progress on repertoire and goals
3. Strengths and areas for improvement
4. Specific actionable recommendations

Be encouraging, specific, and reference actual songs/techniques/goals by name.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert guitar instructor analyzing practice journals.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content || 'Unable to analyze practice journal at this time.';

    return new Response(
      JSON.stringify(analysis),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Journal Analysis Error:', error);
    return new Response(
      JSON.stringify("I'm having trouble analyzing your practice journal right now. Your consistent practice is still building great habits!"),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});