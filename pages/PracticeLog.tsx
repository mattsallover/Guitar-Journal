
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PracticeSession, Mood, Recording, Goal, GoalStatus, RepertoireItem } from '../types';
import { Modal } from '../components/Modal';
import { MOOD_OPTIONS } from '../constants';
import { TagInput } from '../components/TagInput';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { supabase } from '../services/supabase';


const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '😊',
    [Mood.Good]: '🙂',
    [Mood.Okay]: '😐',
    [Mood.Challenging]: '😕',
    [Mood.Frustrated]: '😠',
};

export const PracticeLog: React.FC = () => {
    const { state } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSession, setCurrentSession] = useState<Partial<PracticeSession> | null>(null);
    const [newRecordings, setNewRecordings] = useState<File[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [goalToUpdate, setGoalToUpdate] = useState<Goal | null>(null);
    const [masteryItemsToUpdate, setMasteryItemsToUpdate] = useState<RepertoireItem[]>([]);


    const repertoireTitles = useMemo(() => state.repertoire.map(r => r.title), [state.repertoire]);
    const allTechniques = useMemo(() => {
        const techniques = state.practiceSessions.flatMap(s => s.techniques);
        return [...new Set(techniques.filter(t => t))];
    }, [state.practiceSessions]);
    
    useEffect(() => {
        const liveSessionData = location.state;
        if (liveSessionData?.topic) {
            const { topic, duration, notes } = liveSessionData;
            
            const isSong = repertoireTitles.includes(topic);
            const isTechnique = allTechniques.includes(topic);

            const newSession: Partial<PracticeSession> = {
                date: new Date().toISOString().split('T')[0],
                duration: duration || 30,
                mood: Mood.Okay,
                songs: isSong ? [topic] : [],
                techniques: !isSong || isTechnique ? [topic] : [],
                tags: [],
                notes: notes || '',
                recordings: [],
                link: ''
            };
            openModal(newSession);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, repertoireTitles, allTechniques]);


    const openModal = (session: Partial<PracticeSession> | null = null) => {
        setCurrentSession(session ? { ...session } : { date: new Date().toISOString().split('T')[0], duration: 30, mood: Mood.Okay, techniques: [], songs: [], tags: [], notes: '', recordings: [], link: '' });
        setNewRecordings([]);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentSession(null);
    };

    const handleSave = async () => {
        if (!currentSession || !state.user) return;
        setIsSaving(true);

        try {
            // Upload new recordings to Supabase Storage
            const uploadedRecordings = await Promise.all(
                newRecordings.map(async (file) => {
                    const fileName = `${Date.now()}-${file.name}`;
                    const filePath = `recordings/${state.user!.uid}/${fileName}`;
                    
                    const { data, error } = await supabase.storage
                        .from('recordings')
                        .upload(filePath, file);
                    
                    if (error) {
                        throw error;
                    }
                    
                    const { data: { publicUrl } } = supabase.storage
                        .from('recordings')
                        .getPublicUrl(filePath);
                    
                    const type: 'audio' | 'video' = file.type.startsWith('audio') ? 'audio' : 'video';
                    return {
                        id: filePath,
                        name: file.name,
                        type,
                        url: publicUrl,
                    };
                })
            );

            const sessionData = {
                user_id: state.user!.uid,
                date: currentSession.date!,
                duration: currentSession.duration!,
                mood: currentSession.mood!,
                techniques: currentSession.techniques || [],
                songs: currentSession.songs || [],
                notes: currentSession.notes || '',
                tags: currentSession.tags || [],
                link: currentSession.link || '',
                recordings: [...(currentSession.recordings || []), ...uploadedRecordings],
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

            const today = new Date().toISOString().split('T')[0];
            const practicedRepertoireItems = state.repertoire.filter(r => 
                (sessionData.songs || []).includes(r.title)
            );

            if (practicedRepertoireItems.length > 0) {
                await Promise.all(practicedRepertoireItems.map(item => {
                    return supabase
                        .from('repertoire')
                        .update({ last_practiced: today })
                        .eq('id', item.id);
                }));
            }
            
            closeModal();

            if(practicedRepertoireItems.length > 0) {
                setTimeout(() => setMasteryItemsToUpdate(practicedRepertoireItems), 300);
            } else {
                const savedTopics = [...(sessionData.songs || []), ...(sessionData.techniques || [])].map(t => t.toLowerCase());
                const relatedGoal = state.goals.find(g => 
                    g.status === GoalStatus.Active && savedTopics.some(topic => g.title.toLowerCase().includes(topic))
                );
                if (relatedGoal) {
                    setTimeout(() => setGoalToUpdate(relatedGoal), 300);
                }
            }
        } catch (error) {
            console.error("Error saving session:", error);
            alert("Failed to save session. Check your internet connection or Supabase configuration.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (session: PracticeSession) => {
        if(window.confirm('Are you sure you want to delete this session? This will also delete any associated recordings permanently.')){
            try {
                // Delete recordings from Supabase Storage first
                if (session.recordings && session.recordings.length > 0) {
                    await Promise.all(session.recordings.map(rec => {
                        return supabase.storage
                            .from('recordings')
                            .remove([rec.id]);
                    }));
                }
                // Then delete the database record
                const { error } = await supabase
                    .from('practice_sessions')
                    .delete()
                    .eq('id', session.id);
                
                if (error) throw error;
            } catch (error) {
                console.error("Error deleting session:", error);
                alert("Failed to delete session. Please try again.");
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setNewRecordings(Array.from(e.target.files));
        }
    };

    const handleMasteryUpdate = async (updatedItems: RepertoireItem[]) => {
        try {
            await Promise.all(updatedItems.map(item => {
                return supabase
                    .from('repertoire')
                    .update({ mastery: item.mastery })
                    .eq('id', item.id);
            }));
        } catch (error) {
            console.error("Failed to update mastery", error);
        }
        setMasteryItemsToUpdate([]);

        const sessions = state.practiceSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastSession = sessions.length > 0 ? sessions[0] : null;
        if (!lastSession) return;

        const savedTopics = [...(lastSession.songs || []), ...(lastSession.techniques || [])].map(t => t.toLowerCase());
        const relatedGoal = state.goals.find(g => 
            g.status === GoalStatus.Active && savedTopics.some(topic => g.title.toLowerCase().includes(topic))
        );
        if (relatedGoal) {
            setTimeout(() => setGoalToUpdate(relatedGoal), 300);
        }
    };

    const handleGoalUpdate = async (goal: Goal, progress: number) => {
        try {
            const { error } = await supabase
                .from('goals')
                .update({ progress })
                .eq('id', goal.id);
            
            if (error) throw error;
        } catch (error) {
            console.error("Failed to update goal", error);
        }
        setGoalToUpdate(null);
    };

    const filteredSessions = state.practiceSessions
        .filter(session => 
            session.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.songs.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
            session.techniques.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Practice Log</h1>
                <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                    + Log Session
                </button>
            </div>
            
             <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface p-2 rounded-md border border-border mb-6"
            />

            <div className="space-y-4">
                {filteredSessions.map(session => (
                    <div key={session.id} className="bg-surface p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xl font-semibold">{new Date(session.date).toLocaleDateString('en-CA')} - {session.duration} min</p>
                                <p className="text-text-secondary">{moodIcons[session.mood]} {session.mood}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => openModal(session)} className="text-sm text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDelete(session)} className="text-sm text-red-400 hover:underline">Delete</button>
                            </div>
                        </div>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{session.notes}</p>
                        {session.link && (
                            <div className="mt-2">
                                <a 
                                    href={session.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center text-sm text-secondary hover:underline break-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                    </svg>
                                    View Linked Resource
                                </a>
                            </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            {session.songs.map(s => <Link to={`/progression?focus=${encodeURIComponent(s)}`} key={s} className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full hover:bg-blue-500/40 transition-colors">{s}</Link>)}
                            {session.techniques.map(t => <Link to={`/progression?focus=${encodeURIComponent(t)}`} key={t} className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full hover:bg-indigo-500/40 transition-colors">{t}</Link>)}
                            {session.tags.map(t => <span key={t} className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full">{t}</span>)}
                        </div>
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
                ))}
            </div>

            {isModalOpen && currentSession && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentSession.id ? "Edit Session" : "Log New Session"}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Date</label>
                                <input type="date" value={currentSession.date?.split('T')[0]} onChange={e => setCurrentSession({ ...currentSession, date: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Duration (min)</label>
                                <input type="number" value={currentSession.duration} onChange={e => setCurrentSession({ ...currentSession, duration: parseInt(e.target.value) || 0 })} className="w-full bg-background p-2 rounded-md border border-border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Mood</label>
                                <select value={currentSession.mood} onChange={e => setCurrentSession({ ...currentSession, mood: e.target.value as Mood })} className="w-full bg-background p-2 rounded-md border border-border">
                                    {MOOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Songs/Pieces</label>
                            <TagInput
                                placeholder="Add songs from your repertoire..."
                                values={currentSession.songs || []}
                                onChange={(newSongs) => setCurrentSession({ ...currentSession, songs: newSongs })}
                                suggestions={repertoireTitles}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Techniques</label>
                             <TagInput
                                placeholder="Add practiced techniques..."
                                values={currentSession.techniques || []}
                                onChange={(newTechniques) => setCurrentSession({ ...currentSession, techniques: newTechniques })}
                                suggestions={allTechniques}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Notes</label>
                            <textarea value={currentSession.notes} onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border h-24"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Hyperlink (e.g., Google Sheet)</label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={currentSession.link || ''}
                                onChange={e => setCurrentSession({ ...currentSession, link: e.target.value })}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Media Attachments (Audio/Video)</label>
                            <input type="file" multiple accept="audio/*,video/*" onChange={handleFileChange} className="w-full bg-background p-2 rounded-md border border-border" />
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button onClick={closeModal} disabled={isSaving} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? 'Saving...' : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <MasteryUpdateModal
                isOpen={masteryItemsToUpdate.length > 0}
                onClose={() => setMasteryItemsToUpdate([])}
                items={masteryItemsToUpdate}
                onUpdate={handleMasteryUpdate}
            />

            {goalToUpdate && (
                <GoalUpdateModal 
                    isOpen={!!goalToUpdate}
                    onClose={() => setGoalToUpdate(null)}
                    goal={goalToUpdate}
                    onUpdate={handleGoalUpdate}
                />
            )}
        </div>
    );
};
