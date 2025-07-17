
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Goal } from '../types';

interface GoalUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  onUpdate: (goal: Goal, newProgress: number) => void;
}

export const GoalUpdateModal: React.FC<GoalUpdateModalProps> = ({ isOpen, onClose, goal, onUpdate }) => {
  const [progress, setProgress] = useState(goal.progress);

  useEffect(() => {
    // Sync state if the goal prop changes while modal is open
    setProgress(goal.progress);
  }, [goal]);

  const handleSave = () => {
    onUpdate(goal, progress);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Goal Progress">
        <div className="text-center">
            <p className="text-text-secondary">Great work on a related topic!</p>
            <h3 className="text-2xl font-bold text-primary mt-2 mb-6">{goal.title}</h3>
            
            <div>
                <label className="block text-lg font-medium text-text-primary">
                    Progress: <span className="font-bold text-primary">{progress}%</span>
                </label>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress} 
                    onChange={e => setProgress(parseInt(e.target.value, 10))}
                    className="w-full mt-2"
                />
            </div>

            <div className="flex justify-center space-x-4 mt-8">
                <button onClick={onClose} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-6 rounded-md">
                    Skip
                </button>
                <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-md">
                    Update Progress
                </button>
            </div>
        </div>
    </Modal>
  );
};
