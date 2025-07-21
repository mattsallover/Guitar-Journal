import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PracticeSession, Mood, Recording } from '../types';
import { Modal } from '../components/Modal';
import { TagInput } from '../components/TagInput';
import { NaturalLanguageInput } from '../components/NaturalLanguageInput';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { MOOD_OPTIONS } from '../constants';
import { supabase } from '../services/supabase';

export const PracticeLog: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [currentSession, setCurrentSession] = useState<Partial<PracticeSession> | null>(null);
    const [filterMood, setFilterMood] = useState<Mood | 'all'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
    
    // Goal and mastery update modals
    const [goalUpdateModal, setGoalUpdateModal] = useState<{ isOpen: boolean; goal: any } | null>(null);
    const [masteryUpdateModal, setMasteryUpdateModal] = useState<{ isOpen: boolean; items: any[] } | null>(null);

    useEffect(() => {
        const navState = location.state;
        if (navState?.topic || navState?.duration || navState?.notes) {
            const sessionDate = new Date().toISOString().split('T')[0];
            const newSession: Partial<PracticeSession> = {
                date: sessionDate,
                duration: navState.duration || 30,
                mood: Mood.Okay,
                techniques: navState.topic && !state.repertoire.some(r => r.title.toLowerCase() === navState.topic.toLowerCase()) ? [navState.topic] : [],
                songs: navState.topic && state.repertoire.some(r => r.title.toLowerCase() === navState.topic.toLowerCase()) ? [navState.topic] : [],
                notes: navState.notes || '',
                tags: [],
                recordings: [],
                link: ''
            };
            
            openModal(newSession);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, state.repertoire]);

    const openModal = (session: Partial<PracticeSession> | null = null) => {
        const today = new Date().toISOString().split('T')[0];
        setCurrentSession(session || { 
            date: today, 
            duration: 30, 
            mood: Mood.Okay, 
            techniques: [], 
            songs: [], 
            notes: '', 
            tags: [], 
            recordings: [],
            link: '' 
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentSession(null);
    };

    const handleAIParsed = (parsed: any) => {
        if (currentSession) {
            setCurrentSession({
                ...currentSession,
                duration: parsed.duration || currentSession.duration,
                mood: (parsed.mood as Mood) || currentSession.mood,
                techniques: [...(currentSession.techniques || []), ...(parsed.techniques || [])],
                songs: [...(currentSession.songs || []), ...(parsed.songs || [])],
                notes: parsed.notes || currentSession.notes,
                tags: [...(currentSession.tags || []), ...(parsed.tags || [])]
            });
        }
    };

    const handleSave = async () => {
        if (!currentSession || !state.user) return;
        setIsSaving(true);

        try {
            const sessionData = {
                user_id: state.user.uid,
                date: currentSession.date || new Date().toISOString().split('T')[0],
                duration: currentSession.duration || 30,
                mood: currentSession.mood || Mood.Okay,
                techniques: currentSession.techniques || [],
                songs: currentSession.songs || [],
                notes: currentSession.notes || '',
                tags: currentSession.tags || [],
                recordings: currentSession.recordings || [],
                link: currentSession.link || ''
            };

            if (currentSession.id) {
                const { error } = await supabase
                    .from('practice_sessions')
                    .update(sessionData)
                    .eq('id', currentSession.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('practice_sessions')
                    .insert([sessionData]);
                if (error) throw error;
            }

            await refreshData();
            
            // Check for related goals and repertoire to update
            checkForRelatedUpdates(currentSession);
            
            closeModal();
        } catch (error) {
            console.error("Error saving practice session:", error);
            alert("Failed to save session. Check your internet connection or Supabase configuration.");
        } finally {
            setIsSaving(false);
        }
    };

    const checkForRelatedUpdates = (session: Partial<PracticeSession>) => {
        // Check for related active goals
        const sessionTechniques = session.techniques || [];
        const sessionSongs = session.songs || [];
        const allTopics = [...sessionTechniques, ...sessionSongs];
        
        const relatedGoals = state.goals.filter(goal => 
            goal.status === 'Active' && 
            allTopics.some(topic => 
                goal.title.toLowerCase().includes(topic.toLowerCase()) ||
                topic.toLowerCase().includes(goal.title.toLowerCase())
            )
        );

        if (relatedGoals.length > 0) {
            setGoalUpdateModal({ isOpen: true, goal: relatedGoals[0] });
        }

        // Check for related repertoire items
        const relatedRepertoire = state.repertoire.filter(item =>
            sessionSongs.some(song => 
                song.toLowerCase() === item.title.toLowerCase() ||
                item.title.toLowerCase().includes(song.toLowerCase())
            )
        );

        if (relatedRepertoire.length > 0) {
            setMasteryUpdateModal({ isOpen: true, items: relatedRepertoire });
        }
    };

    const handleGoalUpdate = async (goal: any, newProgress: number) => {
        try {
            const { error } = await supabase
                .from('goals')
                .update({ progress: newProgress })
                .eq('id', goal.id);
            
            if (error) throw error;
            await refreshData();
        } catch (error) {
            console.error("Error updating goal:", error);
        } finally {
            setGoalUpdateModal(null);
        }
    };

    const handleMasteryUpdate = async (updatedItems: any[]) => {
        try {
            const updates = updatedItems.map(item => 
                supabase
                    .from('repertoire')
                    .update({ 
                        mastery: item.mastery,
                        last_practiced: new Date().toISOString()
                    })
                    .eq('id', item.id)
            );
            
            await Promise.all(updates);
            await refreshData();
        } catch (error) {
            console.error("Error updating repertoire mastery:", error);
        } finally {
            setMasteryUpdateModal(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this practice session?')) {
            try {
                const { error } = await supabase
                    .from('practice_sessions')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
            } catch (error) {
                console.error("Error deleting practice session:", error);
                alert("Failed to delete session. Please try again.");
            }
        }
    };

    // Get all unique techniques and songs for suggestions
    const allTechniques = [...new Set(state.practiceSessions.flatMap(s => s.techniques))].filter(Boolean);
    const allSongs = [...new Set([
        ...state.practiceSessions.flatMap(s => s.songs),
        ...state.repertoire.map(r => r.title)
    ])].filter(Boolean);
    const allTags = [...new Set(state.practiceSessions.flatMap(s => s.tags))].filter(Boolean);

    const filteredSessions = state.practiceSessions
        .filter(session => filterMood === 'all' || session.mood === filterMood)
        .sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            } else {
                return b.duration - a.duration;
            }
        });

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary">Practice Log</h1>
                    <p className="text-text-secondary mt-1">Record and track your practice sessions</p>
                </div>
                <button 
                    onClick={() => openModal()} 
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                    title="Add a new practice session"
                >
                    <span>+</span>
                    <span>Log Session</span>
                </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-text-secondary">Filter:</span>
                        <select 
                            value={filterMood} 
                            onChange={e => setFilterMood(e.target.value as Mood | 'all')}
                            className="bg-surface p-2 rounded-md border border-border"
                        >
                            <option value="all">All Moods ({state.practiceSessions.length})</option>
                            {MOOD_OPTIONS.map(mood => (
                                <option key={mood} value={mood}>
                                    {mood} ({state.practiceSessions.filter(s => s.mood === mood).length})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-text-secondary">Sort:</span>
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value as 'date' | 'duration')}
                            className="bg-surface p-2 rounded-md border border-border"
                        >
                            <option value="date">By Date</option>
                            <option value="duration">By Duration</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredSessions.map(session => (
                    <div key={session.id} className="bg-surface p-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center space-x-4 mb-3">
                                    <h3 className="text-xl font-semibold text-text-primary">
                                        {new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </h3>
                                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium">
                                        {session.duration} min
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        session.mood === Mood.Excellent ? 'bg-green-900/20 text-green-400' :
                                        session.mood === Mood.Good ? 'bg-blue-900/20 text-blue-400' :
                                        session.mood === Mood.Okay ? 'bg-yellow-900/20 text-yellow-400' :
                                        session.mood === Mood.Challenging ? 'bg-orange-900/20 text-orange-400' :
                                        'bg-red-900/20 text-red-400'
                                    }`}>
                                        {session.mood}
                                    </span>
                                </div>

                                {(session.techniques.length > 0 || session.songs.length > 0) && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {session.techniques.map(technique => (
                                            <span key={technique} className="bg-secondary/20 text-secondary-300 px-2 py-1 rounded-full text-xs">
                                                🎸 {technique}
                                            </span>
                                        ))}
                                        {session.songs.map(song => (
                                            <span key={song} className="bg-green-900/20 text-green-400 px-2 py-1 rounded-full text-xs">
                                                🎵 {song}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <p className="text-text-primary whitespace-pre-wrap mb-4">{session.notes}</p>

                                {session.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {session.tags.map(tag => (
                                            <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {session.recordings && session.recordings.length > 0 && (
                                    <div className="mt-4 border-t border-border pt-4">
                                        <h4 className="font-semibold text-text-secondary text-sm mb-3">Recordings:</h4>
                                        <div className="space-y-3">
                                            {session.recordings.map((recording: Recording) => (
                                                <div key={recording.id}>
                                                    <p className="text-sm text-text-primary mb-1">{recording.name}</p>
                                                    {recording.type === 'audio' ? (
                                                        <audio controls src={recording.url} className="h-10 w-full max-w-md"></audio>
                                                    ) : (
                                                        <video controls src={recording.url} className="max-w-sm rounded-md border border-border"></video>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button 
                                    onClick={() => openModal(session)} 
                                    className="text-sm text-primary hover:underline transition-colors duration-200"
                                    title="Edit this session"
                                >
                                    ✏️ Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(session.id)} 
                                    className="text-sm text-red-400 hover:underline transition-colors duration-200"
                                    title="Delete this session"
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredSessions.length === 0 && (
                    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                        <div className="text-6xl mb-6">📓</div>
                        <h2 className="text-2xl font-bold text-text-primary mb-3">
                            {filterMood === 'all' ? 'Start Your Practice Journal' : `No ${filterMood} Sessions`}
                        </h2>
                        <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
                            {filterMood === 'all' 
                                ? 'Log your practice sessions to track progress and build consistency.' 
                                : `You don't have any practice sessions with ${filterMood} mood.`
                            }
                        </p>
                        {filterMood === 'all' && (
                            <button 
                                onClick={() => openModal()} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Log Your First Session
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isModalOpen && currentSession && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentSession.id ? "Edit Practice Session" : "Log Practice Session"}>
                    <div className="space-y-6">
                        {/* AI Input Section */}
                        {useAI && !currentSession.id && (
                            <div className="border-b border-border pb-6">
                                <NaturalLanguageInput onParsed={handleAIParsed} />
                                <div className="text-center mt-4">
                                    <button 
                                        onClick={() => setUseAI(false)}
                                        className="text-sm text-text-secondary hover:text-text-primary underline"
                                    >
                                        Prefer manual entry? Switch to form →
                                    </button>
                                </div>
                            </div>
                        )}

                        {!useAI && (
                            <div className="text-center border-b border-border pb-4">
                                <button 
                                    onClick={() => setUseAI(true)}
                                    className="text-sm text-primary hover:underline"
                                >
                                    ← Try AI-powered logging instead
                                </button>
                            </div>
                        )}

                        {/* Manual Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Date</label>
                                <input 
                                    type="date" 
                                    value={currentSession.date} 
                                    onChange={e => setCurrentSession({ ...currentSession, date: e.target.value })} 
                                    className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Duration (minutes)</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={currentSession.duration} 
                                    onChange={e => setCurrentSession({ ...currentSession, duration: parseInt(e.target.value) || 30 })} 
                                    className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Mood</label>
                            <select 
                                value={currentSession.mood} 
                                onChange={e => setCurrentSession({ ...currentSession, mood: e.target.value as Mood })} 
                                className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                {MOOD_OPTIONS.map(mood => <option key={mood} value={mood}>{mood}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Techniques Practiced</label>
                            <TagInput 
                                values={currentSession.techniques || []} 
                                onChange={techniques => setCurrentSession({ ...currentSession, techniques })}
                                suggestions={allTechniques}
                                placeholder="Add techniques (e.g., barre chords, fingerpicking)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Songs Practiced</label>
                            <TagInput 
                                values={currentSession.songs || []} 
                                onChange={songs => setCurrentSession({ ...currentSession, songs })}
                                suggestions={allSongs}
                                placeholder="Add songs"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Session Notes</label>
                            <textarea 
                                value={currentSession.notes} 
                                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })} 
                                className="w-full bg-background p-3 rounded-md border border-border h-32 transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                placeholder="What did you work on? How did it go? Any breakthroughs or challenges?"
                            ></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Tags</label>
                            <TagInput 
                                values={currentSession.tags || []} 
                                onChange={tags => setCurrentSession({ ...currentSession, tags })}
                                suggestions={allTags}
                                placeholder="Add tags for easy searching"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Related Link (optional)</label>
                            <input 
                                type="url" 
                                value={currentSession.link || ''} 
                                onChange={e => setCurrentSession({ ...currentSession, link: e.target.value })} 
                                className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                placeholder="YouTube tutorial, sheet music, etc."
                            />
                        </div>

                        <div className="flex justify-end space-x-4 pt-6 border-t border-border">
                            <button 
                                onClick={closeModal} 
                                disabled={isSaving} 
                                className="bg-surface hover:bg-border text-text-primary font-bold py-3 px-6 rounded-md disabled:opacity-50 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
                            >
                                {isSaving ? 'Saving...' : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Goal Update Modal */}
            {goalUpdateModal && (
                <GoalUpdateModal
                    isOpen={goalUpdateModal.isOpen}
                    onClose={() => setGoalUpdateModal(null)}
                    goal={goalUpdateModal.goal}
                    onUpdate={handleGoalUpdate}
                />
            )}

            {/* Mastery Update Modal */}
            {masteryUpdateModal && (
                <MasteryUpdateModal
                    isOpen={masteryUpdateModal.isOpen}
                    onClose={() => setMasteryUpdateModal(null)}
                    items={masteryUpdateModal.items}
                    onUpdate={handleMasteryUpdate}
                />
            )}
        </div>
    );
};