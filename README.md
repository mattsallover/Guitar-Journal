# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Environment Setup
## Run Locally

**Prerequisites:**  Node.js

Create a `.env` file in the root directory with:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
1. Install dependencies:
   `npm install`
2. Set up your environment variables (see Environment Setup above)
3. Run the app:
   `npm run dev`

## AI Features
# OpenAI Configuration (Optional - for Intelligent Mode)
The app includes two modes:
- **Standard Mode**: Uses algorithmic recommendations based on performance data
- **Intelligent Mode**: Uses Supabase Edge Functions with OpenAI for natural language coaching, practice journal analysis, and interactive theory explanations
The OpenAI API key is securely stored in Supabase Edge Functions.