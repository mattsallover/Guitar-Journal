import React, { useMemo } from 'react';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Goal, GoalStatus, RepertoireItem, CAGEDSession } from '../types';

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
    const { state, clearUserData } = useAppContext();
    const navigate = useNavigate();
    const [isClearingData, setIsClearingData] = useState(false);
    const { goals, repertoire, practiceSessions, cagedSessions } = state;

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
        
        // 4. Recent CAGED Practice
        if (cagedSessions.length > 0) {
            const lastCAGEDSession = cagedSessions.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())[0];
            // Only suggest if it's more recent than the last practice session
            const lastCAGEDDate = new Date(lastCAGEDSession.sessionDate);
            const lastPracticeDate = practiceSessions.length > 0 
                ? new Date(practiceSessions[0].date) 
                : new Date(0);
            
            if (lastCAGEDDate > lastPracticeDate) {
                const shapes = lastCAGEDSession.shapes.join(', ');
                suggestions.push({
                    type: 'technique',
                    title: `CAGED Practice: ${shapes} shapes`,
                    description: `You scored ${lastCAGEDSession.score}/100 in your last CAGED session. Keep building those chord connections!`,
                    onStart: () => navigate('/tools/caged')
                });
            }
        }
        
        return suggestions.slice(0, 3); // Limit to 3 suggestions for a clean look

    }, [goals, repertoire, practiceSessions, cagedSessions, navigate]);

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-text-primary mb-2">Today's Focus</h1>
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
                                onClick={() => navigate('/log')} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Log Your First Session
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
                        onClick={() => navigate('/log')} 
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group"
                        title="Record details from a previous practice session"
                     >
                        <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">📓</span>
                        <p className="font-semibold text-lg">Log Past Session</p>
                        <p className="text-sm text-text-secondary mt-1">Record what you practiced</p>
                    </button>
                    <button 
                        onClick={() => navigate('/session/live', { state: { topic: 'General Practice' } })} 
                        className="bg-surface hover:bg-border p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group"
                        title="Start a live practice session with timer and recording"
                    >
                        <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">🎸</span>
                        <p className="font-semibold text-lg">Start Live Session</p>
                        <p className="text-sm text-text-secondary mt-1">Practice with timer & recording</p>
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
                        <button
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to delete ALL your practice data? This action cannot be undone.')) {
                                    setIsClearingData(true);
                                    await clearUserData(state.user!.uid);
                                    setIsClearingData(false);
                                }
                            }}
                            disabled={isClearingData}
                            className="bg-red-700 hover:bg-red-800 p-6 rounded-lg text-center transition-all duration-300 hover:scale-105 hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Permanently delete all your practice sessions, repertoire, and goals."
                        >
                            <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-200">🗑️</span>
                            <p className="font-semibold text-lg">Clear All My Data</p>
                            <p className="text-sm text-text-secondary mt-1">Start fresh with an empty journal</p>
                            {isClearingData && <div className="mt-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>}
                        </button>
                    </button>
                 </div>
            </div>

        </div>
    );
};