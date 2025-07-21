import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { GoalStatus, Mood } from '../types';

const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '😊',
    [Mood.Good]: '🙂',
    [Mood.Okay]: '😐',
    [Mood.Challenging]: '😕',
    [Mood.Frustrated]: '😠',
};

export const RepertoireDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { state } = useAppContext();
    const navigate = useNavigate();

    const item = state.repertoire.find(r => r.id === id);

    if (!item) {
        return <div className="p-8 text-center">Repertoire item not found.</div>;
    }

    const relatedSessions = state.practiceSessions
        .filter(session => (session.songs || []).includes(item.title))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const relatedGoals = state.goals.filter(goal => 
        goal.category === 'Song' && goal.title.toLowerCase() === item.title.toLowerCase()
    );

    const totalTime = relatedSessions.reduce((sum, s) => sum + s.duration, 0);

    const masteryColor = (mastery: number) => {
        if (mastery < 33) return 'bg-red-500';
        if (mastery < 66) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const handleStartPractice = () => {
        navigate('/session/live', { state: { topic: item.title } });
    };

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div>
                <Link to="/repertoire" className="text-sm text-primary hover:underline mb-2 block">&larr; Back to Repertoire</Link>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold text-text-primary">{item.title}</h1>
                        <p className="text-xl text-text-secondary">by {item.artist}</p>
                    </div>
                    <button onClick={handleStartPractice} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-6 rounded-md whitespace-nowrap">
                        Practice Now
                    </button>
                </div>
            </div>

            {/* Stats and Goals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-lg col-span-1 md:col-span-2">
                    <h2 className="text-xl font-bold mb-4">Mastery & Details</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-text-secondary">Mastery ({item.mastery}%)</label>
                            <div className="w-full bg-background rounded-full h-4 mt-1">
                                <div className={`${masteryColor(item.mastery)} h-4 rounded-full`} style={{width: `${item.mastery}%`}}></div>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <p><span className="text-text-secondary">Difficulty:</span> <span className="font-semibold">{item.difficulty}</span></p>
                            <p><span className="text-text-secondary">Last Practiced:</span> <span className="font-semibold">{item.lastPracticed ? new Date(item.lastPracticed).toLocaleDateString() : 'Never'}</span></p>
                        </div>
                         <div>
                            <p className="text-text-secondary">Notes:</p>
                            <p className="p-3 bg-background rounded-md mt-1 whitespace-pre-wrap">{item.notes || 'No notes yet.'}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">Related Goals</h2>
                    {relatedGoals.length > 0 ? (
                        <ul className="space-y-3">
                            {relatedGoals.map(goal => (
                                <li key={goal.id} className="text-sm">
                                    <Link to="/goals" className="font-semibold text-primary hover:underline">{goal.title}</Link>
                                    <p className={`text-xs ${goal.status === GoalStatus.Completed ? 'text-green-400' : 'text-yellow-400'}`}>{goal.status} - {goal.progress}%</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-text-secondary text-sm">No specific goals set for this piece yet.</p>
                    )}
                </div>
            </div>
            
            {/* Practice History */}
            <div>
                 <h2 className="text-2xl font-bold text-text-primary mb-4">Practice History</h2>
                 <div className="bg-surface p-4 rounded-lg mb-6 flex space-x-8 items-center">
                    <p><strong className="text-text-primary text-xl">{relatedSessions.length}</strong> Sessions</p>
                    <p><strong className="text-text-primary text-xl">{Math.floor(totalTime / 60)}h {totalTime % 60}m</strong> Total Practice</p>
                 </div>
                 
                 {relatedSessions.length > 0 ? (
                    <div className="relative border-l-2 border-border ml-4 pl-8 space-y-8">
                        {relatedSessions.map(session => (
                            <div key={session.id} className="relative">
                                <div className="absolute -left-10 top-1 w-4 h-4 bg-primary rounded-full border-4 border-background"></div>
                                <div className="bg-surface p-4 rounded-lg">
                                    <p className="text-lg font-semibold">{new Date(session.date).toLocaleDateString('en-CA')} - {session.duration} min</p>
                                    <p className="text-text-secondary mb-2">{moodIcons[session.mood]} {session.mood}</p>
                                    <p className="text-text-primary whitespace-pre-wrap mb-3">{session.notes}</p>
                                    {session.link && (
                                        <div className="mb-3 p-3 bg-background rounded-md border border-border">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm text-text-secondary">📎 Instructor Resource:</span>
                                                <a 
                                                    href={session.link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary-hover text-sm underline break-all"
                                                    title="Open linked resource"
                                                >
                                                    {session.link.length > 50 ? `${session.link.substring(0, 47)}...` : session.link}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {session.recordings.length > 0 && (
                                        <div className="mt-3 border-t border-border pt-3">
                                            <h4 className="font-semibold text-text-secondary text-sm mb-2">Recordings:</h4>
                                            {session.recordings.map(rec => (
                                                <div key={rec.id}>
                                                     {rec.type === 'audio' ? (
                                                        <audio controls src={rec.url} className="h-10 w-full"></audio>
                                                    ) : (
                                                        <video controls src={rec.url} className="max-w-xs rounded-md border border-border"></video>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                 ) : (
                    <div className="text-center p-8 bg-surface rounded-lg">
                        <p className="text-text-secondary">No practice sessions logged for this piece yet. Time to play!</p>
                    </div>
                 )}
            </div>
        </div>
    );
};