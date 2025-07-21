import React, { useState } from 'react';
import { aiService } from '../services/ai';

interface NaturalLanguageInputProps {
  onParsed: (parsed: {
    duration?: number;
    mood?: string;
    techniques?: string[];
    songs?: string[];
    notes?: string;
    tags?: string[];
  }) => void;
  placeholder?: string;
  className?: string;
}

export const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({ 
  onParsed, 
  placeholder = "e.g., 'Practiced Blackbird for 20 min, worked on barre chords, felt good'",
  className = ""
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const handleParse = async () => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    try {
      const parsed = await aiService.parseNaturalLanguageLog(input);
      onParsed(parsed);
      setInput(''); // Clear input after successful parse
    } catch (error) {
      console.error('Failed to parse natural language input:', error);
      alert('Failed to parse your input. Please try again or use the manual form.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      alert('Speech recognition error. Please try again.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className={`bg-surface p-4 rounded-lg border-2 border-dashed border-primary/30 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <div className="text-primary text-xl">🤖</div>
        <h3 className="text-lg font-semibold text-text-primary">AI Practice Logger</h3>
        <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Beta</div>
      </div>
      
      <div className="flex space-x-2">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="w-full bg-background p-3 rounded-md border border-border text-text-primary placeholder-text-secondary resize-none"
            rows={3}
            disabled={isProcessing || isListening}
          />
        </div>
        
        <div className="flex flex-col space-y-2">
          <button
            onClick={startListening}
            disabled={isProcessing || isListening}
            className={`p-3 rounded-md font-semibold transition-all ${
              isListening 
                ? 'bg-red-600 text-white animate-pulse' 
                : 'bg-secondary hover:bg-indigo-700 text-white'
            } disabled:opacity-50`}
            title={isListening ? 'Listening...' : 'Voice input'}
          >
            {isListening ? '🎤' : '🎙️'}
          </button>
          
          <button
            onClick={handleParse}
            disabled={isProcessing || isListening || !input.trim()}
            className="p-3 bg-primary hover:bg-primary-hover text-white rounded-md font-semibold disabled:opacity-50 transition-all"
            title="Parse with AI"
          >
            {isProcessing ? '⏳' : '✨'}
          </button>
        </div>
      </div>
      
      {isListening && (
        <div className="mt-2 text-center text-red-400 text-sm animate-pulse">
          🎤 Listening... Speak now!
        </div>
      )}
      
      {isProcessing && (
        <div className="mt-2 text-center text-primary text-sm">
          🤖 AI is parsing your session...
        </div>
      )}
    </div>
  );
};