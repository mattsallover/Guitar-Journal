import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PracticeSession, Mood, Recording } from '../types';
import { Modal } from '../components/Modal';
import { TagInput } from '../components/TagInput';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { UploadProgress } from '../components/UploadProgress';
import { supabase } from '../services/supabase';
import { MOOD_OPTIONS } from '../constants';
import { compressVideo, compressImage, formatFileSize } from '../utils/mediaUtils';

// Icons mapping
const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '🟢',
    [Mood.Good]: '🔵', 
    [Mood.Okay]: '🟡',
    [Mood.Challenging]: '🟠',
    [Mood.Frustrated]: '🔴',
};

const moodColors: Record<Mood, string> = {
    [Mood.Excellent]: 'bg-green-500/20 text-green-300 border-green-500/30',
    [Mood.Good]: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    [Mood.Okay]: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    [Mood.Challenging]: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    [Mood.Frustrated]: 'bg-red-500/20 text-red-300 border-red-500/30',
};

type ViewMode = 'cards' | 'list';
type SortKey = 'date' | 'duration' | 'mood';
type SortOrder = 'asc' | 'desc';

export const PracticeLog: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();

    // View and filtering state
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMoods, setSelectedMoods] = useState<Mood[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showWithRecordings, setShowWithRecordings] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);

    // Modal states
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentSession, setCurrentSession] = useState<Partial<PracticeSession> | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [masteryUpdateItems, setMasteryUpdateItems] = useState<any[]>([]);
    const [goalUpdateItem, setGoalUpdateItem] = useState<any>(null);
    const [uploadProgress, setUploadProgress] = useState<any[]>([]);
    const [showMasteryModal, setShowMasteryModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);

    // Pre-fill from navigation state
    useEffect(() => {
        const navState = location.state;
        if (navState?.topic || navState?.duration) {
            openSessionModal({
                date: new Date().toISOString().split('T')[0],
                duration: navState.duration || 30,
                mood: Mood.Good,
                techniques: navState.topic && navState.topic !== 'Practice Session' ? [navState.topic] : [],
                songs: [],
                notes: navState.notes || '',
                tags: [],
                recordings: [],
                link: navState.link || ''
            });
            // Clear navigation state
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate]);

    // Get all unique values for filtering
    const { allTags, allTechniques, allSongs } = useMemo(() => {
        const tags = new Set<string>();
        const techniques = new Set<string>();
        const songs = new Set<string>();
        
        state.practiceSessions.forEach(session => {
            session.tags?.forEach(tag => tags.add(tag));
            session.techniques?.forEach(tech => techniques.add(tech));
            session.songs?.forEach(song => songs.add(song));
        });
        
        return {
            allTags: Array.from(tags).sort(),
            allTechniques: Array.from(techniques).sort(),
            allSongs: Array.from(songs).sort()
        };
    }, [state.practiceSessions]);

    // Filtered and sorted sessions
    const filteredSessions = useMemo(() => {
        let filtered = state.practiceSessions.filter(session => {
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const searchableText = [
                    session.notes,
                    ...(session.techniques || []),
                    ...(session.songs || []),
                    ...(session.tags || [])
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchLower)) {
                    return false;
                }
            }

            // Mood filter
            if (selectedMoods.length > 0 && !selectedMoods.includes(session.mood)) {
                return false;
            }

            // Tags filter
            if (selectedTags.length > 0) {
                const sessionTags = session.tags || [];
                if (!selectedTags.some(tag => sessionTags.includes(tag))) {
                    return false;
                }
            }

            // Recordings filter
            if (showWithRecordings && (!session.recordings || session.recordings.length === 0)) {
                return false;
            }

            return true;
        });

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (sortKey) {
                case 'date':
                    comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                case 'duration':
                    comparison = a.duration - b.duration;
                    break;
                case 'mood':
                    const moodOrder = [Mood.Frustrated, Mood.Challenging, Mood.Okay, Mood.Good, Mood.Excellent];
                    comparison = moodOrder.indexOf(a.mood) - moodOrder.indexOf(b.mood);
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [state.practiceSessions, searchTerm, selectedMoods, selectedTags, showWithRecordings, sortKey, sortOrder]);

    const activeFilterCount = selectedMoods.length + selectedTags.length + (showWithRecordings ? 1 : 0);

    const openSessionModal = (session: Partial<PracticeSession> | null = null) => {
        setCurrentSession(session || {
            date: new Date().toISOString().split('T')[0],
            duration: 30,
            mood: Mood.Good,
            techniques: [],
            songs: [],
            notes: '',
            tags: [],
            recordings: [],
            link: ''
        });
        setSelectedFiles([]);
        setIsSessionModalOpen(true);
    };

    const closeSessionModal = () => {
        setIsSessionModalOpen(false);
        setCurrentSession(null);
        setSelectedFiles([]);
    };

    const handleSave = async () => {
        if (!currentSession || !state.user) return;
        
        setIsSaving(true);
        const uploadFiles: any[] = [];

        try {
            // Process file uploads
            if (selectedFiles.length > 0) {
                setUploadProgress(selectedFiles.map(file => ({
                    name: file.name,
                    progress: 0,
                    status: 'compressing' as const,
                    originalSize: file.size
                })));

                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    
                    try {
                        let processedFile = file;
                        let compressedSize = file.size;

                        // Compress if needed
                        if (file.type.startsWith('video/')) {
                            setUploadProgress(prev => prev.map((p, idx) => 
                                idx === i ? { ...p, status: 'compressing' as const, progress: 25 } : p
                            ));
                            processedFile = await compressVideo(file, {
                                maxWidth: 1280,
                                maxHeight: 720,
                                quality: 0.7,
                                maxSizeMB: 25
                            });
                            compressedSize = processedFile.size;
                        } else if (file.type.startsWith('image/')) {
                            setUploadProgress(prev => prev.map((p, idx) => 
                                idx === i ? { ...p, status: 'compressing' as const, progress: 25 } : p
                            ));
                            processedFile = await compressImage(file, {
                                maxWidth: 1920,
                                maxHeight: 1080,
                                quality: 0.8,
                                maxSizeMB: 5
                            });
                            compressedSize = processedFile.size;
                        }

                        // Upload to Supabase
                        setUploadProgress(prev => prev.map((p, idx) => 
                            idx === i ? { ...p, status: 'uploading' as const, progress: 50, compressedSize } : p
                        ));

                        const { data: { user }, error: authError } = await supabase.auth.getUser();
                        if (authError || !user) throw new Error('Authentication error');

                        const fileName = `${Date.now()}-${processedFile.name}`;
                        const filePath = `${user.id}/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('recordings')
                            .upload(filePath, processedFile);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('recordings')
                            .getPublicUrl(filePath);

                        uploadFiles.push({
                            id: filePath,
                            name: file.name,
                            type: file.type.startsWith('video/') ? 'video' : 'audio',
                            url: publicUrl,
                            originalSize: file.size,
                            compressedSize
                        });

                        setUploadProgress(prev => prev.map((p, idx) => 
                            idx === i ? { ...p, status: 'completed' as const, progress: 100 } : p
                        ));

                    } catch (error) {
                        console.error(`Error uploading file ${file.name}:`, error);
                        setUploadProgress(prev => prev.map((p, idx) => 
                            idx === i ? { ...p, status: 'error' as const, error: 'Upload failed' } : p
                        ));
                    }
                }
            }

            // Save session to database
            const sessionData = {
                user_id: state.user.uid,
                date: currentSession.date,
                duration: currentSession.duration || 30,
                mood: currentSession.mood || Mood.Good,
                techniques: currentSession.techniques || [],
                songs: currentSession.songs || [],
                notes: currentSession.notes || '',
                tags: currentSession.tags || [],
                recordings: [...(currentSession.recordings || []), ...uploadFiles],
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

            // Check for mastery and goal updates
            const practicedSongs = currentSession.songs || [];
            if (practicedSongs.length > 0) {
                const relatedItems = state.repertoire.filter(item => 
                    practicedSongs.some(song => song.toLowerCase().includes(item.title.toLowerCase()))
                );
                if (relatedItems.length > 0) {
                    setMasteryUpdateItems(relatedItems);
                    setShowMasteryModal(true);
                }
            }

            // Check for goal updates
            const allPracticedItems = [...(currentSession.techniques || []), ...(currentSession.songs || [])];
            if (allPracticedItems.length > 0) {
                const relatedGoal = state.goals.find(goal => 
                    goal.status === 'Active' && 
                    allPracticedItems.some(item => item.toLowerCase().includes(goal.title.toLowerCase()))
                );
                if (relatedGoal) {
                    setGoalUpdateItem(relatedGoal);
                    setShowGoalModal(true);
                }
            }

            closeSessionModal();
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Failed to save session. Please try again.');
        } finally {
            setIsSaving(false);
            setUploadProgress([]);
        }
    };

    const handleDelete = async (sessionId: string) => {
        if (!window.confirm('Are you sure you want to delete this practice session?')) return;

        try {
            const session = state.practiceSessions.find(s => s.id === sessionId);
            
            // Delete recordings from storage
            if (session?.recordings) {
                const deletePromises = session.recordings.map(recording => 
                    supabase.storage.from('recordings').remove([recording.id])
                );
                await Promise.all(deletePromises);
            }

            // Delete session from database
            const { error } = await supabase
                .from('practice_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) throw error;
            await refreshData();
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete session. Please try again.');
        }
    };

    const toggleExpanded = (sessionId: string) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const clearFilters = () => {
        setSelectedMoods([]);
        setSelectedTags([]);
        setShowWithRecordings(false);
        setSearchTerm('');
    };

    const renderSessionCard = (session: PracticeSession) => (
        <div key={session.id} className="bg-surface rounded-lg p-3 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group">
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-text-primary">
                            {new Date(session.date).toLocaleDateString('en-CA')}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${moodColors[session.mood]}`}>
                            {moodIcons[session.mood]} {session.mood}
                        </div>
                        <span className="text-sm text-text-secondary">{session.duration} min</span>
                        {session.recordings.length > 0 && (
                            <span className="text-blue-400" title={`${session.recordings.length} recording(s)`}>
                                🎥 {session.recordings.length}
                            </span>
                        )}
                    </div>

                    {(session.techniques.length > 0 || session.songs.length > 0) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {session.techniques.map(tech => (
                                <span key={tech} className="bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                                    🎸 {tech}
                                </span>
                            ))}
                            {session.songs.map(song => (
                                <span key={song} className="bg-secondary/20 text-secondary-300 px-2 py-1 rounded text-xs">
                                    🎵 {song}
                                </span>
                            ))}
                        </div>
                    )}

                    {session.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {session.tags.map(tag => (
                                <span key={tag} className="bg-surface border border-border text-text-secondary px-2 py-1 rounded text-xs">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {session.notes && (
                        <p className="text-text-primary text-sm mt-2 line-clamp-2">{session.notes}</p>
                    )}

                    {session.link && (
                        <div className="mt-2">
                            <a 
                                href={session.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-hover text-xs underline break-all"
                            >
                                📎 {session.link.length > 50 ? `${session.link.substring(0, 47)}...` : session.link}
                            </a>
                        </div>
                    )}
                </div>

                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                        onClick={() => openSessionModal(session)} 
                        className="text-sm text-primary hover:underline"
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => handleDelete(session.id)} 
                        className="text-sm text-red-400 hover:underline"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSessionListItem = (session: PracticeSession) => {
        const isExpanded = expandedSessions.has(session.id);
        
        return (
            <div key={session.id} className="bg-surface rounded-lg transition-all duration-300 hover:shadow-md">
                <div 
                    className="flex items-center p-3 cursor-pointer hover:bg-surface/80"
                    onClick={() => toggleExpanded(session.id)}
                >
                    <div className="w-24 text-sm font-medium text-text-primary">
                        {new Date(session.date).toLocaleDateString('en-CA')}
                    </div>
                    <div className="w-16 text-sm text-text-secondary">
                        {session.duration}m
                    </div>
                    <div className={`w-20 px-2 py-1 rounded-full text-xs font-medium border ${moodColors[session.mood]} text-center`}>
                        {moodIcons[session.mood]}
                    </div>
                    <div className="flex-1 px-3">
                        <div className="flex flex-wrap gap-1">
                            {session.techniques.slice(0, 2).map(tech => (
                                <span key={tech} className="bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                                    🎸 {tech}
                                </span>
                            ))}
                            {session.songs.slice(0, 2).map(song => (
                                <span key={song} className="bg-secondary/20 text-secondary-300 px-2 py-1 rounded text-xs">
                                    🎵 {song}
                                </span>
                            ))}
                            {(session.techniques.length + session.songs.length) > 4 && (
                                <span className="text-xs text-text-secondary">
                                    +{(session.techniques.length + session.songs.length) - 4} more
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {session.recordings.length > 0 && (
                            <span className="text-blue-400 text-sm" title={`${session.recordings.length} recording(s)`}>
                                🎥
                            </span>
                        )}
                        <button 
                            className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                            🔽
                        </button>
                    </div>
                    <div className="flex space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                openSessionModal(session);
                            }} 
                            className="text-sm text-primary hover:underline"
                        >
                            Edit
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(session.id);
                            }} 
                            className="text-sm text-red-400 hover:underline"
                        >
                            Delete
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="border-t border-border p-3">
                        {session.notes && (
                            <p className="text-text-primary text-sm mb-3 whitespace-pre-wrap">{session.notes}</p>
                        )}

                        {session.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {session.tags.map(tag => (
                                    <span key={tag} className="bg-surface border border-border text-text-secondary px-2 py-1 rounded text-xs">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {session.link && (
                            <div className="mb-3">
                                <a 
                                    href={session.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary-hover text-sm underline break-all"
                                >
                                    📎 {session.link}
                                </a>
                            </div>
                        )}

                        {session.recordings.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-text-secondary text-sm">Recordings:</h4>
                                {session.recordings.map(rec => (
                                    <div key={rec.id}>
                                        <p className="text-sm text-text-primary mb-1">{rec.name}</p>
                                        {rec.type === 'audio' ? (
                                            <audio controls src={rec.url} className="h-8 w-full max-w-md"></audio>
                                        ) : (
                                            <video controls src={rec.url} className="max-w-sm rounded border border-border"></video>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary">Practice Sessions</h1>
                    <p className="text-text-secondary mt-1">Track and review your guitar practice journey</p>
                </div>
                <button 
                    onClick={() => openSessionModal()} 
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                >
                    <span>+</span>
                    <span>Log Session</span>
                </button>
            </div>

            {/* Sticky Filter Bar */}
            <div className="sticky top-0 bg-background border-b border-border pb-4 mb-6 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 bg-surface p-2 rounded-md border border-border text-sm"
                        />

                        {/* Filters Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                activeFilterCount > 0 
                                    ? 'bg-primary/20 text-primary border-primary' 
                                    : 'bg-surface text-text-secondary border-border hover:bg-border'
                            }`}
                        >
                            🔧 Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </button>

                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 underline"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Sort */}
                        <select
                            value={`${sortKey}-${sortOrder}`}
                            onChange={(e) => {
                                const [key, order] = e.target.value.split('-');
                                setSortKey(key as SortKey);
                                setSortOrder(order as SortOrder);
                            }}
                            className="bg-surface p-2 rounded-md border border-border text-sm"
                        >
                            <option value="date-desc">📅 Newest First</option>
                            <option value="date-asc">📅 Oldest First</option>
                            <option value="duration-desc">⏱ Longest First</option>
                            <option value="duration-asc">⏱ Shortest First</option>
                            <option value="mood-desc">😊 Best Mood First</option>
                            <option value="mood-asc">😊 Worst Mood First</option>
                        </select>

                        {/* View Toggle */}
                        <div className="flex bg-surface border border-border rounded-md">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-2 text-sm rounded-l-md transition-colors ${
                                    viewMode === 'list' 
                                        ? 'bg-primary text-white' 
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                📋 List
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`px-3 py-2 text-sm rounded-r-md transition-colors ${
                                    viewMode === 'cards' 
                                        ? 'bg-primary text-white' 
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                🔳 Cards
                            </button>
                        </div>
                    </div>
                </div>

                {/* Expandable Filters */}
                {showFilters && (
                    <div className="bg-surface p-4 rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Mood Filter */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Mood</label>
                                <div className="flex flex-wrap gap-1">
                                    {MOOD_OPTIONS.map(mood => (
                                        <button
                                            key={mood}
                                            onClick={() => {
                                                setSelectedMoods(prev => 
                                                    prev.includes(mood as Mood)
                                                        ? prev.filter(m => m !== mood)
                                                        : [...prev, mood as Mood]
                                                );
                                            }}
                                            className={`px-2 py-1 rounded text-xs border transition-colors ${
                                                selectedMoods.includes(mood as Mood)
                                                    ? moodColors[mood as Mood]
                                                    : 'bg-background text-text-secondary border-border hover:bg-surface'
                                            }`}
                                        >
                                            {moodIcons[mood as Mood]} {mood}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tags Filter */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Tags</label>
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                    {allTags.slice(0, 10).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                setSelectedTags(prev => 
                                                    prev.includes(tag)
                                                        ? prev.filter(t => t !== tag)
                                                        : [...prev, tag]
                                                );
                                            }}
                                            className={`px-2 py-1 rounded text-xs transition-colors ${
                                                selectedTags.includes(tag)
                                                    ? 'bg-primary/20 text-primary border-primary'
                                                    : 'bg-background text-text-secondary border-border hover:bg-surface'
                                            }`}
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Other Filters */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Special</label>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showWithRecordings}
                                            onChange={(e) => setShowWithRecordings(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <span className="text-sm text-text-primary">🎥 Has Recordings</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Summary */}
            <div className="flex justify-between items-center mb-4">
                <p className="text-text-secondary text-sm">
                    Showing {filteredSessions.length} of {state.practiceSessions.length} sessions
                </p>
                {filteredSessions.length > 0 && (
                    <p className="text-text-secondary text-sm">
                        Total practice time: {Math.floor(filteredSessions.reduce((sum, s) => sum + s.duration, 0) / 60)}h {filteredSessions.reduce((sum, s) => sum + s.duration, 0) % 60}m
                    </p>
                )}
            </div>

            {/* Sessions Display */}
            <div className={viewMode === 'cards' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-2'}>
                {filteredSessions.length > 0 ? (
                    filteredSessions.map(session => 
                        viewMode === 'cards' 
                            ? renderSessionCard(session) 
                            : renderSessionListItem(session)
                    )
                ) : (
                    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                        <div className="text-6xl mb-6">🎸</div>
                        <h2 className="text-2xl font-bold text-text-primary mb-3">
                            {searchTerm || activeFilterCount > 0 
                                ? 'No Sessions Match Your Filters' 
                                : 'Start Your Practice Journey'
                            }
                        </h2>
                        <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
                            {searchTerm || activeFilterCount > 0
                                ? 'Try adjusting your search or filters to find sessions.'
                                : 'Log your first practice session to begin tracking your guitar progress.'
                            }
                        </p>
                        {searchTerm || activeFilterCount > 0 ? (
                            <button 
                                onClick={clearFilters}
                                className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Clear Filters
                            </button>
                        ) : (
                            <button 
                                onClick={() => openSessionModal()} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Log Your First Session
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Session Modal */}
            {isSessionModalOpen && currentSession && (
                <Modal 
                    isOpen={isSessionModalOpen} 
                    onClose={closeSessionModal} 
                    title={currentSession.id ? "Edit Practice Session" : "Log Practice Session"}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Date</label>
                                <input 
                                    type="date" 
                                    value={currentSession.date} 
                                    onChange={e => setCurrentSession({ ...currentSession, date: e.target.value })} 
                                    className="w-full bg-background p-2 rounded-md border border-border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Duration (minutes)</label>
                                <input 
                                    type="number" 
                                    value={currentSession.duration} 
                                    onChange={e => setCurrentSession({ ...currentSession, duration: parseInt(e.target.value) || 0 })} 
                                    className="w-full bg-background p-2 rounded-md border border-border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Mood</label>
                                <select 
                                    value={currentSession.mood} 
                                    onChange={e => setCurrentSession({ ...currentSession, mood: e.target.value as Mood })} 
                                    className="w-full bg-background p-2 rounded-md border border-border"
                                >
                                    {MOOD_OPTIONS.map(mood => (
                                        <option key={mood} value={mood}>
                                            {moodIcons[mood as Mood]} {mood}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Techniques</label>
                                <TagInput
                                    values={currentSession.techniques || []}
                                    onChange={(values) => setCurrentSession({ ...currentSession, techniques: values })}
                                    suggestions={allTechniques}
                                    placeholder="Add techniques..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Songs</label>
                                <TagInput
                                    values={currentSession.songs || []}
                                    onChange={(values) => setCurrentSession({ ...currentSession, songs: values })}
                                    suggestions={allSongs}
                                    placeholder="Add songs..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Notes</label>
                            <textarea 
                                value={currentSession.notes} 
                                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })} 
                                className="w-full bg-background p-2 rounded-md border border-border h-20"
                                placeholder="What did you work on? How did it go?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Tags</label>
                            <TagInput
                                values={currentSession.tags || []}
                                onChange={(values) => setCurrentSession({ ...currentSession, tags: values })}
                                suggestions={allTags}
                                placeholder="Add tags..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Instructor Link (optional)</label>
                            <input 
                                type="url"
                                value={currentSession.link || ''} 
                                onChange={e => setCurrentSession({ ...currentSession, link: e.target.value })} 
                                className="w-full bg-background p-2 rounded-md border border-border"
                                placeholder="https://docs.google.com/..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Recordings (optional)</label>
                            <input 
                                type="file" 
                                accept="audio/*,video/*" 
                                multiple
                                onChange={e => setSelectedFiles(Array.from(e.target.files || []))}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                            {selectedFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {selectedFiles.map((file, idx) => (
                                        <p key={idx} className="text-xs text-text-secondary">
                                            {file.name} ({formatFileSize(file.size)})
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            <button 
                                onClick={closeSessionModal} 
                                disabled={isSaving}
                                className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Upload Progress Modal */}
            {uploadProgress.length > 0 && (
                <UploadProgress files={uploadProgress} />
            )}

            {/* Mastery Update Modal */}
            {showMasteryModal && (
                <MasteryUpdateModal
                    isOpen={showMasteryModal}
                    onClose={() => setShowMasteryModal(false)}
                    items={masteryUpdateItems}
                    onUpdate={async (updatedItems) => {
                        for (const item of updatedItems) {
                            await supabase
                                .from('repertoire')
                                .update({ 
                                    mastery: item.mastery,
                                    last_practiced: new Date().toISOString()
                                })
                                .eq('id', item.id);
                        }
                        await refreshData();
                        setShowMasteryModal(false);
                    }}
                />
            )}

            {/* Goal Update Modal */}
            {showGoalModal && goalUpdateItem && (
                <GoalUpdateModal
                    isOpen={showGoalModal}
                    onClose={() => setShowGoalModal(false)}
                    goal={goalUpdateItem}
                    onUpdate={async (goal, newProgress) => {
                        await supabase
                            .from('goals')
                            .update({ progress: newProgress })
                            .eq('id', goal.id);
                        await refreshData();
                        setShowGoalModal(false);
                    }}
                />
            )}
        </div>
    );
};