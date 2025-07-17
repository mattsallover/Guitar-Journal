
import React from 'react';

export const LogIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-5.247-8.242l10.494 4.99m-10.494 0l10.494-4.99m-10.494-2.508l10.494 9.994" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
