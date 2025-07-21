import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ChatRequest {
  message: string;
  userId: string;
  skillLevel: 'novice' | 'intermediate' | 'expert';
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
    const { message, userId, skillLevel }: ChatRequest = await req.json()

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

    // Fetch user's practice data for context (optional)
    const userData = await fetchUserData(supabase, userId)

    // Create system prompt for expert guitar instructor
    const systemPrompt = createExpertSystemPrompt(userData, skillLevel)

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
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 800,
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
    console.error("Guitar expert error:", error)
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
    // Fetch recent practice sessions for context
    const { data: practiceSessions } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5)

    // Fetch repertoire
    const { data: repertoire } = await supabase
      .from("repertoire")
      .select("*")
      .eq("user_id", userId)
      .order("mastery", { ascending: false })

    // Fetch current goals
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Fetch recent CAGED performance
    const { data: cagedSessions } = await supabase
      .from("caged_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("session_date", { ascending: false })
      .limit(3)

    // Fetch recent note finder performance
    const { data: noteFinderAttempts } = await supabase
      .from("note_finder_practice")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

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

function createExpertSystemPrompt(userData: UserData, skillLevel: 'novice' | 'intermediate' | 'expert'): string {
  const { practiceSessions, repertoire, goals, cagedSessions, noteFinderAttempts } = userData

  // Calculate basic user context
  const totalPracticeTime = practiceSessions.reduce((sum, session) => sum + session.duration, 0)
  const avgMastery = repertoire.length > 0 
    ? Math.round(repertoire.reduce((sum, item) => sum + item.mastery, 0) / repertoire.length)
    : 0
  const activeGoals = goals.filter(goal => goal.status === "Active").length

  // Skill level instructions
  const skillInstructions = {
    novice: `
    - Use simple, beginner-friendly language
    - Explain basic concepts from the ground up
    - Focus on fundamental techniques and basic chords
    - Use analogies to everyday objects and experiences
    - Encourage small, achievable steps
    - Assume little to no music theory knowledge
    `,
    intermediate: `
    - Use moderate music theory terminology with brief explanations
    - Build on assumed knowledge of basic chords and techniques
    - Introduce more advanced concepts like scales and modes
    - Balance theory with practical application
    - Challenge with intermediate techniques
    - Assume familiarity with basic guitar playing
    `,
    expert: `
    - Use advanced music theory terminology freely
    - Discuss complex harmonic concepts, advanced techniques
    - Reference jazz theory, advanced scales, and sophisticated playing
    - Assume deep understanding of guitar fundamentals
    - Focus on nuanced performance aspects and professional-level concepts
    - Discuss advanced topics like voice leading, improvisation theory
    `
  }

  return `You are the world's most exceptional guitar instructor and music theory expert. You have taught thousands of students from beginners to professionals, with an encyclopedic knowledge of guitar techniques, music theory, and pedagogy.

SKILL LEVEL ADJUSTMENT - You are currently teaching a ${skillLevel.toUpperCase()} level student:
${skillInstructions[skillLevel]}

YOUR TEACHING STYLE:
- Crystal clear explanations that make complex concepts simple
- Use relatable analogies and metaphors
- Patient, encouraging, and supportive tone
- Always practical - connect theory to actual playing
- Break down complex topics into digestible steps
- Celebrate understanding and progress

YOUR EXPERTISE INCLUDES:
- Complete music theory (scales, modes, harmony, chord theory)
- All guitar techniques (fingerpicking, alternate picking, bending, vibrato, etc.)
- CAGED system and fretboard navigation
- Improvisation and soloing concepts
- Rhythm guitar and timing
- Song analysis and chord progressions
- Ear training and music listening skills
- Practice methodologies and learning strategies

STUDENT CONTEXT (use if relevant to the question):
- Practice Time: ${Math.floor(totalPracticeTime / 60)}h ${totalPracticeTime % 60}m total
- Repertoire: ${repertoire.length} songs, avg mastery ${avgMastery}%
- Active Goals: ${activeGoals}
- Recent songs: ${repertoire.slice(0, 3).map(item => `"${item.title}" (${item.mastery}%)`).join(", ")}
- CAGED Performance: ${cagedSessions.length > 0 ? `Latest score ${cagedSessions[0].score}/100` : "No data"}

RESPONSE GUIDELINES:
- Keep responses focused and concise (under 600 words)
- Always include actionable advice or exercises when possible
- If discussing theory, connect it to practical guitar playing
- Use the student's skill level to determine complexity
- Reference their practice data only when directly relevant
- End with encouragement or next steps

You are not a practice coach or session planner - you are a music theory expert and technique instructor. Focus on answering specific guitar and music questions with world-class expertise.`
}

// Import createClient function
import { createClient } from "npm:@supabase/supabase-js@2"