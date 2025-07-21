import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Modal } from './Modal';
import { Goal, GoalStatus } from '../types';

interface PracticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    focusSuggestions: any[];
}

type PracticeMode = 'select' | 'caged-config' | 'note-finder-config' | 'scale-config';

export const PracticeModal: React.FC<PracticeModalProps> = ({ isOpen, onClose, focusSuggestions }) => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [mode, setMode] = useState<PracticeMode>('select');
    const [selectedTool, setSelectedTool] = useState<string | null>(null);

    // Active goals for inline prompts
    const activeGoals = state.goals.filter(g => g.status === GoalStatus.Active);

    const handleClose = () => {
        setMode('select');
        setSelectedTool(null);
        onClose();
    };

    const handleToolSelect = (tool: string) => {
        setSelectedTool(tool);
        if (tool === 'caged') {
            setMode('caged-config');
        } else if (tool === 'note-finder') {
            setMode('note-finder-config');
        } else if (tool === 'scale-practice') {
            setMode('scale-config');
        }
    };

    const handleStartDrill = (tool: string, config?: any) => {
        handleClose();
        if (tool === 'caged') {
            navigate('/tools/caged', { state: { autoStart: true, config } });
        } else if (tool === 'note-finder') {
            navigate('/tools/note-finder', { state: { autoStart: true, config } });
        } else if (tool === 'scale-practice') {
            navigate('/tools/scale-practice', { state: { autoStart: true, config } });
        }
    };

    const renderStepIndicator = () => {
        const steps = ['select', 'config', 'drill'];
        const currentIndex = mode === 'select' ? 0 : 1;
        
        return (
            <div className="flex justify-center space-x-2 mb-6">
                {steps.map((_, index) => (
                    <div 
                        key={index}
                        className={`w-2 h-2 rounded-full ${index <= currentIndex ? 'bg-primary' : 'bg-border'}`}
                    />
                ))}
            </div>
        );
    };

    const renderToolSelection = () => (
        <div className="space-y-6">
            {/* Goal Prompt Banner */}
            {activeGoals.length > 0 && (
                <div className="bg-blue-900/20 border border-blue-500 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">🎯</span>
                        <span className="font-semibold text-blue-300">Active Goal</span>
                    </div>
                    <p className="text-sm text-text-secondary">
                        You're {activeGoals[0].progress}% to your "{activeGoals[0].title}" goal. 
                        Keep the momentum going!
                    </p>
                </div>
            )}

            {/* Focus Suggestions */}
            {focusSuggestions.length > 0 && (
                <div className="bg-surface p-4 rounded-lg">
                    <h3 className="font-semibold text-primary mb-3">Suggested Focus</h3>
                    <div className="space-y-2">
                        {focusSuggestions.slice(0, 2).map((suggestion, index) => (
                            <div key={index} className="text-sm text-text-secondary">
                                {suggestion.type === 'goal' && '🎯'} 
                                {suggestion.type === 'repertoire' && '🎵'} 
                                {suggestion.type === 'technique' && '🎸'} 
                                <span className="ml-2">{suggestion.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Practice Tools */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-center text-text-primary">Choose Your Practice Tool</h3>
                
                <div className="grid grid-cols-1 gap-4">
                    <button 
                        onClick={() => handleToolSelect('caged')}
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group border-2 hover:border-primary"
                    >
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">🎸</div>
                        <h3 className="font-bold text-lg text-text-primary">CAGED Explorer</h3>
                        <p className="text-sm text-text-secondary mt-1">Master chord shapes with timed quizzes</p>
                    </button>

                    <button 
                        onClick={() => handleToolSelect('note-finder')}
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group border-2 hover:border-primary"
                    >
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">🔍</div>
                        <h3 className="font-bold text-lg text-text-primary">Note Finder</h3>
                        <p className="text-sm text-text-secondary mt-1">Drill fretboard note locations</p>
                    </button>

                    <button 
                        onClick={() => handleToolSelect('scale-practice')}
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group border-2 hover:border-primary opacity-60"
                        disabled
                    >
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">🎵</div>
                        <h3 className="font-bold text-lg text-text-primary">Scale Practice</h3>
                        <p className="text-sm text-text-secondary mt-1">Coming soon - scale patterns</p>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderCAGEDConfig = () => (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">CAGED Quiz Setup</h3>
                <p className="text-text-secondary mt-1">Configure your chord shape practice</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Quiz Length</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="bg-primary text-white py-2 px-4 rounded-md font-semibold">5 Shapes (Quick)</button>
                        <button className="bg-surface hover:bg-border py-2 px-4 rounded-md">10 Shapes (Full)</button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Focus Mode</label>
                    <div className="space-y-2">
                        <button className="w-full bg-primary text-white py-2 px-4 rounded-md font-semibold text-left">All Shapes Mixed</button>
                        <button className="w-full bg-surface hover:bg-border py-2 px-4 rounded-md text-left">Weak Shapes Only</button>
                    </div>
                </div>
            </div>

            <div className="border-t border-border pt-4">
                <button 
                    onClick={() => handleStartDrill('caged')}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 hover:scale-105"
                >
                    Start CAGED Drill
                </button>
            </div>
        </div>
    );

    const renderNoteFinderConfig = () => (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">Note Finder Setup</h3>
                <p className="text-text-secondary mt-1">Configure your fretboard practice</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Quiz Mode</label>
                    <div className="space-y-2">
                        <button className="w-full bg-primary text-white py-2 px-4 rounded-md font-semibold text-left">Combo Mode (Recommended)</button>
                        <button className="w-full bg-surface hover:bg-border py-2 px-4 rounded-md text-left">Find Any (Speed)</button>
                        <button className="w-full bg-surface hover:bg-border py-2 px-4 rounded-md text-left">Find All (Comprehensive)</button>
                        <button className="w-full bg-surface hover:bg-border py-2 px-4 rounded-md text-left">Find on String (Precision)</button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Question Count</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button className="bg-surface hover:bg-border py-2 px-4 rounded-md">6</button>
                        <button className="bg-primary text-white py-2 px-4 rounded-md font-semibold">12</button>
                        <button className="bg-surface hover:bg-border py-2 px-4 rounded-md">18</button>
                    </div>
                </div>
            </div>

            <div className="border-t border-border pt-4">
                <button 
                    onClick={() => handleStartDrill('note-finder')}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 hover:scale-105"
                >
                    Start Note Finder Drill
                </button>
            </div>
        </div>
    );

    const getModalTitle = () => {
        switch (mode) {
            case 'caged-config': return 'CAGED Practice';
            case 'note-finder-config': return 'Note Finder Practice';
            case 'scale-config': return 'Scale Practice';
            default: return 'Start Practice';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={getModalTitle()}>
            <div className="max-w-lg mx-auto">
                {mode !== 'select' && renderStepIndicator()}
                
                {mode === 'select' && renderToolSelection()}
                {mode === 'caged-config' && renderCAGEDConfig()}
                {mode === 'note-finder-config' && renderNoteFinderConfig()}
                
                {mode !== 'select' && (
                    <div className="mt-6 pt-4 border-t border-border">
                        <button 
                            onClick={() => setMode('select')}
                            className="text-text-secondary hover:text-text-primary"
                        >
                            ← Back to tool selection
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};