import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface GoalSuggestionRequest {
  practiceSessions: Array<{
    date: string;
    duration: number;
    techniques: string[];
    songs: string[];
    notes: string;
  }>;
  repertoire: Array<{
    title: string;
    artist: string;
    difficulty: string;
    mastery: number;
    lastPracticed?: string;
  }>;
  goals: Array<{
    title: string;
    category: string;
    status: string;
    progress: number;
    targetDate: string;
  }>;
  noteFinderAttempts: Array<{
    noteName: string;
    correct: boolean;
  }>;
  userLevel: string;
}

interface GoalSuggestion {
  title: string;
  category: string;
  description: string;
  reasoning: string;
  targetDate: string;
  priority: 'high' | 'medium' | 'low';
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
      practiceSessions = [], 
      repertoire = [], 
      goals = [], 
      noteFinderAttempts = [],
      userLevel = 'intermediate'
    }: GoalSuggestionRequest = await req.json();

    // Analyze current state
    const activeGoals = goals.filter(g => g.status === 'Active');
    const completedGoals = goals.filter(g => g.status === 'Completed');
    const weakNotes = noteFinderAttempts
      .reduce((acc, attempt) => {
        acc[attempt.noteName] = acc[attempt.noteName] || { correct: 0, total: 0 };
        acc[attempt.noteName].total++;
        if (attempt.correct) acc[attempt.noteName].correct++;
        return acc;
      }, {} as Record<string, { correct: number; total: number }>);
    
    const weakNotesList = Object.entries(weakNotes)
      .filter(([_, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.7)
      .map(([note, _]) => note)
      .slice(0, 5);

    const recentTechniques = practiceSessions
      .slice(0, 10)
      .flatMap(s => s.techniques)
      .reduce((acc, tech) => {
        acc[tech] = (acc[tech] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const masterySongs = repertoire.filter(item => item.mastery >= 80);
    const strugglingWithSongs = repertoire.filter(item => item.mastery < 50 && item.mastery > 0);
    const neglectedSongs = repertoire.filter(item => {
      if (!item.lastPracticed) return true;
      const daysSince = (Date.now() - new Date(item.lastPracticed).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 14;
    });

    const prompt = `You are an expert guitar instructor analyzing a student's comprehensive data to suggest personalized, achievable goals. 

STUDENT PROFILE:
- Skill level: ${userLevel}
- Active goals: ${activeGoals.length} (${activeGoals.map(g => g.title).join(', ')})
- Completed goals: ${completedGoals.length}
- Total practice sessions: ${practiceSessions.length}
- Repertoire: ${repertoire.length} songs

PERFORMANCE DATA:
- Note finder weak spots: ${weakNotesList.join(', ') || 'None identified'}
- Recent technique focus: ${Object.entries(recentTechniques).slice(0, 3).map(([tech, count]) => `${tech} (${count}x)`).join(', ')}
- Songs with high mastery (80%+): ${masterySongs.map(s => s.title).slice(0, 5).join(', ')}
- Songs needing work (<50%): ${strugglingWithSongs.map(s => s.title).slice(0, 5).join(', ')}
- Neglected songs (not practiced in 2+ weeks): ${neglectedSongs.map(s => s.title).slice(0, 3).join(', ')}

REPERTOIRE DETAILS:
${repertoire.slice(0, 8).map(item => `
- "${item.title}" by ${item.artist} (${item.difficulty}, ${item.mastery}% mastery)
`).join('')}

Based on this analysis, suggest 3-4 specific, achievable goals that would most benefit this student's musical development. Avoid duplicating existing active goals.

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Goal title",
      "category": "Technique|Song|Theory|Performance", 
      "description": "Detailed description of what this goal involves",
      "reasoning": "Why this goal is important for this student right now",
      "targetDate": "YYYY-MM-DD (3-6 months from now)",
      "priority": "high|medium|low"
    }
  ]
}

Make goals specific, measurable, and tailored to their current skill level and practice patterns.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert guitar instructor who creates personalized, achievable goals based on student performance data.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0]?.message?.content || '{"suggestions": []}');

    return new Response(
      JSON.stringify(result.suggestions || []),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Goal Suggestions Error:', error);
    
    // Fallback suggestions
    const fallbackSuggestions = [
      {
        title: "Master Your Weak Notes",
        category: "Technique",
        description: "Use the Note Finder tool to practice identifying and playing your most challenging notes until you achieve 90% accuracy.",
        reasoning: "Improving note recognition will enhance your overall fretboard knowledge and musical fluency.",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: "high"
      },
      {
        title: "Complete a New Song",
        category: "Song", 
        description: "Choose a song slightly above your current skill level and work it up to 80% mastery.",
        reasoning: "Learning new material challenges you and expands your musical vocabulary.",
        targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: "medium"
      }
    ];

    return new Response(
      JSON.stringify(fallbackSuggestions),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});