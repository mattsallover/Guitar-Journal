
import React from 'react';

export const GoalsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.333l6.5 6.5L21 6.333" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6.333l-3.5 3.5-1.5-1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 19l-4-4" />
  </svg>
);
