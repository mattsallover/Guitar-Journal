import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TheoryRequest {
  question: string;
  context?: {
    // Current session chat history
    chatHistory?: Array<{
      sender: 'user' | 'ai';
      text: string;
      timestamp: string;
    }>;
    
    // Recent activity (last 2 weeks)
    recentPracticeSessions?: Array<{
      date: string;
      duration: number;
      techniques: string[];
      songs: string[];
      notes: string;
    }>;
    recentRepertoire?: Array<{
      title: string;
      artist: string;
      difficulty: string;
      mastery: number;
    }>;
    recentGoals?: Array<{
      title: string;
      progress: number;
      category: string;
      status: string;
    }>;
    recentCAGEDSessions?: Array<{
      shapes: string[];
      accuracy: number;
      score: number;
      sessionDate: string;
    }>;
    recentNoteFinderAttempts?: Array<{
      noteName: string;
      correct: boolean;
      timeSeconds: number;
      createdAt: string;
    }>;
    
    // User skill indicators
    userLevel?: string;
    currentNote?: string;
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
      // Build comprehensive context summary
      const sections = [];
      
      // User skill level
      if (context.userLevel) {
        sections.push(`SKILL LEVEL: ${context.userLevel}`);
      }
      
      // Recent practice sessions
      if (context.recentPracticeSessions && context.recentPracticeSessions.length > 0) {
        const sessionSummary = context.recentPracticeSessions.slice(0, 3).map(session => 
          `${session.date}: ${session.duration}min - ${[...session.techniques, ...session.songs].join(', ')}`
        ).join('\n');
        sections.push(`RECENT PRACTICE (last 2 weeks):\n${sessionSummary}`);
      }
      
      // Current repertoire
      if (context.recentRepertoire && context.recentRepertoire.length > 0) {
        const repertoireSummary = context.recentRepertoire.slice(0, 5).map(item =>
          `"${item.title}" by ${item.artist} (${item.difficulty}, ${item.mastery}% mastery)`
        ).join('\n');
        sections.push(`CURRENT REPERTOIRE:\n${repertoireSummary}`);
      }
      
      // Active goals
      if (context.recentGoals && context.recentGoals.length > 0) {
        const goalsSummary = context.recentGoals.filter(g => g.status === 'Active').slice(0, 3).map(goal =>
          `${goal.title} (${goal.progress}% complete, ${goal.category})`
        ).join('\n');
        if (goalsSummary) {
          sections.push(`ACTIVE GOALS:\n${goalsSummary}`);
        }
      }
      
      // Note finder performance
      if (context.recentNoteFinderAttempts && context.recentNoteFinderAttempts.length > 0) {
        const totalAttempts = context.recentNoteFinderAttempts.length;
        const correctAttempts = context.recentNoteFinderAttempts.filter(a => a.correct).length;
        const accuracy = Math.round((correctAttempts / totalAttempts) * 100);
        sections.push(`NOTE FINDER PERFORMANCE: ${accuracy}% accuracy (${totalAttempts} recent attempts)`);
      }
      
      // CAGED performance
      if (context.recentCAGEDSessions && context.recentCAGEDSessions.length > 0) {
        const avgScore = Math.round(context.recentCAGEDSessions.reduce((sum, s) => sum + s.score, 0) / context.recentCAGEDSessions.length);
        sections.push(`CAGED PERFORMANCE: ${avgScore}/100 average score (${context.recentCAGEDSessions.length} recent sessions)`);
      }
      
      // Recent conversation context
      if (context.chatHistory && context.chatHistory.length > 0) {
        const recentMessages = context.chatHistory.slice(-6).map(msg => 
          `${msg.sender.toUpperCase()}: ${msg.text}`
        ).join('\n');
        sections.push(`RECENT CONVERSATION:\n${recentMessages}`);
      }
      
      contextInfo = sections.join('\n\n');
    }

    const fullContextInfo = contextInfo ? `
STUDENT CONTEXT:
${contextInfo}
` : 'No recent activity context available.';

    const prompt = `You are an expert guitar instructor and personal coach answering a music theory question. You have access to the student's recent practice history and conversation context.

${fullContextInfo}

QUESTION: ${question}

Provide a personalized, helpful answer that:
1. Explains the concept clearly
2. References their recent practice when relevant
3. Relates it to their current goals and repertoire
4. Gives practical examples appropriate to their skill level
5. Continues the conversation naturally if this is part of an ongoing discussion

Keep it conversational, encouraging, and personalized to their journey.`;

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
        max_tokens: 800,
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