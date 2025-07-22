import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ExerciseRequest {
  attempts: Array<{
    noteName: string;
    correct: boolean;
    timeSeconds: number;
  }>;
  goals: Array<{
    title: string;
    category: string;
  }>;
  focusArea?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { attempts, goals, focusArea }: ExerciseRequest = await req.json();

    // Analyze weak notes
    const notePerformance = new Map();
    attempts.forEach(attempt => {
      const current = notePerformance.get(attempt.noteName) || { correct: 0, total: 0 };
      current.total++;
      if (attempt.correct) current.correct++;
      notePerformance.set(attempt.noteName, current);
    });

    const weakNotes = Array.from(notePerformance.entries())
      .filter(([_, perf]) => perf.total >= 3)
      .map(([note, perf]) => ({ note, accuracy: perf.correct / perf.total }))
      .filter(n => n.accuracy < 0.7)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map(n => n.note);

    const strongNotes = Array.from(notePerformance.entries())
      .filter(([_, perf]) => perf.total >= 5)
      .map(([note, perf]) => ({ note, accuracy: perf.correct / perf.total }))
      .filter(n => n.accuracy > 0.8)
      .slice(0, 2)
      .map(n => n.note);

    const skillLevel = attempts.length < 50 ? 'beginner' : 
                      attempts.length < 200 ? 'intermediate' : 'advanced';

    const prompt = `Create a personalized guitar practice routine based on this data:

STUDENT PROFILE:
- Skill level: ${skillLevel}
- Problem notes: ${weakNotes.join(', ') || 'None identified yet'}
- Strong notes: ${strongNotes.join(', ') || 'Building up!'}
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert guitar instructor creating personalized practice routines.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const routine = JSON.parse(data.choices[0]?.message?.content || '{}');

    return new Response(
      JSON.stringify(routine),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Exercise Generation Error:', error);
    
    // Fallback routine
    const fallbackRoutine = {
      title: "Basic Note Recognition Practice",
      description: "A simple routine to improve your fretboard knowledge",
      exercises: [
        {
          name: "Problem Note Drilling",
          instructions: "Practice identifying your weakest notes using the Note Finder tool, focusing on accuracy over speed.",
          duration: "7 minutes",
          difficulty: skillLevel || 'intermediate'
        },
        {
          name: "String-by-String Practice",
          instructions: "Choose one string and find all notes on that string from the open position to the 12th fret.",
          duration: "6 minutes",
          difficulty: skillLevel || 'intermediate'
        },
        {
          name: "Speed Building",
          instructions: "Practice finding your strongest notes as quickly as possible to build confidence.",
          duration: "5 minutes",
          difficulty: skillLevel || 'intermediate'
        }
      ],
      estimatedTime: "18 minutes"
    };

    return new Response(
      JSON.stringify(fallbackRoutine),
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