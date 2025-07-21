import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatDimensions {
  width: number;
  height: number;
}

export const FloatingCoach: React.FC = () => {
  const { state } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [dimensions, setDimensions] = useState<ChatDimensions>({ width: 380, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = resizeStart.y - e.clientY; // Invert Y axis since we're resizing from bottom-right
      
      const newWidth = Math.max(320, Math.min(600, resizeStart.width + deltaX));
      const newHeight = Math.max(300, Math.min(700, resizeStart.height + deltaY));
      
      setDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'nw-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeStart]);

  useEffect(() => {
    if (isOpen && !hasInitialized && state.user) {
      // Initialize with a warm welcome message
      const welcomeMessage: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: "Hey there! 👋 I'm your personal guitar coach! I've been looking at your practice journey and I'm excited to help you take your playing to the next level. What would you like to work on today?",
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setHasInitialized(true);
    }
  }, [isOpen, hasInitialized, state.user]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: dimensions.width,
      height: dimensions.height
    });
  };

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
          userId: state.user.uid
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
        content: "I'm having trouble connecting right now. Please make sure your OpenAI API key is configured in your Supabase dashboard! 🎸",
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

  if (!state.user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 group animate-pulse hover:animate-none"
          title="Chat with your AI Guitar Coach"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-xl">🎸</span>
          </div>
          <div className="absolute -top-12 right-0 bg-background text-text-primary px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Ask your guitar coach! 💬
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          ref={chatRef}
          className="bg-surface rounded-lg shadow-2xl flex flex-col border border-border relative"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary rounded-t-lg shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎸</span>
              <div>
                <h3 className="font-bold text-white">Guitar Coach</h3>
                <p className="text-xs text-blue-100">Your personal music mentor</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 text-xl w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-background">
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
          <div className="p-3 border-t border-border shrink-0">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about techniques, songs, practice..."
                className="flex-1 bg-background text-text-primary placeholder-text-secondary px-3 py-2 rounded-md border border-border text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Send
              </button>
            </div>
            
            {/* Quick suggestions */}
            {messages.length <= 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[
                  "What should I practice?",
                  "Help with chord changes",
                  "Improve my rhythm"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    disabled={isLoading}
                    className="text-xs bg-background hover:bg-border text-text-secondary hover:text-text-primary px-2 py-1 rounded border border-border transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Resize Handle */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeStart}
            style={{
              background: 'linear-gradient(-45deg, transparent 40%, #666 40%, #666 60%, transparent 60%)',
            }}
          />
        </div>
      )}
    </div>
  );
};