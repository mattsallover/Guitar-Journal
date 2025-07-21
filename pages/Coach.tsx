import React from 'react';

export const Coach: React.FC = () => {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Guitar Expert</h1>
          <p className="text-text-secondary text-lg">
            Your expert guitar instructor for music theory, techniques, and guitar knowledge.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Info */}
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4 text-text-primary flex items-center">
                🎸 <span className="ml-2">Always Available</span>
              </h3>
              <p className="text-text-secondary mb-4">
                Look for the floating guitar icon in the bottom-right corner of every page. Your expert instructor is always ready to help!
              </p>
              <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg">
                <h4 className="font-bold text-primary mb-2">💬 Resizable Chat Window</h4>
                <p className="text-sm text-text-secondary">
                  Click and drag the blue dot in the top-left corner to resize the chat window to your preferred size.
                </p>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4 text-text-primary flex items-center">
                🎯 <span className="ml-2">Skill Level Adaptation</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">Novice</span>
                  <span className="text-text-secondary text-sm">Simple explanations, basic concepts</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">Intermediate</span>
                  <span className="text-text-secondary text-sm">Moderate theory, building on fundamentals</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">Expert</span>
                  <span className="text-text-secondary text-sm">Advanced theory, professional concepts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-text-primary">🎓 Expert Topics</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">Theory</div>
                  <div className="text-text-secondary text-xs mt-1">Scales, modes, harmony</div>
                </div>
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">Technique</div>
                  <div className="text-text-secondary text-xs mt-1">Picking, fingering, timing</div>
                </div>
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">CAGED</div>
                  <div className="text-text-secondary text-xs mt-1">System explanation, usage</div>
                </div>
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">Chords</div>
                  <div className="text-text-secondary text-xs mt-1">Construction, progressions</div>
                </div>
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">Improvisation</div>
                  <div className="text-text-secondary text-xs mt-1">Soloing, scales application</div>
                </div>
                <div className="bg-background p-3 rounded">
                  <div className="font-semibold text-primary">Analysis</div>
                  <div className="text-text-secondary text-xs mt-1">Song structure, theory</div>
                </div>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-text-primary">💡 Example Questions</h3>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>• "Explain the CAGED system"</p>
                <p>• "How do I play a G major scale?"</p>
                <p>• "What's the difference between modes?"</p>
                <p>• "How to improve my alternate picking?"</p>
                <p>• "Explain the circle of fifths"</p>
                <p>• "What makes a chord progression work?"</p>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg">
              <h4 className="text-sm font-bold text-yellow-400 mb-2">⚙️ Setup Required</h4>
              <p className="text-xs text-yellow-300">
                To use the Guitar Expert, you need to add your OpenAI API key as an environment variable 
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