import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface JournalRequest {
  sessions: Array<{
    date: string;
    duration: number;
    techniques: string[];
    songs: string[];
    notes: string;
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
    const { sessions }: JournalRequest = await req.json();

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
    const sessionSummary = recentSessions.map((session, i) => (`
Session ${i + 1} (${session.date}):
- Duration: ${session.duration} minutes
- Techniques: ${session.techniques.join(', ') || 'None specified'}
- Songs: ${session.songs.join(', ') || 'None specified'}
- Notes: "${session.notes || 'No notes'}"
`)).join('\n');

    const prompt = `As an expert guitar instructor, analyze these recent practice sessions and provide insights:

${sessionSummary}

Provide a thoughtful analysis in 2-3 paragraphs covering:
1. Practice patterns and consistency
2. Areas of focus and progress
3. Suggestions for improvement

Be encouraging and specific.`;

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