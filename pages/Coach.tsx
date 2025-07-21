import React from 'react';
import { CoachChat } from '../components/CoachChat';

export const Coach: React.FC = () => {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-text-primary mb-2">AI Guitar Coach</h1>
          <p className="text-text-secondary text-lg">
            Get personalized advice based on your practice history, goals, and current skill level.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <CoachChat />
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-text-primary">What I Know About You</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-primary">📊</span>
                  <span className="text-text-secondary">Your practice history & patterns</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-primary">🎵</span>
                  <span className="text-text-secondary">Songs you're learning & mastery levels</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-primary">🎯</span>
                  <span className="text-text-secondary">Your goals & progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-primary">🎸</span>
                  <span className="text-text-secondary">CAGED & note finder performance</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-primary">🔄</span>
                  <span className="text-text-secondary">Techniques & skills you're working on</span>
                </div>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-text-primary">How I Can Help</h3>
              <div className="space-y-3 text-sm text-text-secondary">
                <p>• Analyze your practice patterns</p>
                <p>• Suggest next steps for improvement</p>
                <p>• Help with technique questions</p>
                <p>• Recommend songs for your level</p>
                <p>• Create personalized practice plans</p>
                <p>• Motivate and track your progress</p>
                <p>• Answer any guitar-related questions</p>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg">
              <h4 className="text-sm font-bold text-yellow-400 mb-2">⚙️ Setup Required</h4>
              <p className="text-xs text-yellow-300">
                To use the AI Coach, you need to add your OpenAI API key as an environment variable 
                called <code className="bg-black/30 px-1 rounded">OPENAI_API_KEY</code> in your 
                Supabase dashboard under Project Settings → Edge Functions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};