import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';

interface PracticeStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogPastSession: () => void;
}

export const PracticeStartModal: React.FC<PracticeStartModalProps> = ({ 
  isOpen, 
  onClose, 
  onLogPastSession 
}) => {
  const navigate = useNavigate();

  const handleStartLive = () => {
    onClose();
    navigate('/session/live', { state: { topic: 'Practice Session' } });
  };

  const handleLogPast = () => {
    onClose();
    onLogPastSession();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Your Practice">
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🎸</div>
          <p className="text-text-secondary text-lg mb-6">
            How would you like to record your practice session?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={handleStartLive}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-3"
          >
            <span className="text-2xl">⏱️</span>
            <div className="text-left">
              <div className="font-bold">Start Live Session</div>
              <div className="text-sm opacity-90">Practice with timer, metronome, and tools</div>
            </div>
          </button>

          <button
            onClick={handleLogPast}
            className="bg-secondary hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-3"
          >
            <span className="text-2xl">📝</span>
            <div className="text-left">
              <div className="font-bold">Log Past Session</div>
              <div className="text-sm opacity-90">Record a session you already completed</div>
            </div>
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-sm underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};