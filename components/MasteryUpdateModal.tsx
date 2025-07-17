
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { RepertoireItem } from '../types';

interface MasteryUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: RepertoireItem[];
  onUpdate: (updatedItems: RepertoireItem[]) => void;
}

export const MasteryUpdateModal: React.FC<MasteryUpdateModalProps> = ({ isOpen, onClose, items, onUpdate }) => {
  const [masteryLevels, setMasteryLevels] = useState<Record<string, number>>({});

  useEffect(() => {
    if (items.length > 0) {
      const initialMastery = items.reduce((acc, item) => {
        acc[item.id] = item.mastery;
        return acc;
      }, {} as Record<string, number>);
      setMasteryLevels(initialMastery);
    }
  }, [items]);

  const handleSliderChange = (id: string, value: number) => {
    setMasteryLevels(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = () => {
    const updatedItems = items.map(item => ({
      ...item,
      mastery: masteryLevels[item.id],
    }));
    onUpdate(updatedItems);
  };
  
  if (!items || items.length === 0) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Song Mastery">
        <div className="space-y-6">
            <p className="text-center text-text-secondary">You just practiced these songs. How well do you know them now?</p>
            {items.map(item => (
              <div key={item.id}>
                <label className="block text-lg font-medium text-text-primary">
                  {item.title}: <span className="font-bold text-primary">{masteryLevels[item.id]}%</span>
                </label>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={masteryLevels[item.id] || 0}
                    onChange={e => handleSliderChange(item.id, parseInt(e.target.value, 10))}
                    className="w-full mt-2"
                />
              </div>
            ))}

            <div className="flex justify-end space-x-4 pt-4">
                <button onClick={onClose} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md">
                    Skip
                </button>
                <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                    Save Mastery
                </button>
            </div>
        </div>
    </Modal>
  );
};
