import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Goal, GoalStatus, RepertoireItem } from '../types';
import { PracticeStartModal } from '../components/PracticeStartModal';

interface FocusCardProps {
    type: 'goal' | 'repertoire' | 'technique';
    title: string;
    description: string;
    onStart: () => void;
}

const FocusCard: React.FC<FocusCardProps> = ({ type, title, description, onStart }) => {
    const typeStyles = {
        goal: { icon: '🎯', color: 'border-blue-500' },
        repertoire: { icon: '🎵', color: 'border-purple-500' },
        technique: { icon: '🎸', color: 'border-teal-500' },
    };

    return (
        <div className={`bg-surface p-4 rounded-lg border-l-4 ${typeStyles[type].color} flex items-start space-x-4`}>
            <div className="text-2xl pt-1">{typeStyles[type].icon}</div>
            <div className="flex-1">
                <h3 className="font-bold text-text-primary">{title}</h3>
                <p className="text-sm text-text-secondary mt-1">{description}</p>
            </div>
            <button
                onClick={onStart}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md self-center whitespace-nowrap transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
                Start Session
            </button>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const { goals, repertoire, practiceSessions } = state;
    const [showPracticeModal, setShowPracticeModal] = React.useState(false);
    const [showSessionModal, setShowSessionModal] = React.useState(false);

    const handleOpenPracticeModal = () => {
        setShowPracticeModal(true);
    };

    const handleLogPastSession = () => {
        setShowSessionModal(true);
    };

    const focusSuggestions = useMemo(() => {
        const suggestions: FocusCardProps[] = [];

        // 1. Active Goals
        const activeGoals = goals.filter(g => g.status === GoalStatus.Active);
        if (activeGoals.length > 0) {
            const goal = activeGoals[0]; // Suggest the first active goal
            suggestions.push({
                type: 'goal',
                title: goal.title,
                description: `You're at ${goal.progress}% on this goal. Let's keep the momentum going!`,
                onStart: () => navigate('/session/live', { state: { topic: goal.title } })
            });
        }

        // 2. Stale Repertoire
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const staleItems = repertoire.filter(item => {
            const lastPracticed = item.lastPracticed ? new Date(item.lastPracticed) : new Date(0);
            return lastPracticed < oneWeekAgo;
        });
        if (staleItems.length > 0) {
            const item = staleItems.sort((a,b) => (new Date(a.lastPracticed || 0)).getTime() - (new Date(b.lastPracticed || 0)).getTime())[0];
            suggestions.push({
                type: 'repertoire',
                title: `${item.title} by ${item.artist}`,
                description: `Feeling rusty? You haven't practiced this in over a week.`,
                onStart: () => navigate('/session/live', { state: { topic: item.title } })
            });
        }
        
        // 3. Recent Technique
        if (practiceSessions.length > 0) {
            const lastSession = practiceSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if(lastSession.techniques.length > 0) {
                const technique = lastSession.techniques[0];
                 suggestions.push({
                    type: 'technique',
                    title: `Technique: ${technique}`,
                    description: `You worked on this in your last session. Let's build on that progress.`,
                    onStart: () => navigate('/session/live', { state: { topic: technique } })
                });
            }
        }
        
        return suggestions.slice(0, 3); // Limit to 3 suggestions for a clean look

    }, [goals, repertoire, practiceSessions, navigate]);

    return (
        <div className="p-8 space-y-8">
            {/* Prominent Action Bar */}
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 p-6 rounded-xl">
                <h2 className="text-2xl font-bold text-text-primary mb-4 text-center">Ready to Practice?</h2>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={handleOpenPracticeModal}
                        className="bg-primary hover:bg-primary-hover text-white font-bold py-4 px-8 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center justify-center space-x-2 text-lg"
                    >
                        <span className="text-2xl">🎸</span>
                        <span>Start Practice</span>
                    </button>
                </div>
                <p className="text-center text-text-secondary mt-3 text-sm">
                    Choose how you want to record your practice session
                </p>
            </div>
            
            <div>
                <h1 className="text-3xl font-bold text-text-primary mb-2">Today's Focus</h1>
                <p className="text-lg text-text-secondary">Smart suggestions to guide your practice session</p>
            </div>
            
            <div className="space-y-4">
                {focusSuggestions.length > 0 ? (
                    focusSuggestions.map((suggestion, index) => <FocusCard key={index} {...suggestion} />)
                ) : (
                    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                        <div className="text-6xl mb-6">🎸</div>
                        <h2 className="text-2xl font-bold text-text-primary mb-3">Welcome to Your Guitar Journey!</h2>
                        <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
                            Start by logging a practice session or adding your first song to get personalized recommendations.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button 
                                onClick={handleOpenPracticeModal} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Start Your First Session
                            </button>
                            <button 
                                onClick={() => navigate('/repertoire')} 
                                className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Add Your First Song
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="border-t border-border pt-8">
                 <h2 className="text-2xl font-bold text-text-primary mb-6">Quick Actions</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <button 
                        onClick={handleOpenPracticeModal} 
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group"
                        title="Start or record a practice session"
                     >
                        <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">📓</span>
                        <p className="font-semibold text-lg">Practice Session</p>
                        <p className="text-sm text-text-secondary mt-1">Start live or log completed</p>
                    </button>
                    <button 
                        onClick={() => navigate('/repertoire')} 
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group"
                        title="Add songs you're learning or update your progress"
                    >
                        <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">🎵</span>
                        <p className="font-semibold text-lg">Manage Songs</p>
                        <p className="text-sm text-text-secondary mt-1">Build your repertoire</p>
                    </button>
                     <button 
                        onClick={() => navigate('/goals')} 
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group"
                        title="Set new goals or track your progress"
                     >
                        <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">🎯</span>
                        <p className="font-semibold text-lg">Track Goals</p>
                        <p className="text-sm text-text-secondary mt-1">Set and achieve targets</p>
                    </button>
                 </div>
            </div>

            {/* Practice Start Modal */}
            <PracticeStartModal
                isOpen={showPracticeModal}
                onClose={() => setShowPracticeModal(false)}
                onLogPastSession={handleLogPastSession}
            />
            
            {/* Session Log Modal - This would need to be connected to your PracticeLog modal */}
            {showSessionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
                    <div className="bg-surface rounded-lg shadow-xl p-6">
                        <h3 className="text-lg font-bold mb-4">Quick Log Session</h3>
                        <p className="text-text-secondary mb-4">This would open your practice session logging modal.</p>
                        <button 
                            onClick={() => {
                                setShowSessionModal(false);
                                navigate('/log');
                            }}
                            className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md"
                        >
                            Go to Practice Log
                        </button>
                        <button 
                            onClick={() => setShowSessionModal(false)}
                            className="ml-2 bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};