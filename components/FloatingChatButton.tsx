import React from 'react';
import { useAppContext } from '../context/AppContext';

export const FloatingChatButton: React.FC = () => {
  const { openChatModal } = useAppContext();

  return (
    <button
      onClick={openChatModal}
      className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary-hover text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl group"
      title="Chat with your AI guitar teacher"
    >
      <svg 
        className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
        />
      </svg>
      
      {/* Floating indicator */}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      </div>
    </button>
  );
};