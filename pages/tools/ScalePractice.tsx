
import React from 'react';

export const ScalePractice: React.FC = () => {
    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-text-primary mb-4">Scale Practice</h1>
                    <p className="text-xl text-text-secondary">Master scales across the entire fretboard</p>
                </div>
                
                <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                    <div className="text-6xl mb-6">🎵</div>
                    <h2 className="text-2xl font-bold text-text-primary mb-4">Coming Soon!</h2>
                    <div className="max-w-2xl mx-auto space-y-4">
                        <p className="text-text-secondary text-lg">
                            This powerful tool will help you learn and master various scales with:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="bg-background p-4 rounded-lg">
                                <div className="text-2xl mb-2">🎯</div>
                                <h3 className="font-semibold text-text-primary">Interactive Exercises</h3>
                                <p className="text-sm text-text-secondary">Practice scales with guided exercises</p>
                            </div>
                            <div className="bg-background p-4 rounded-lg">
                                <div className="text-2xl mb-2">📊</div>
                                <h3 className="font-semibold text-text-primary">Progress Tracking</h3>
                                <p className="text-sm text-text-secondary">Monitor your scale mastery over time</p>
                            </div>
                            <div className="bg-background p-4 rounded-lg">
                                <div className="text-2xl mb-2">🎸</div>
                                <h3 className="font-semibold text-text-primary">Visual Fretboard</h3>
                                <p className="text-sm text-text-secondary">See scale patterns clearly mapped out</p>
                            </div>
                            <div className="bg-background p-4 rounded-lg">
                                <div className="text-2xl mb-2">🔄</div>
                                <h3 className="font-semibold text-text-primary">Multiple Scales</h3>
                                <p className="text-sm text-text-secondary">Major, minor, pentatonic, and more</p>
                            </div>
                        </div>
                        
                        <p className="text-text-secondary mt-6">
                            In the meantime, try out the <strong>CAGED Explorer</strong> and <strong>Note Finder</strong> tools!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
