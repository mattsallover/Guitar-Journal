import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';

export const OnboardingModal: React.FC = () => {
  const { updateUserOnboardingStatus } = useAppContext();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleCompleteOnboarding();
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCompleteOnboarding = async () => {
    await updateUserOnboardingStatus(true);
  };

  return (
    <Modal isOpen={true} onClose={() => {}} title="Welcome to GuitarJournal! 🎸">
      <div className="text-center p-6">
        {step === 1 && (
          <>
            <div className="text-6xl mb-6">📝</div>
            <h3 className="text-2xl font-bold text-text-primary mb-4">Track Your Practice Sessions</h3>
            <p className="text-text-secondary mb-6 text-lg leading-relaxed">
              Log your practice time, add notes about what you worked on, and even record yourself playing.
              Your musical journey starts here!
            </p>
            <div className="bg-surface p-4 rounded-lg text-left">
              <p className="text-sm text-text-secondary mb-2">✨ <strong>We've added some sample data</strong> to help you get started:</p>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• 3 practice sessions from the past week</li>
                <li>• Notes and techniques you might work on</li>
                <li>• Everything you see is just examples - feel free to modify or delete!</li>
              </ul>
            </div>
          </>
        )}
        
        {step === 2 && (
          <>
            <div className="text-6xl mb-6">🎵</div>
            <h3 className="text-2xl font-bold text-text-primary mb-4">Build Your Repertoire</h3>
            <p className="text-text-secondary mb-6 text-lg leading-relaxed">
              Add songs you're learning, track your mastery level, and see your practice history for each piece.
              Watch your skills grow over time!
            </p>
            <div className="bg-surface p-4 rounded-lg text-left">
              <p className="text-sm text-text-secondary mb-2">📚 <strong>Sample songs added:</strong></p>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• "Stairway to Heaven" - Advanced level</li>
                <li>• "Wonderwall" - Intermediate level</li>
                <li>• "Blackbird" - Intermediate level</li>
              </ul>
            </div>
          </>
        )}
        
        {step === 3 && (
          <>
            <div className="text-6xl mb-6">🎯</div>
            <h3 className="text-2xl font-bold text-text-primary mb-4">Set and Track Goals</h3>
            <p className="text-text-secondary mb-6 text-lg leading-relaxed">
              Set specific musical goals, track your progress, and stay motivated on your guitar journey.
              Goals help you focus your practice time effectively.
            </p>
            <div className="bg-surface p-4 rounded-lg text-left">
              <p className="text-sm text-text-secondary mb-2">🎪 <strong>Sample goals created:</strong></p>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• Master Barre Chords (40% complete)</li>
                <li>• Learn "Sweet Child o' Mine" Solo</li>
                <li>• Perfect "Blackbird" fingerpicking</li>
              </ul>
            </div>
          </>
        )}
        
        {step === 4 && (
          <>
            <div className="text-6xl mb-6">🎸</div>
            <h3 className="text-2xl font-bold text-text-primary mb-4">Explore Interactive Tools</h3>
            <p className="text-text-secondary mb-6 text-lg leading-relaxed">
              Use the CAGED Explorer to master chord shapes and the Note Finder to learn every note on your fretboard.
              These tools make learning fun and interactive!
            </p>
            <div className="bg-surface p-4 rounded-lg text-left mb-6">
              <p className="text-sm text-text-secondary mb-2">🚀 <strong>Ready to explore:</strong></p>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• Practice tool data has been added</li>
                <li>• Check the "Practice Tools" section in the sidebar</li>
                <li>• Start with whichever tool interests you most!</li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm">
                💡 <strong>Pro tip:</strong> You can clear all this sample data anytime using the "Clear All My Data" button on your dashboard if you want to start fresh!
              </p>
            </div>
          </>
        )}

        <div className="flex justify-between items-center mt-8">
          <div className="flex items-center space-x-2">
            {step > 1 && (
              <button
                onClick={handlePrevious}
                className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md transition-all duration-200"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i + 1 === step ? 'bg-primary' : i + 1 < step ? 'bg-green-500' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={handleNext}
              className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-md transition-all duration-200 hover:scale-105 shadow-lg"
            >
              {step < totalSteps ? 'Next' : "Let's Start Playing! 🚀"}
            </button>
          </div>
        </div>
        
        <p className="text-xs text-text-secondary mt-4">
          Step {step} of {totalSteps}
        </p>
      </div>
    </Modal>
  );
};