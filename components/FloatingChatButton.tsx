import React from 'react';
import { useAppContext } from '../context/AppContext';

export const FloatingChatButton: React.FC = () => {
  const { openChatModal } = useAppContext();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Pulsing background ring */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-ping opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse opacity-30"></div>
      
      <button
        onClick={openChatModal}
        className="relative bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full w-20 h-20 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-3xl group animate-bounce"
        title="Chat with your AI guitar teacher"
      >
        {/* AI Icon */}
        <svg 
          className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform duration-200" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12 2L13.09 8.26L20 7L14.74 12.26L21 13.09L14.74 11.74L20 17L13.09 15.74L12 22L10.91 15.74L4 17L9.26 11.74L3 10.91L9.26 12.26L4 7L10.91 8.26L12 2Z"/>
        </svg>
        
        {/* AI Text */}
        <span className="text-xs font-bold leading-none group-hover:scale-105 transition-transform duration-200">
          AI
        </span>
        
        {/* Notification dot */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse shadow-lg">
          <span className="text-xs font-bold text-black">!</span>
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></div>
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-24 right-0 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl">
        Ask your AI Guitar Teacher! 🎸
        <div className="absolute top-full right-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};