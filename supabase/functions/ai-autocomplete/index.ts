import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface AutocompleteRequest {
  field: string;
  value: string;
  context?: any;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { field, value, context }: AutocompleteRequest = await req.json()

    if (!field || !value) {
      return new Response(
        JSON.stringify({ error: "Field and value are required" }),
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
        JSON.stringify({ suggestions: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    let prompt = ""
    let suggestions: string[] = []

    // Handle different field types
    switch (field) {
      case 'artist':
        if (context?.title) {
          prompt = `Given the song title "${context.title}", what is the most likely artist? Respond with just the artist name, nothing else.`
          
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
                  content: "You are a music expert. When given a song title, respond with only the most likely artist name. Be concise and accurate."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              max_tokens: 50,
              temperature: 0.3,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            const artistName = data.choices[0]?.message?.content?.trim()
            if (artistName) {
              suggestions = [artistName]
            }
          }
        }
        break

      case 'technique':
        prompt = `Complete this guitar technique: "${value}". Provide 3 common guitar technique names that start with or contain this text. Respond as a JSON array of strings.`
        
        const techniqueResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
                content: "You are a guitar expert. Suggest common guitar techniques. Respond only with a JSON array of strings."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 100,
            temperature: 0.5,
          }),
        })

        if (techniqueResponse.ok) {
          const data = await techniqueResponse.json()
          const content = data.choices[0]?.message?.content?.trim()
          try {
            const parsed = JSON.parse(content)
            if (Array.isArray(parsed)) {
              suggestions = parsed.slice(0, 3)
            }
          } catch (e) {
            // Fallback if JSON parsing fails
            suggestions = []
          }
        }
        break

      default:
        suggestions = []
    }

    return new Response(
      JSON.stringify({ suggestions }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Autocomplete error:", error)
    return new Response(
      JSON.stringify({ suggestions: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})