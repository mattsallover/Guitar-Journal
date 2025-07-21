import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ChatRequest {
  message: string;
  userId: string;
}

interface ConversationHistory {
  message: string;
  response: string;
  created_at: string;
}

interface UserData {
  practiceSessions: any[];
  repertoire: any[];
  goals: any[];
  cagedSessions: any[];
  noteFinderAttempts: any[];
  recentConversations: ConversationHistory[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { message, userId }: ChatRequest = await req.json()

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: "Message and userId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user's practice data + recent conversations
    const userData = await fetchUserData(supabase, userId)

    // Create system prompt with user context + conversation history
    const systemPrompt = createSystemPrompt(userData)
    
    // Build conversation messages including recent history
    const messages = buildConversationMessages(systemPrompt, userData.recentConversations, message)

    // Call OpenAI API with conversation context
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      return new Response(
        JSON.stringify({ error: "OpenAI API error", details: errorData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices[0]?.message?.content || "Sorry, I couldn't generate a response."

    // Store this conversation for future context
    await storeConversation(supabase, userId, message, aiMessage, userData)

    return new Response(
      JSON.stringify({ message: aiMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Chat coach error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function fetchUserData(supabase: any, userId: string): Promise<UserData> {
  try {
    // Fetch last 10 practice sessions
    const { data: practiceSessions } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(10)

    // Fetch all repertoire
    const { data: repertoire } = await supabase
      .from("repertoire")
      .select("*")
      .eq("user_id", userId)
      .order("mastery", { ascending: false })

    // Fetch all goals
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Fetch recent CAGED sessions
    const { data: cagedSessions } = await supabase
      .from("caged_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("session_date", { ascending: false })
      .limit(5)

    // Fetch recent note finder attempts
    const { data: noteFinderAttempts } = await supabase
      .from("note_finder_practice")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
    
    // Fetch recent conversations (last 8 for context)
    const { data: recentConversations } = await supabase
      .from("coach_conversations")
      .select("message, response, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8)

    return {
      practiceSessions: practiceSessions || [],
      repertoire: repertoire || [],
      goals: goals || [],
      cagedSessions: cagedSessions || [],
      noteFinderAttempts: noteFinderAttempts || [],
      recentConversations: recentConversations || [],
    }
  } catch (error) {
    console.error("Error fetching user data:", error)
    return {
      practiceSessions: [],
      repertoire: [],
      goals: [],
      cagedSessions: [],
      noteFinderAttempts: [],
      recentConversations: [],
    }
  }
}

function createSystemPrompt(userData: UserData): string {
  const { practiceSessions, repertoire, goals, cagedSessions, noteFinderAttempts } = userData

  // Calculate some basic stats
  const totalPracticeTime = practiceSessions.reduce((sum, session) => sum + session.duration, 0)
  const avgMastery = repertoire.length > 0 
    ? Math.round(repertoire.reduce((sum, item) => sum + item.mastery, 0) / repertoire.length)
    : 0
  const activeGoals = goals.filter(goal => goal.status === "Active").length
  const completedGoals = goals.filter(goal => goal.status === "Completed").length

  // Get most practiced techniques and songs
  const allTechniques = practiceSessions.flatMap(s => s.techniques || [])
  const allSongs = practiceSessions.flatMap(s => s.songs || [])
  const techniqueCount = allTechniques.reduce((acc, tech) => {
    acc[tech] = (acc[tech] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const songCount = allSongs.reduce((acc, song) => {
    acc[song] = (acc[song] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topTechniques = Object.entries(techniqueCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([tech]) => tech)

  const topSongs = Object.entries(songCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([song]) => song)

  return `You are the world's greatest guitar teacher - a master educator with decades of experience who has taught everyone from complete beginners to professional musicians. You have an extraordinary gift for taking the most complex musical concepts and breaking them down into simple, relatable explanations that anyone can understand.

Your teaching style is:
- WARM AND ENCOURAGING: You make students feel confident and excited about their progress
- BRILLIANTLY SIMPLE: You turn complex theory into "aha!" moments using everyday analogies
- PRACTICAL AND ACTIONABLE: Every piece of advice leads to immediate, tangible improvement
- PATIENT AND UNDERSTANDING: You remember what it's like to struggle and meet students where they are
- INSPIRING: You help students see their potential and fall deeper in love with guitar

You use analogies like comparing chord progressions to "musical conversations" or explaining rhythm as "the heartbeat of the song." You celebrate small wins enthusiastically and turn challenges into exciting puzzles to solve together.

Remember: You're not just teaching guitar techniques - you're nurturing a lifelong musical journey. Every interaction should leave the student feeling more inspired, understood, and excited to practice.

STUDENT PROFILE:
- Total Practice Time: ${Math.floor(totalPracticeTime / 60)}h ${totalPracticeTime % 60}m across ${practiceSessions.length} recent sessions
- Average Repertoire Mastery: ${avgMastery}%
- Active Goals: ${activeGoals}, Completed Goals: ${completedGoals}
- Top Practiced Techniques: ${topTechniques.join(", ") || "None recorded"}
- Top Practiced Songs: ${topSongs.join(", ") || "None recorded"}

RECENT PRACTICE SESSIONS (Last 10):
${practiceSessions.map(session => `
• ${session.date}: ${session.duration}min - Mood: ${session.mood}
  Techniques: ${(session.techniques || []).join(", ") || "None"}
  Songs: ${(session.songs || []).join(", ") || "None"}
  Notes: ${session.notes || "No notes"}
`).join("")}

REPERTOIRE (${repertoire.length} songs):
${repertoire.slice(0, 5).map(item => `
• "${item.title}" by ${item.artist} - ${item.difficulty} (${item.mastery}% mastery)
  Last practiced: ${item.last_practiced ? new Date(item.last_practiced).toLocaleDateString() : "Never"}
  Notes: ${item.notes || "No notes"}
`).join("")}

CURRENT GOALS:
${goals.map(goal => `
• ${goal.title} (${goal.category}) - ${goal.status}
  Progress: ${goal.progress}% - Target: ${new Date(goal.target_date).toLocaleDateString()}
  Description: ${goal.description}
`).join("")}

CAGED SYSTEM PERFORMANCE:
${cagedSessions.length > 0 ? cagedSessions.map(session => `
• ${session.session_date}: Score ${session.score}/100, Accuracy ${session.accuracy}/5, Time: ${session.time_seconds}s
  Shapes: ${session.shapes.join(", ")}
`).join("") : "No CAGED practice recorded"}

NOTE FINDER PERFORMANCE:
${noteFinderAttempts.length > 0 ? `Recent attempts: ${noteFinderAttempts.filter(a => a.correct).length}/${noteFinderAttempts.length} correct` : "No note finder practice recorded"}

TEACHING APPROACH:
1. Start with genuine enthusiasm and reference their specific journey
2. Use simple analogies and metaphors to explain complex concepts
3. Break down challenges into small, manageable steps
4. Celebrate progress enthusiastically, no matter how small
5. Turn technical explanations into relatable stories
6. Connect everything back to the music they love
7. Provide immediate, actionable practice suggestions
8. Address frustrations with empathy and practical solutions
9. Keep responses conversational, warm, and inspiring
10. Always end with encouragement and clear next steps

You are their personal musical mentor - someone who truly believes in their potential and makes even the most challenging aspects of guitar feel achievable and fun. Use their actual practice data to provide deeply personalized guidance that shows you really know and care about their musical journey.`
}

function buildConversationMessages(systemPrompt: string, conversations: ConversationHistory[], newMessage: string) {
  const messages = [
    {
      role: "system",
      content: systemPrompt
    }
  ];

  // Add recent conversation context (last 6 exchanges to keep context manageable)
  if (conversations.length > 0) {
    const recentConversations = conversations.slice(0, 6).reverse(); // Most recent first, then reverse for chronological order
    
    // Add a context separator
    messages.push({
      role: "system", 
      content: `RECENT CONVERSATION CONTEXT (for reference only - don't acknowledge this directly):
${recentConversations.map(conv => `Student: ${conv.message}\nYou: ${conv.response}`).join("\n\n")}

Now respond to their current question with full context of our ongoing conversation.`
    });
  }

  // Add the current message
  messages.push({
    role: "user",
    content: newMessage
  });

  return messages;
}

async function storeConversation(supabase: any, userId: string, message: string, response: string, userData: UserData) {
  try {
    // Create a lightweight session context snapshot (only key stats)
    const sessionContext = {
      totalSessions: userData.practiceSessions.length,
      avgMastery: userData.repertoire.length > 0 
        ? Math.round(userData.repertoire.reduce((sum, item) => sum + item.mastery, 0) / userData.repertoire.length)
        : 0,
      activeGoals: userData.goals.filter(g => g.status === "Active").length,
      lastPracticeDate: userData.practiceSessions[0]?.date || null
    };

    await supabase
      .from("coach_conversations")
      .insert({
        user_id: userId,
        message: message,
        response: response,
        session_context: sessionContext
      });

    // Keep only last 20 conversations per user to manage storage
    const { data: allConversations } = await supabase
      .from("coach_conversations")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (allConversations && allConversations.length > 20) {
      const idsToDelete = allConversations.slice(20).map(conv => conv.id);
      await supabase
        .from("coach_conversations")
        .delete()
        .in("id", idsToDelete);
    }
  } catch (error) {
    console.error("Error storing conversation:", error);
    // Don't fail the main request if conversation storage fails
  }
}

// Import createClient function
import { createClient } from "npm:@supabase/supabase-js@2"