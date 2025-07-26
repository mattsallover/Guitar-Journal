import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Modal } from './Modal';
import { aiService } from '../services/aiService';

export const AIChatModal: React.FC = () => {
  const { state, closeChatModal, addChatMessage, clearChatMessages } = useAppContext();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.chatMessages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message
    addChatMessage('user', userMessage);
    setIsLoading(true);

    try {
      // Prepare context for AI
      const comprehensiveContext = {
        // Recent activity (last 2 weeks)
        recentPracticeSessions: state.recentPracticeSessions.map(session => ({
          date: session.date,
          duration: session.duration,
          techniques: session.techniques,
          songs: session.songs,
          notes: session.notes,
          mood: session.mood
        })),
        recentRepertoire: state.recentRepertoire.map(item => ({
          title: item.title,
          artist: item.artist,
          difficulty: item.difficulty,
          mastery: item.mastery,
          lastPracticed: item.lastPracticed
        })),
        recentGoals: state.recentGoals.map(goal => ({
          title: goal.title,
          description: goal.description,
          progress: goal.progress,
          status: goal.status,
          category: goal.category
        })),
        recentCAGEDSessions: state.recentCAGEDSessions.map(session => ({
          sessionDate: session.sessionDate,
          shapes: session.shapes,
          accuracy: session.accuracy,
          score: session.score
        })),
        recentNoteFinderAttempts: state.recentNoteFinderAttempts.map(attempt => ({
          noteName: attempt.noteName,
          correct: attempt.correct,
          timeSeconds: attempt.timeSeconds,
          createdAt: attempt.createdAt
        })),
        
        // Current conversation history
        chatHistory: state.chatMessages.map(msg => ({
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp
        })),
        
        // User profile
        userLevel: state.noteFinderAttempts.length < 50 ? 'beginner' : 
                  state.noteFinderAttempts.length < 200 ? 'intermediate' : 'advanced',
        totalPracticeTime: state.practiceSessions.reduce((sum, s) => sum + s.duration, 0),
        totalSongs: state.repertoire.length,
        activeGoals: state.goals.filter(g => g.status === 'Active').length
      };

      // Get AI response
      const aiResponse = await aiService.answerMusicTheoryQuestion(userMessage, comprehensiveContext);
      
      // Add AI response
      addChatMessage('ai', aiResponse);
    } catch (error) {
      console.error('Error getting AI response:', error);
      addChatMessage('ai', "I'm having trouble right now, but I'm here to help! Try asking me about guitar techniques, music theory, or practice tips. 🎸");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal isOpen={state.isChatModalOpen} onClose={closeChatModal} title="🎸 Your AI Guitar Teacher">
      <div className="flex flex-col h-96">
        {/* Welcome message */}
        {state.chatMessages.length === 0 && (
          <div className="text-center p-6 bg-primary/10 rounded-lg mb-4">
            <div className="text-3xl mb-2">🎸</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Hey there, fellow guitarist!</h3>
            <p className="text-text-secondary text-sm">
              I'm your AI guitar teacher, here to help with techniques, theory, practice tips, and anything guitar-related. 
              Ask me about chords, scales, practice routines, or even specific songs you're working on!
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {state.chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-surface text-text-primary rounded-bl-sm border border-border'
                }`}
              >
                {message.sender === 'ai' && (
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">🎸</span>
                    <span className="text-xs text-text-secondary font-medium">Guitar Teacher</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <div className={`text-xs mt-1 opacity-70 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-text-secondary'
                }`}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border p-3 rounded-lg rounded-bl-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎸</span>
                  <span className="text-xs text-text-secondary font-medium">Guitar Teacher</span>
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border pt-4">
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about guitar techniques, theory, practice tips..."
              className="flex-1 bg-background border border-border rounded-md p-3 text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={2}
              disabled={isLoading}
            />
            <div className="flex flex-col space-y-1">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-primary hover:bg-primary-hover text-white font-bold px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
                title="Send message (Enter)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
              {state.chatMessages.length > 0 && (
                <button
                  onClick={clearChatMessages}
                  disabled={isLoading}
                  className="bg-surface hover:bg-border text-text-secondary font-bold px-4 py-2 rounded-md disabled:opacity-50 transition-all duration-200 text-xs"
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </Modal>
  );
};