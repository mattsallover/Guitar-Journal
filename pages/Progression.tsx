import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Mood, PracticeSession } from '../types';

const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '😊',
    [Mood.Good]: '🙂',
    [Mood.Okay]: '😐',
    [Mood.Challenging]: '😕',
    [Mood.Frustrated]: '😠',
};

export const Progression: React.FC = () => {
    const { state } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();

    const getFocusOptions = () => {
        const repertoireTitles = state.repertoire.map(r => r.title);
        const allTechniques = state.practiceSessions.flatMap(s => s.techniques);
        const uniqueTechniques = [...new Set(allTechniques.filter(t => t))]; // Filter out empty strings
        return [...new Set([...repertoireTitles, ...uniqueTechniques])].sort();
    };

    const queryParams = new URLSearchParams(location.search);
    const initialFocus = queryParams.get('focus') || '';
    
    const [selectedFocus, setSelectedFocus] = useState(initialFocus);

    useEffect(() => {
        const newFocusFromURL = new URLSearchParams(location.search).get('focus') || '';
        if (newFocusFromURL !== selectedFocus) {
            setSelectedFocus(newFocusFromURL);
        }
    }, [location.search]);

    const handleFocusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newFocus = e.target.value;
        setSelectedFocus(newFocus);
        if (newFocus) {
            navigate(`/progression?focus=${encodeURIComponent(newFocus)}`);
        } else {
            navigate('/progression');
        }
    };

    const handleStartPractice = (topic: string) => {
        navigate('/session/live', { state: { topic } });
    };
    
    const {filteredSessions, totalTime, totalSessions} = useMemo(() => {
        if (!selectedFocus) return {filteredSessions: [], totalTime: 0, totalSessions: 0};
        
        const lowerCaseFocus = selectedFocus.toLowerCase();
        
        const sessions = state.practiceSessions
            .filter(session =>
                (session.songs && session.songs.some(s => s.toLowerCase().includes(lowerCaseFocus))) ||
                (session.techniques && session.techniques.some(t => t.toLowerCase().includes(lowerCaseFocus)))
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const time = sessions.reduce((sum, s) => sum + s.duration, 0);

        return {filteredSessions: sessions, totalTime: time, totalSessions: sessions.length};
    }, [selectedFocus, state.practiceSessions]);

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-2">Progression Timeline</h1>
            <p className="text-text-secondary mb-6">Select a topic to see your practice history and listen to your progress.</p>

            <div className="mb-8 max-w-lg">
                <label htmlFor="focus-select" className="block text-sm font-medium text-text-secondary mb-1">
                    Select a song or technique:
                </label>
                <select 
                    id="focus-select"
                    value={selectedFocus} 
                    onChange={handleFocusChange}
                    className="w-full bg-surface p-2 rounded-md border border-border text-text-primary"
                >
                    <option value="">-- Select a Focus --</option>
                    {getFocusOptions().map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            {!selectedFocus ? (
                <div className="p-8 flex flex-col items-center justify-center h-full bg-surface rounded-lg">
                    <div className="text-5xl mb-4">📈</div>
                    <h2 className="text-2xl font-bold mb-2">Trace Your Journey</h2>
                    <p className="text-text-secondary text-lg text-center max-w-2xl">
                        Pick a song or technique from the dropdown above to begin.
                    </p>
                </div>
            ) : (
                <div>
                     <div className="bg-surface p-4 rounded-lg mb-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-primary">{selectedFocus}</h2>
                            <div className="flex space-x-8 mt-2 text-text-secondary">
                               <p><strong className="text-text-primary">{totalSessions}</strong> Sessions</p>
                               <p><strong className="text-text-primary">{Math.floor(totalTime / 60)}h {totalTime % 60}m</strong> Total Practice</p>
                            </div>
                        </div>
                        <button onClick={() => handleStartPractice(selectedFocus)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md whitespace-nowrap">Practice This Topic</button>
                    </div>
                    
                    {filteredSessions.length > 0 ? (
                        <div className="relative border-l-2 border-border ml-4 pl-8 space-y-8">
                            {filteredSessions.map(session => (
                                <div key={session.id} className="relative">
                                    <div className="absolute -left-10 top-1 w-4 h-4 bg-primary rounded-full border-4 border-background"></div>
                                    <div className="bg-surface p-4 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-lg font-semibold">{new Date(session.date).toLocaleDateString('en-CA')} - {session.duration} min</p>
                                                <p className="text-text-secondary mb-2">{moodIcons[session.mood]} {session.mood}</p>
                                            </div>
                                            <button onClick={() => handleStartPractice(selectedFocus)} className="text-sm bg-primary/20 hover:bg-primary/40 text-primary-300 font-bold py-1 px-3 rounded-md whitespace-nowrap">Practice This Again</button>
                                        </div>
                                        <p className="text-text-primary whitespace-pre-wrap mb-3">{session.notes}</p>
                                        {session.recordings.length > 0 && (
                                            <div className="mt-3 border-t border-border pt-3">
                                                <h4 className="font-semibold text-text-secondary text-sm mb-2">Recordings:</h4>
                                                <div className="space-y-3">
                                                {session.recordings.map(rec => (
                                                    <div key={rec.id}>
                                                        <p className="text-sm text-text-primary mb-1">{rec.name}</p>
                                                        {rec.type === 'audio' ? (
                                                            <audio controls src={rec.url} className="h-10 w-full"></audio>
                                                        ) : (
                                                            <video controls src={rec.url} className="max-w-xs rounded-md border border-border"></video>
                                                        )}
                                                    </div>
                                                ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col items-center justify-center h-full bg-surface rounded-lg">
                            <div className="text-5xl mb-4">🤔</div>
                            <h2 className="text-2xl font-bold mb-2">No Sessions Found</h2>
                            <p className="text-text-secondary text-lg text-center max-w-2xl">
                                We couldn't find any practice sessions for "{selectedFocus}". Try logging a session for it!
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};