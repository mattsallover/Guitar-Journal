import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type SkillLevel = 'novice' | 'intermediate' | 'expert';

export const FloatingCoach: React.FC = () => {
  const { state } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [chatSize, setChatSize] = useState({ width: 380, height: 500 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Resizing logic
  useEffect(() => {
    if (!resizeRef.current) return;

    const resizer = resizeRef.current;
    let isResizing = false;

    const handleMouseDown = (e: MouseEvent) => {
      isResizing = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !chatRef.current) return;
      
      const rect = chatRef.current.getBoundingClientRect();
      const newWidth = Math.max(300, rect.right - e.clientX + 10);
      const newHeight = Math.max(300, rect.bottom - e.clientY + 10);
      
      setChatSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !state.user || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-coach`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage.trim(),
          userId: state.user.uid,
          skillLevel
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting. Please ensure your OpenAI API key is configured in Supabase Edge Functions settings.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!state.user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Guitar Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 group animate-pulse hover:animate-none"
          title="Ask your guitar instructor"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-xl">🎸</span>
          </div>
          <div className="absolute -top-12 right-0 bg-background text-text-primary px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Guitar Expert 💬
          </div>
        </button>
      )}

      {/* Resizable Chat Window */}
      {isOpen && (
        <div 
          ref={chatRef}
          className="bg-surface rounded-lg shadow-2xl flex flex-col border border-border relative"
          style={{ width: chatSize.width, height: chatSize.height }}
        >
          {/* Resize Handle */}
          <div
            ref={resizeRef}
            className="absolute -top-2 -left-2 w-4 h-4 cursor-nw-resize bg-primary rounded-full opacity-50 hover:opacity-100 transition-opacity"
            title="Drag to resize"
          />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎸</span>
              <div>
                <h3 className="font-bold text-white text-sm">Guitar Expert</h3>
                <div className="flex items-center space-x-1">
                  <select
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                    className="text-xs bg-white/20 text-white rounded px-1 border-none outline-none"
                  >
                    <option value="novice" className="text-black">Novice</option>
                    <option value="intermediate" className="text-black">Intermediate</option>
                    <option value="expert" className="text-black">Expert</option>
                  </select>
                  <span className="text-xs text-blue-100">Level</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearChat}
                className="text-white hover:text-gray-200 text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
                title="Clear chat"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200 text-xl w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-background" style={{ minHeight: 200 }}>
            {messages.length === 0 && (
              <div className="text-center text-text-secondary text-sm">
                <div className="text-4xl mb-2">🎓</div>
                <p className="mb-2">Ask me anything about guitar!</p>
                <div className="text-xs space-y-1">
                  <p>• "Explain the CAGED system"</p>
                  <p>• "How do I play a G major scale?"</p>
                  <p>• "What's the circle of fifths?"</p>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-primary border border-border'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface text-text-primary border border-border px-3 py-2 rounded-lg">
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about scales, theory, techniques..."
                className="flex-1 bg-background text-text-primary placeholder-text-secondary px-3 py-2 rounded-md border border-border text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};