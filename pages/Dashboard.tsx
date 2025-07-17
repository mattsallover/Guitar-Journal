import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Goal, GoalStatus, RepertoireItem } from '../types';

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
                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md self-center whitespace-nowrap"
            >
                Start Practice
            </button>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const { goals, repertoire, practiceSessions } = state;

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
            <div>
                <h1 className="text-3xl font-bold text-text-primary">Today's Focus</h1>
                <p className="text-text-secondary mt-1">Here are some suggestions to guide your practice session.</p>
            </div>
            
            <div className="space-y-4">
                {focusSuggestions.length > 0 ? (
                    focusSuggestions.map((suggestion, index) => <FocusCard key={index} {...suggestion} />)
                ) : (
                    <div className="bg-surface p-8 rounded-lg text-center">
                        <h2 className="text-xl font-bold">Welcome!</h2>
                        <p className="text-text-secondary mt-2">Log a session, add a goal, or build your repertoire to get personalized practice suggestions.</p>
                    </div>
                )}
            </div>
            
            <div className="border-t border-border pt-8">
                 <h2 className="text-2xl font-bold text-text-primary mb-4">Quick Actions</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <button onClick={() => navigate('/log')} className="bg-surface hover:bg-border p-4 rounded-lg text-center transition-colors">
                        <span className="text-2xl">📓</span>
                        <p className="font-semibold mt-2">Log a Past Session</p>
                    </button>
                    <button onClick={() => navigate('/repertoire')} className="bg-surface hover:bg-border p-4 rounded-lg text-center transition-colors">
                        <span className="text-2xl">🎵</span>
                        <p className="font-semibold mt-2">Manage Repertoire</p>
                    </button>
                     <button onClick={() => navigate('/goals')} className="bg-surface hover:bg-border p-4 rounded-lg text-center transition-colors">
                        <span className="text-2xl">🎯</span>
                        <p className="font-semibold mt-2">Review Goals</p>
                    </button>
                 </div>
            </div>

        </div>
    );
};