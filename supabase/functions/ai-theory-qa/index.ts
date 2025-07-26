import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TheoryRequest {
  question: string;
  context?: {
    // Recent activity (last 2 weeks)
    recentPracticeSessions?: Array<{
      date: string;
      duration: number;
      techniques: string[];
      songs: string[];
      notes: string;
      mood: string;
    }>;
    recentRepertoire?: Array<{
      title: string;
      artist: string;
      difficulty: string;
      mastery: number;
      lastPracticed?: string;
    }>;
    recentGoals?: Array<{
      title: string;
      description: string;
      progress: number;
      status: string;
      category: string;
    }>;
    recentCAGEDSessions?: Array<{
      sessionDate: string;
      shapes: string[];
      accuracy: number;
      score: number;
    }>;
    recentNoteFinderAttempts?: Array<{
      noteName: string;
      correct: boolean;
      timeSeconds: number;
      createdAt: string;
    }>;
    
    // Current conversation
    chatHistory?: Array<{
      sender: 'user' | 'ai';
      text: string;
      timestamp: string;
    }>;
    
    // User profile
    userLevel?: string;
    totalPracticeTime?: number;
    totalSongs?: number;
    activeGoals?: number;
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

    let contextInfo = '';
    
    if (context) {
      contextInfo = `
STUDENT PROFILE:
- Skill Level: ${context.userLevel || 'Unknown'}
- Total Practice Time: ${context.totalPracticeTime || 0} minutes
- Songs in Repertoire: ${context.totalSongs || 0}
- Active Goals: ${context.activeGoals || 0}

RECENT ACTIVITY (Last 2 Weeks):`;

      if (context.recentPracticeSessions && context.recentPracticeSessions.length > 0) {
        contextInfo += `
- Practice Sessions: ${context.recentPracticeSessions.length} sessions
- Recent techniques: ${[...new Set(context.recentPracticeSessions.flatMap(s => s.techniques))].slice(0, 5).join(', ')}
- Recent songs: ${[...new Set(context.recentPracticeSessions.flatMap(s => s.songs))].slice(0, 5).join(', ')}`;
      }

      if (context.recentNoteFinderAttempts && context.recentNoteFinderAttempts.length > 0) {
        const accuracy = Math.round((context.recentNoteFinderAttempts.filter(a => a.correct).length / context.recentNoteFinderAttempts.length) * 100);
        contextInfo += `
- Note Practice: ${context.recentNoteFinderAttempts.length} attempts, ${accuracy}% accuracy`;
      }

      if (context.recentCAGEDSessions && context.recentCAGEDSessions.length > 0) {
        const avgScore = Math.round(context.recentCAGEDSessions.reduce((sum, s) => sum + s.score, 0) / context.recentCAGEDSessions.length);
        contextInfo += `
- CAGED Practice: ${context.recentCAGEDSessions.length} sessions, ${avgScore}/100 avg score`;
      }

      if (context.recentGoals && context.recentGoals.length > 0) {
        contextInfo += `
- Current Goals: ${context.recentGoals.map(g => `"${g.title}" (${g.progress}%)`).join(', ')}`;
      }

      if (context.chatHistory && context.chatHistory.length > 0) {
        contextInfo += `

RECENT CONVERSATION:`;
        const recentMessages = context.chatHistory.slice(-6); // Last 3 exchanges
        recentMessages.forEach(msg => {
          contextInfo += `
${msg.sender.toUpperCase()}: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`;
        });
      }
    }

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