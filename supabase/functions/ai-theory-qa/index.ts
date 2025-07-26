import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TheoryRequest {
  question: string;
  context?: {
    attempts?: Array<{
      noteName: string;
      correct: boolean;
    }>;
    currentNote?: string;
    userLevel?: string;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { question, context }: TheoryRequest = await req.json();

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert guitar teacher with a special knack for explaining complex musical concepts in simple, relatable terms that anyone can understand. You use analogies, break down difficult ideas into digestible pieces, and always remain encouraging and supportive. You have years of experience teaching students of all levels and can adapt your explanations to match their understanding. You are passionate about helping people grow as musicians and always provide practical, actionable advice.' },
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
    const answer = data.choices[0]?.message?.content || 'I apologize, but I cannot answer that question right now.';

    return new Response(
      JSON.stringify(answer),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Theory Question Error:', error);
    return new Response(
      JSON.stringify("I'm having trouble accessing music theory information right now. Keep practicing, and feel free to ask again later!"),
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