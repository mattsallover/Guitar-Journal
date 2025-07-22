import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface CoachingRequest {
  attempts: Array<{
    noteName: string;
    correct: boolean;
    timeSeconds: number;
    createdAt: string;
  }>;
  goals?: Array<{
    title: string;
    progress: number;
  }>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { attempts, goals = [] }: CoachingRequest = await req.json();

    if (!attempts || attempts.length === 0) {
      return new Response(
        JSON.stringify({
          coaching: "Keep practicing to get personalized insights! Complete at least 20 attempts for AI coaching.",
          recommendations: ["Practice regularly", "Focus on accuracy first, then speed", "Try different practice modes"],
          insights: ["Consistent practice leads to better results"]
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Analyze performance data
    const notePerformance = new Map();
    
    attempts.forEach(attempt => {
      const current = notePerformance.get(attempt.noteName) || {
        correct: 0,
        total: 0,
        totalTime: 0,
        lastPracticed: new Date(0)
      };
      
      current.total++;
      if (attempt.correct) current.correct++;
      current.totalTime += attempt.timeSeconds * 1000;
      
      const attemptDate = new Date(attempt.createdAt);
      if (attemptDate > current.lastPracticed) {
        current.lastPracticed = attemptDate;
      }
      
      notePerformance.set(attempt.noteName, current);
    });

    // Find weak notes
    const weakNotes = Array.from(notePerformance.entries())
      .filter(([_, perf]) => perf.total >= 3)
      .map(([note, perf]) => ({
        note,
        accuracy: perf.correct / perf.total,
        avgTime: perf.totalTime / perf.total / 1000,
        attempts: perf.total
      }))
      .filter(n => n.accuracy < 0.8)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);

    const strongNotes = Array.from(notePerformance.entries())
      .filter(([_, perf]) => perf.total >= 5)
      .map(([note, perf]) => ({
        note,
        accuracy: perf.correct / perf.total,
        avgTime: perf.totalTime / perf.total / 1000
      }))
      .filter(n => n.accuracy > 0.8)
      .slice(0, 2);

    const goalsContext = goals.length > 0 
      ? `The user has goals: ${goals.map(g => `"${g.title}" (${g.progress}% complete)`).join(', ')}.`
      : 'No specific goals set yet.';

    const prompt = `You are an expert guitar teacher providing personalized coaching based on fretboard note-finding practice data.

PERFORMANCE DATA:
- Total attempts: ${attempts.length}
- Weak notes (need practice): ${weakNotes.map(n => `${n.note} (${Math.round(n.accuracy * 100)}% accuracy, ${n.avgTime.toFixed(1)}s avg)`).join(', ') || 'None identified'}
- Strong notes: ${strongNotes.map(n => `${n.note} (${Math.round(n.accuracy * 100)}% accuracy)`).join(', ') || 'Building up!'}

GOALS: ${goalsContext}

Provide natural, encouraging coaching in 2-3 sentences that explains patterns and gives specific advice. Then provide 3-4 actionable practice tips and 2-3 musical insights.

Respond in JSON format:
{
  "coaching": "Your encouraging analysis...",
  "recommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "insights": ["Musical insight 1", "Insight 2"]
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
          { role: 'system', content: 'You are an expert guitar instructor providing personalized coaching.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0]?.message?.content || '{}');

    return new Response(
      JSON.stringify(aiResponse),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('AI Coaching Error:', error);
    return new Response(
      JSON.stringify({
        coaching: "I'm having trouble analyzing your practice right now, but keep up the great work!",
        recommendations: [
          "Practice your weakest notes in short, focused sessions",
          "Try playing scales that contain your problem notes",
          "Use a metronome to build speed gradually"
        ],
        insights: [
          "Sharp and flat notes are often more challenging",
          "Consistent practice leads to better muscle memory"
        ]
      }),
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