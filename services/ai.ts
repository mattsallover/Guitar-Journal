interface ParsedPracticeSession {
  duration?: number;
  mood?: string;
  techniques?: string[];
  songs?: string[];
  notes?: string;
  tags?: string[];
}

interface DrillRecommendation {
  type: 'caged' | 'note-finder' | 'technique' | 'song';
  title: string;
  description: string;
  action: string;
  urgency: 'low' | 'medium' | 'high';
}

interface SearchResult {
  id: string;
  type: 'session' | 'goal' | 'repertoire';
  title: string;
  content: string;
  relevanceScore: number;
  date: string;
}

class AIService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Gemini API key not found. AI features will be limited.');
    }
  }

  async parseNaturalLanguageLog(input: string): Promise<ParsedPracticeSession> {
    if (!this.apiKey) {
      throw new Error('AI service not configured');
    }

    const prompt = `Parse this guitar practice session description and extract structured data. Return ONLY a JSON object with these fields:
- duration: number in minutes (if mentioned)
- mood: one of "Excellent", "Good", "Okay", "Challenging", "Frustrated" (infer from context)
- techniques: array of technique names mentioned
- songs: array of song titles mentioned
- notes: the original text cleaned up
- tags: array of relevant tags (max 5)

Input: "${input}"

Example output:
{
  "duration": 30,
  "mood": "Good", 
  "techniques": ["barre chords", "fingerpicking"],
  "songs": ["Blackbird"],
  "notes": "Practiced Blackbird for 30 minutes, worked on barre chords and fingerpicking. Made good progress.",
  "tags": ["barre chords", "fingerpicking", "Beatles", "progress"]
}`;

    try {
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Error parsing natural language log:', error);
      // Fallback: basic parsing
      return this.basicParseFallback(input);
    }
  }

  async generateDrillRecommendations(recentSessions: any[]): Promise<DrillRecommendation[]> {
    if (!this.apiKey || recentSessions.length === 0) {
      return this.getStaticRecommendations();
    }

    const sessionSummary = recentSessions.slice(0, 10).map(session => ({
      date: session.date,
      duration: session.duration,
      mood: session.mood,
      techniques: session.techniques || [],
      songs: session.songs || [],
      notes: session.notes?.substring(0, 100) || ''
    }));

    const prompt = `Analyze these recent guitar practice sessions and generate 2-3 specific drill recommendations. Focus on areas that need improvement or haven't been practiced recently.

Recent sessions:
${JSON.stringify(sessionSummary, null, 2)}

Return ONLY a JSON array of recommendations with this structure:
[
  {
    "type": "caged|note-finder|technique|song",
    "title": "Short title",
    "description": "Why this is recommended",
    "action": "Specific call to action", 
    "urgency": "low|medium|high"
  }
]

Focus on practical, actionable recommendations based on patterns in the data.`;

    try {
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);
        return recommendations.slice(0, 3); // Limit to 3 recommendations
      }
      
      return this.getStaticRecommendations();
    } catch (error) {
      console.error('Error generating drill recommendations:', error);
      return this.getStaticRecommendations();
    }
  }

  async semanticSearch(query: string, allContent: any[]): Promise<SearchResult[]> {
    if (!this.apiKey) {
      return this.basicSearchFallback(query, allContent);
    }

    // For now, use a simplified semantic search using the AI to score relevance
    const prompt = `Score the relevance of these guitar practice items to the search query "${query}". Return ONLY a JSON array with relevance scores from 0-1.

Items to score:
${allContent.map((item, index) => `${index}: ${item.searchableText?.substring(0, 200) || ''}`).join('\n')}

Return format: [0.8, 0.2, 0.9, ...]`;

    try {
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text || '';
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]);
        return allContent
          .map((item, index) => ({ ...item, relevanceScore: scores[index] || 0 }))
          .filter(item => item.relevanceScore > 0.3)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 10);
      }
      
      return this.basicSearchFallback(query, allContent);
    } catch (error) {
      console.error('Error in semantic search:', error);
      return this.basicSearchFallback(query, allContent);
    }
  }

  private basicParseFallback(input: string): ParsedPracticeSession {
    const text = input.toLowerCase();
    
    // Extract duration
    const durationMatch = text.match(/(\d+)\s*(min|minute|minutes|hour|hours)/);
    let duration = undefined;
    if (durationMatch) {
      const num = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      duration = unit.startsWith('hour') ? num * 60 : num;
    }

    // Extract mood from keywords
    let mood = 'Okay';
    if (text.includes('excellent') || text.includes('amazing') || text.includes('great')) mood = 'Excellent';
    else if (text.includes('good') || text.includes('well') || text.includes('progress')) mood = 'Good';
    else if (text.includes('challenging') || text.includes('difficult') || text.includes('hard')) mood = 'Challenging';
    else if (text.includes('frustrated') || text.includes('struggle') || text.includes('bad')) mood = 'Frustrated';

    // Extract common techniques
    const techniques = [];
    if (text.includes('barre') || text.includes('bar chord')) techniques.push('Barre Chords');
    if (text.includes('fingerpick') || text.includes('finger pick')) techniques.push('Fingerpicking');
    if (text.includes('strum')) techniques.push('Strumming');
    if (text.includes('scale')) techniques.push('Scales');

    return {
      duration,
      mood,
      techniques,
      songs: [],
      notes: input,
      tags: techniques.map(t => t.toLowerCase())
    };
  }

  private getStaticRecommendations(): DrillRecommendation[] {
    return [
      {
        type: 'caged',
        title: 'CAGED System Practice',
        description: 'Strengthen your chord shape knowledge',
        action: 'Take a 5-question CAGED quiz',
        urgency: 'medium'
      },
      {
        type: 'note-finder', 
        title: 'Fretboard Knowledge',
        description: 'Improve note recognition speed',
        action: 'Practice note finding for 10 minutes',
        urgency: 'medium'
      }
    ];
  }

  private basicSearchFallback(query: string, allContent: any[]): SearchResult[] {
    const queryWords = query.toLowerCase().split(' ');
    
    return allContent
      .map(item => {
        const searchText = (item.searchableText || '').toLowerCase();
        const matches = queryWords.filter(word => searchText.includes(word)).length;
        const relevanceScore = matches / queryWords.length;
        
        return { ...item, relevanceScore };
      })
      .filter(item => item.relevanceScore > 0.2)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
  }
}

export const aiService = new AIService();