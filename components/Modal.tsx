
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300 backdrop-blur-sm border border-border/20">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-text-secondary hover:text-text-primary text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface transition-all duration-200 hover:scale-110"
            title="Close modal"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
