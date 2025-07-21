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

interface UserData {
  practiceSessions: any[];
  repertoire: any[];
  goals: any[];
  cagedSessions: any[];
  noteFinderAttempts: any[];
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

    // Fetch user's practice data (last 10 sessions + all other data)
    const userData = await fetchUserData(supabase, userId)

    // Create system prompt with user context
    const systemPrompt = createSystemPrompt(userData)

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
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

    return {
      practiceSessions: practiceSessions || [],
      repertoire: repertoire || [],
      goals: goals || [],
      cagedSessions: cagedSessions || [],
      noteFinderAttempts: noteFinderAttempts || [],
    }
  } catch (error) {
    console.error("Error fetching user data:", error)
    return {
      practiceSessions: [],
      repertoire: [],
      goals: [],
      cagedSessions: [],
      noteFinderAttempts: [],
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

  return `You are an expert guitar coach and instructor with decades of experience teaching guitarists of all levels. You provide personalized, encouraging, and actionable advice based on a student's practice history and goals.

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

COACHING GUIDELINES:
1. Be encouraging and supportive while providing honest, constructive feedback
2. Reference specific data from their practice history when giving advice
3. Suggest concrete, actionable next steps based on their current skill level and goals
4. Help them identify patterns in their practice that could be improved
5. Celebrate their progress and milestones
6. Provide technique tips, practice suggestions, and motivation
7. Help them set realistic goals and practice schedules
8. Address any frustrations or challenges they mention
9. Keep responses conversational and personalized
10. Focus on sustainable practice habits and long-term improvement

Answer their questions as their personal guitar coach, using the practice data above to provide the most relevant and helpful guidance.`
}

// Import createClient function
import { createClient } from "npm:@supabase/supabase-js@2"