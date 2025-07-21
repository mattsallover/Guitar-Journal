import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PracticeSession, Mood, Recording, Goal, RepertoireItem, GoalStatus } from '../types';
import { Modal } from '../components/Modal';
import { MOOD_OPTIONS } from '../constants';
import { TagInput } from '../components/TagInput';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { UploadProgress } from '../components/UploadProgress';
import { supabase } from '../services/supabase';
import { compressVideo, generateVideoThumbnail, compressImage, formatFileSize } from '../utils/mediaUtils';
import { getAccuracyLabel, getScoreColor, formatTime } from '../utils/cagedUtils';


const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '😊',
    [Mood.Good]: '🙂',
    [Mood.Okay]: '😐',
    [Mood.Challenging]: '😕',
    [Mood.Frustrated]: '😠',
};

// Filter types
type FilterType = 'all' | 'practice' | 'caged' | 'with-videos' | Mood;

interface FilterPillProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
            active 
                ? 'bg-primary text-white' 
                : 'bg-surface hover:bg-border text-text-secondary hover:text-text-primary'
        }`}
    >
        {children}
    </button>
);

// Combined activity type for unified display
interface ActivityItem {
    id: string;
    type: 'practice' | 'caged';
    date: string;
    data: PracticeSession | CAGEDSession;
}

interface GroupedActivities {
    month: string;
    items: ActivityItem[];
}

export const PracticeLog: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSession, setCurrentSession] = useState<Partial<PracticeSession> | null>(null);
    const [newRecordings, setNewRecordings] = useState<File[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState<FilterType[]>(['all']);
    const [isCompactView, setIsCompactView] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [goalToUpdate, setGoalToUpdate] = useState<Goal | null>(null);
    const [masteryItemsToUpdate, setMasteryItemsToUpdate] = useState<RepertoireItem[]>([]);
    const [uploadProgress, setUploadProgress] = useState<{
        name: string;
        progress: number;
        status: 'uploading' | 'compressing' | 'completed' | 'error';
        error?: string;
        originalSize?: number;
        compressedSize?: number;
    }[]>([]);
    const [isUploading, setIsUploading] = useState(false);


    const repertoireTitles = useMemo(() => state.repertoire.map(r => r.title), [state.repertoire]);
    const allTechniques = useMemo(() => {
        const techniques = state.practiceSessions.flatMap(s => s.techniques);
        return [...new Set(techniques.filter(t => t))];
    }, [state.practiceSessions]);
    
    useEffect(() => {
        const liveSessionData = location.state;
        if (liveSessionData?.topic) {
            const { topic, duration, notes, link, recordings } = liveSessionData;
            
            const isSong = repertoireTitles.includes(topic);
            const newSession: Partial<PracticeSession> = {
                date: new Date().toISOString().split('T')[0],
                duration: duration || 30,
                mood: Mood.Okay,
                songs: isSong ? [topic] : [],
                techniques: !isSong ? [topic] : [],
                techniques: !isSong ? [topic] : [],
                notes: notes || '',
                recordings: recordings || [],
                link: link || ''
            };
            openModal(newSession);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, repertoireTitles]);


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
        
        if (newRecordings.length > 0) {
            setIsUploading(true);
            setUploadProgress(newRecordings.map(file => ({
                name: file.name,
                progress: 0,
                status: 'compressing',
                originalSize: file.size
            })));
        }
        
        // Debug logging
        console.log('Attempting to save session:', currentSession);
        console.log('Current user:', state.user);
        
        // ✅ 1. Check Supabase Auth Context
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('Supabase auth user:', user);
        console.log('Auth error:', authError);
        
        if (!user) {
            console.error('No authenticated user found!');
            alert('Authentication error: Please try refreshing the page and logging in again.');
            return;
        }
        
        // Validate required fields
        if (!currentSession.date || !currentSession.duration || !currentSession.mood) {
            alert('Please fill in all required fields (date, duration, mood)');
            return;
        }
        
        setIsSaving(true);

        try {
            // ✅ 2. Upload new recordings with detailed debugging
            const uploadedRecordings = await Promise.all(
                newRecordings.map(async (file, index) => {
                    const updateProgress = (progress: number, status: typeof uploadProgress[0]['status'], error?: string) => {
                        setUploadProgress(prev => prev.map((item, i) => 
                            i === index ? { ...item, progress, status, error } : item
                        ));
                    };

                    try {
                        updateProgress(0, 'compressing');

                        // Compress file if needed
                        let processedFile = file;
                        let thumbnailFile: File | null = null;

                        if (file.type.startsWith('video/')) {
                            // Compress video and generate thumbnail
                            console.log(`Compressing video: ${file.name} (${formatFileSize(file.size)})`);
                            processedFile = await compressVideo(file, { 
                                maxWidth: 1280, 
                                maxHeight: 720, 
                                quality: 0.7,
                                maxSizeMB: 25 
                            });
                            
                            // Generate thumbnail
                            thumbnailFile = await generateVideoThumbnail(file);
                            
                            console.log(`Video compressed: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)}`);
                        } else if (file.type.startsWith('image/')) {
                            // Compress image
                            console.log(`Compressing image: ${file.name} (${formatFileSize(file.size)})`);
                            processedFile = await compressImage(file, {
                                maxWidth: 1920,
                                maxHeight: 1080,
                                quality: 0.8,
                                maxSizeMB: 5
                            });
                            console.log(`Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)}`);
                        }

                        // Update progress state with compression results
                        setUploadProgress(prev => prev.map((item, i) => 
                            i === index ? { 
                                ...item, 
                                compressedSize: processedFile.size,
                                status: 'uploading'
                            } : item
                        ));

                        // ✅ 3. Check file size and type
                        console.log('File details:', {
                            name: processedFile.name,
                            originalSize: file.size,
                            compressedSize: processedFile.size,
                            type: processedFile.type,
                            sizeInMB: (processedFile.size / 1024 / 1024).toFixed(2)
                        });
                    
                        if (processedFile.size > 50 * 1024 * 1024) { // 50MB limit
                            throw new Error(`File ${processedFile.name} is too large (${(processedFile.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 50MB.`);
                        }
                    
                        const fileName = `${Date.now()}-${processedFile.name}`;
                        // ✅ 4. Ensure path matches policy (auth.uid()/filename)
                        const filePath = `${user.id}/${fileName}`;
                    
                        console.log('Upload details:', {
                            bucket: 'recordings',
                            filePath: filePath,
                            userIdFromAuth: user.id,
                            userIdFromState: state.user?.uid,
                            matches: user.id === state.user?.uid
                        });
                    
                        // Upload main file with progress tracking
                        const { data, error } = await supabase.storage
                            .from('recordings')
                            .upload(filePath, processedFile, {
                                cacheControl: '3600',
                                upsert: false,
                            });
                    
                        if (error) {
                            // ✅ 5. Detailed error logging
                            console.error('Storage upload error details:', {
                                message: error.message,
                                error: error,
                                bucket: 'recordings',
                                filePath: filePath,
                                fileName: processedFile.name,
                                fileSize: processedFile.size,
                                userId: user.id
                            });
                            throw error;
                        }
                    
                        updateProgress(75, 'uploading');
                    
                        console.log('Upload successful:', data);
                    
                        const { data: { publicUrl } } = supabase.storage
                            .from('recordings')
                            .getPublicUrl(filePath);
                    
                        console.log('Public URL generated:', publicUrl);

                        // Upload thumbnail if we have one
                        let thumbnailUrl: string | undefined;
                        if (thumbnailFile) {
                            const thumbPath = `${user.id}/thumbs/${Date.now()}-${thumbnailFile.name}`;
                            const { data: thumbData, error: thumbError } = await supabase.storage
                                .from('recordings')
                                .upload(thumbPath, thumbnailFile);
                            
                            if (!thumbError) {
                                const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
                                    .from('recordings')
                                    .getPublicUrl(thumbPath);
                                thumbnailUrl = thumbPublicUrl;
                            }
                        }

                        updateProgress(100, 'completed');
                    
                        const type: 'audio' | 'video' = processedFile.type.startsWith('audio') ? 'audio' : 'video';
                        return {
                            id: filePath,
                            name: file.name, // Keep original name for display
                            type,
                            url: publicUrl,
                            thumbnailUrl,
                            originalSize: file.size,
                            compressedSize: processedFile.size
                        };
                    } catch (error) {
                        console.error(`Error processing file ${file.name}:`, error);
                        updateProgress(0, 'error', error instanceof Error ? error.message : 'Unknown error');
                        throw error;
                    }
                })
            );

            // Wait a moment to show completion
            await new Promise(resolve => setTimeout(resolve, 1000));
            setIsUploading(false);
            setUploadProgress([]);

            console.log('All recordings processed successfully:', uploadedRecordings);

            const sessionData = {
                user_id: user.id, // Use the authenticated user ID
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
            
            console.log('Final sessionData payload for Supabase:', sessionData);
            
            if (currentSession.id) {
                const { error } = await supabase
                    .from('practice_sessions')
                    .update(sessionData)
                    .eq('id', currentSession.id);
                
                if (error) {
                    console.error('Database update error:', error);
                    throw error;
                }
            } else {
                const { error } = await supabase
                    .from('practice_sessions')
                    .insert([sessionData]);
                
                if (error) {
                    console.error('Database insert error:', error);
                    throw error;
                }
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

            // Refresh data to show the new session immediately
            await refreshData();

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
            setIsUploading(false);
            setUploadProgress([]);
            
            // More detailed error message
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                alert(`Failed to save session: ${error.message}\n\nCheck the browser console for more details.`);
            } else {
                console.error('Unknown error:', error);
                alert('Failed to save session due to an unknown error. Check the browser console for details.');
            }
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
                
                // Refresh data to update the UI immediately
                await refreshData();
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

    // Generate summary statistics
    const summaryStats = useMemo(() => {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const today = new Date().toDateString();
        
        // Calculate streak (consecutive days with practice)
        const sortedDates = [...new Set([
            ...state.practiceSessions.map(s => s.date),
            ...state.cagedSessions.map(s => s.sessionDate)
        ])].sort().reverse();
        
        let streak = 0;
        let currentDate = new Date();
        for (const dateStr of sortedDates) {
            const sessionDate = new Date(dateStr + 'T00:00:00');
            const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (24 * 60 * 60 * 1000));
            
            if (daysDiff === streak) {
                streak++;
                currentDate = sessionDate;
            } else {
                break;
            }
        }
        
        // This week's practice time
        const thisWeekMinutes = state.practiceSessions
            .filter(s => new Date(s.date) >= oneWeekAgo)
            .reduce((sum, s) => sum + s.duration, 0);
        
        // Average mood
        const recentSessions = state.practiceSessions.filter(s => new Date(s.date) >= oneWeekAgo);
        const avgMoodValue = recentSessions.length > 0 
            ? recentSessions.reduce((sum, s) => {
                const moodValues = { [Mood.Frustrated]: 1, [Mood.Challenging]: 2, [Mood.Okay]: 3, [Mood.Good]: 4, [Mood.Excellent]: 5 };
                return sum + moodValues[s.mood];
            }, 0) / recentSessions.length
            : 3;
        
        const avgMoodIcon = avgMoodValue >= 4.5 ? '😊' : 
                          avgMoodValue >= 3.5 ? '🙂' : 
                          avgMoodValue >= 2.5 ? '😐' : 
                          avgMoodValue >= 1.5 ? '😕' : '😠';
        
        // CAGED average score
        const recentCagedSessions = state.cagedSessions.filter(s => new Date(s.sessionDate) >= oneWeekAgo);
        const avgCAGEDScore = recentCagedSessions.length > 0 
            ? Math.round(recentCagedSessions.reduce((sum, s) => sum + s.score, 0) / recentCagedSessions.length)
            : null;
        
        return {
            streak,
            thisWeekMinutes,
            avgMoodIcon,
            avgCAGEDScore
        };
    }, [state.practiceSessions, state.cagedSessions]);

    // Combine, filter, and group activities
    const { allActivities, groupedActivities } = useMemo((): { allActivities: ActivityItem[], groupedActivities: GroupedActivities[] } => {
        const practiceActivities: ActivityItem[] = state.practiceSessions
            .map(session => ({
                id: session.id,
                type: 'practice' as const,
                date: session.date,
                data: session
            }));

        const cagedActivities: ActivityItem[] = state.cagedSessions
            .map(session => ({
                id: session.id,
                type: 'caged' as const,
                date: session.sessionDate,
                data: session
            }));

        let combined = [...practiceActivities, ...cagedActivities]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Apply search filter
        if (searchTerm) {
            combined = combined.filter(activity => {
                if (activity.type === 'practice') {
                    const session = activity.data as PracticeSession;
                    return session.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           session.songs.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           session.techniques.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
                } else {
                    const session = activity.data as CAGEDSession;
                    return session.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           session.shapes.some(shape => shape.toLowerCase().includes(searchTerm.toLowerCase()));
                }
            });
        }
        
        // Apply type filters
        if (!activeFilters.includes('all')) {
            combined = combined.filter(activity => {
                if (activeFilters.includes('practice') && activity.type === 'practice') return true;
                if (activeFilters.includes('caged') && activity.type === 'caged') return true;
                if (activeFilters.includes('with-videos') && activity.type === 'practice') {
                    const session = activity.data as PracticeSession;
                    return session.recordings.some(r => r.type === 'video');
                }
                if (activity.type === 'practice') {
                    const session = activity.data as PracticeSession;
                    return activeFilters.includes(session.mood);
                }
                return false;
            });
        }
        
        // Group by month
        const grouped: GroupedActivities[] = [];
        const monthGroups = new Map<string, ActivityItem[]>();
        
        combined.forEach(activity => {
            const date = new Date(activity.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            
            if (!monthGroups.has(monthKey)) {
                monthGroups.set(monthKey, []);
                grouped.push({ month: monthLabel, items: [] });
            }
            monthGroups.get(monthKey)!.push(activity);
        });
        
        // Fill in the items for each group
        Array.from(monthGroups.entries()).forEach(([monthKey, items]) => {
            const group = grouped.find(g => {
                const date = new Date(items[0].date);
                const expectedMonth = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                return g.month === expectedMonth;
            });
            if (group) {
                group.items = items;
            }
        });
        
        return { allActivities: combined, groupedActivities: grouped };
    }, [state.practiceSessions, state.cagedSessions, searchTerm, activeFilters]);

    const toggleFilter = (filter: FilterType) => {
        if (filter === 'all') {
            setActiveFilters(['all']);
        } else {
            setActiveFilters(prev => {
                const newFilters = prev.filter(f => f !== 'all');
                if (newFilters.includes(filter)) {
                    const remaining = newFilters.filter(f => f !== filter);
                    return remaining.length === 0 ? ['all'] : remaining;
                } else {
                    return [...newFilters, filter];
                }
            });
        }
    };

    const toggleRowExpansion = (activityId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(activityId)) {
                newSet.delete(activityId);
            } else {
                newSet.add(activityId);
            }
            return newSet;
        });
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Practice Log</h1>
                <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                    + Log Session
                </button>
            </div>
            
            {/* Summary Statistics Bar */}
            <div className="bg-surface p-4 rounded-lg mb-6">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center space-x-2" title="Consecutive days with practice">
                        <span className="text-2xl">🗓️</span>
                        <div>
                            <div className="font-bold text-lg">{summaryStats.streak}d</div>
                            <div className="text-xs text-text-secondary">Streak</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2" title="Total practice time this week">
                        <span className="text-2xl">⏱️</span>
                        <div>
                            <div className="font-bold text-lg">{summaryStats.thisWeekMinutes}m</div>
                            <div className="text-xs text-text-secondary">This Week</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2" title="Average mood this week">
                        <span className="text-2xl">⭐</span>
                        <div>
                            <div className="font-bold text-lg">{summaryStats.avgMoodIcon}</div>
                            <div className="text-xs text-text-secondary">Avg Mood</div>
                        </div>
                    </div>
                    {summaryStats.avgCAGEDScore && (
                        <div className="flex items-center space-x-2" title="Average CAGED score this week">
                            <span className="text-2xl">🎯</span>
                            <div>
                                <div className="font-bold text-lg">{summaryStats.avgCAGEDScore}/100</div>
                                <div className="text-xs text-text-secondary">CAGED Avg</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Search and Filters */}
            <div className="space-y-4 mb-6">
                <input
                    type="text"
                    placeholder="Search sessions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface p-2 rounded-md border border-border"
                />
                
                <div className="flex flex-wrap items-center gap-2">
                    <FilterPill active={activeFilters.includes('all')} onClick={() => toggleFilter('all')}>
                        All
                    </FilterPill>
                    <FilterPill active={activeFilters.includes('practice')} onClick={() => toggleFilter('practice')}>
                        Practice Sessions
                    </FilterPill>
                    <FilterPill active={activeFilters.includes('caged')} onClick={() => toggleFilter('caged')}>
                        CAGED
                    </FilterPill>
                    <FilterPill active={activeFilters.includes('with-videos')} onClick={() => toggleFilter('with-videos')}>
                        With Videos
                    </FilterPill>
                    <FilterPill active={activeFilters.includes(Mood.Excellent)} onClick={() => toggleFilter(Mood.Excellent)}>
                        😊 Excellent
                    </FilterPill>
                    <FilterPill active={activeFilters.includes(Mood.Good)} onClick={() => toggleFilter(Mood.Good)}>
                        🙂 Good
                    </FilterPill>
                    <FilterPill active={activeFilters.includes(Mood.Okay)} onClick={() => toggleFilter(Mood.Okay)}>
                        😐 Okay
                    </FilterPill>
                    
                    <div className="ml-auto">
                        <button
                            onClick={() => setIsCompactView(!isCompactView)}
                            className="px-3 py-1 bg-surface hover:bg-border rounded-md text-sm transition-colors"
                        >
                            {isCompactView ? 'Detailed View' : 'Compact View'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Activities Display */}
            {isCompactView ? (
                <div className="bg-surface rounded-lg overflow-hidden">
                    {/* Compact Table Header */}
                    <div className="bg-background px-4 py-3 border-b border-border">
                        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-text-secondary">
                            <div className="col-span-2">Date</div>
                            <div className="col-span-1">Dur</div>
                            <div className="col-span-1">Mood</div>
                            <div className="col-span-4">Content</div>
                            <div className="col-span-2">Score</div>
                            <div className="col-span-2"></div>
                        </div>
                    </div>
                    
                    {/* Compact Rows */}
                    <div className="max-h-96 overflow-y-auto">
                        {allActivities.map(activity => {
                            const isExpanded = expandedRows.has(activity.id);
                            return (
                                <div key={activity.id} className="border-b border-border last:border-b-0">
                                    {/* Compact Row */}
                                    <div className="px-4 py-3 hover:bg-background/50 transition-colors">
                                        <div className="grid grid-cols-12 gap-4 items-center text-sm">
                                            <div className="col-span-2 font-medium">
                                                {new Date(activity.date).toLocaleDateString('en-CA')}
                                            </div>
                                            
                                            {activity.type === 'practice' ? (
                                                <>
                                                    <div className="col-span-1">{(activity.data as PracticeSession).duration}m</div>
                                                    <div className="col-span-1">{moodIcons[(activity.data as PracticeSession).mood]}</div>
                                                    <div className="col-span-4 truncate">
                                                        <div className="flex gap-1 flex-wrap">
                                                            {(activity.data as PracticeSession).songs.slice(0, 2).map(s => (
                                                                <span key={s} className="bg-blue-500/20 text-blue-300 px-1 rounded text-xs">{s}</span>
                                                            ))}
                                                            {(activity.data as PracticeSession).techniques.slice(0, 2).map(t => (
                                                                <span key={t} className="bg-indigo-500/20 text-indigo-300 px-1 rounded text-xs">{t}</span>
                                                            ))}
                                                            {((activity.data as PracticeSession).songs.length + (activity.data as PracticeSession).techniques.length) > 4 && (
                                                                <span className="text-text-secondary text-xs">+{((activity.data as PracticeSession).songs.length + (activity.data as PracticeSession).techniques.length) - 4} more</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        {(activity.data as PracticeSession).recordings.length > 0 && (
                                                            <span className="text-xs text-text-secondary">📹 {(activity.data as PracticeSession).recordings.length} files</span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="col-span-1">{formatTime((activity.data as CAGEDSession).timeSeconds)}</div>
                                                    <div className="col-span-1">🎯</div>
                                                    <div className="col-span-4">
                                                        <div className="flex gap-1">
                                                            {(activity.data as CAGEDSession).shapes.map(shape => (
                                                                <span key={shape} className="bg-primary/20 text-primary px-1 rounded text-xs">{shape}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className={`font-bold ${getScoreColor((activity.data as CAGEDSession).score)}`}>
                                                            CAGED {(activity.data as CAGEDSession).score}/100
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            
                                            <div className="col-span-2 flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => toggleRowExpansion(activity.id)}
                                                    className="p-1 hover:bg-border rounded transition-colors"
                                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                                >
                                                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                    </svg>
                                                </button>
                                                
                                                {activity.type === 'practice' && (
                                                    <div className="opacity-0 group-hover:opacity-100 flex space-x-1 transition-opacity">
                                                        <button
                                                            onClick={() => openModal(activity.data as PracticeSession)}
                                                            className="p-1 hover:bg-border rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(activity.data as PracticeSession)}
                                                            className="p-1 hover:bg-border rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                )}
                                                <Link to={`/progression?focus=${encodeURIComponent(session.songs[0] || session.techniques[0] || 'session')}`} className="text-secondary hover:text-indigo-300" title="View progression">📊</Link>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 py-3 bg-background/30 border-t border-border">
                                            {activity.type === 'practice' ? (
                                                <div className="space-y-3">
                                                    {(activity.data as PracticeSession).notes && (
                                                        <p className="text-text-primary whitespace-pre-wrap">{(activity.data as PracticeSession).notes}</p>
                                                    )}
                                                    
                                                    {(activity.data as PracticeSession).recordings.length > 0 && (
                                                        <div>
                                                            <h4 className="font-semibold text-text-secondary text-sm mb-2">Recordings:</h4>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                                {(activity.data as PracticeSession).recordings.map(rec => (
                                                                    <div key={rec.id} className="space-y-2">
                                                                        <p className="text-xs text-text-primary truncate">{rec.name}</p>
                                                                        {rec.type === 'video' && rec.thumbnailUrl ? (
                                                                            <img 
                                                                                src={rec.thumbnailUrl} 
                                                                                alt={`${rec.name} thumbnail`}
                                                                                className="w-full h-16 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                                                                                onClick={() => {
                                                                                    const video = document.createElement('video');
                                                                                    video.src = rec.url;
                                                                                    video.controls = true;
                                                                                    video.className = 'max-w-full max-h-96';
                                                                                    
                                                                                    const modal = document.createElement('div');
                                                                                    modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4';
                                                                                    modal.onclick = () => modal.remove();
                                                                                    modal.appendChild(video);
                                                                                    document.body.appendChild(modal);
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <div className="w-full h-16 bg-surface rounded border border-border flex items-center justify-center">
                                                                                {rec.type === 'audio' ? '🎵' : '📹'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    {(activity.data as CAGEDSession).notes && (
                                                        <p className="text-text-primary text-sm">{(activity.data as CAGEDSession).notes}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Detailed View with Monthly Groups */
                <div className="space-y-8">
                    {groupedActivities.map(group => (
                        <div key={group.month}>
                            {/* Sticky Month Header */}
                            <div className="sticky top-0 bg-background border-b border-border px-4 py-2 mb-4 z-10">
                                <h2 className="text-xl font-bold text-text-primary">{group.month}</h2>
                            </div>
                            
                            {/* Grid Layout for Older Entries */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {group.items.map(activity => (
                                    <div key={activity.id} className="bg-surface p-4 rounded-lg group relative">
                                        {activity.type === 'practice' ? (
                                            <>
                                                {/* Hover Actions */}
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex space-x-2 transition-opacity">
                                                    <button
                                                        onClick={() => openModal(activity.data as PracticeSession)}
                                                        className="p-2 hover:bg-border rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(activity.data as PracticeSession)}
                                                        className="p-2 hover:bg-border rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                                
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-lg font-semibold">{new Date(activity.date).toLocaleDateString('en-CA')} - {(activity.data as PracticeSession).duration} min</p>
                                                        <p className="text-text-secondary">{moodIcons[(activity.data as PracticeSession).mood]} {(activity.data as PracticeSession).mood}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {(activity.data as PracticeSession).notes && (
                                                        <p className="text-text-primary whitespace-pre-wrap">{(activity.data as PracticeSession).notes}</p>
                                                    )}
                                                    
                                                    <div className="flex flex-wrap gap-2 text-sm">
                                                        {(activity.data as PracticeSession).songs.map(s => (
                                                            <Link to={`/progression?focus=${encodeURIComponent(s)}`} key={s} className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full hover:bg-blue-500/40 transition-colors">{s}</Link>
                                                        ))}
                                                        {(activity.data as PracticeSession).techniques.map(t => (
                                                            <Link to={`/progression?focus=${encodeURIComponent(t)}`} key={t} className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full hover:bg-indigo-500/40 transition-colors">{t}</Link>
                                                        ))}
                                                        {(activity.data as PracticeSession).tags.map(t => (
                                                            <span key={t} className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full">{t}</span>
                                                        ))}
                                                    </div>
                                                    
                                                    {(activity.data as PracticeSession).recordings.length > 0 && (
                                                        <div>
                                                            <h4 className="font-semibold text-text-secondary text-sm mb-2">Recordings:</h4>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {(activity.data as PracticeSession).recordings.map(rec => (
                                                                    <div key={rec.id} className="space-y-1">
                                                                        <p className="text-xs text-text-primary truncate">{rec.name}</p>
                                                                        
                                                                        {rec.type === 'video' && rec.thumbnailUrl ? (
                                                                            <img 
                                                                                src={rec.thumbnailUrl} 
                                                                                alt={`${rec.name} thumbnail`}
                                                                                className="w-full h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                                                                                onClick={() => {
                                                                                    const video = document.createElement('video');
                                                                                    video.src = rec.url;
                                                                                    video.controls = true;
                                                                                    video.className = 'max-w-full max-h-96';
                                                                                    
                                                                                    const modal = document.createElement('div');
                                                                                    modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4';
                                                                                    modal.onclick = () => modal.remove();
                                                                                    modal.appendChild(video);
                                                                                    document.body.appendChild(modal);
                                                                                }}
                                                                            />
                                                                        ) : rec.type === 'audio' ? (
                                                                            <audio controls src={rec.url} className="w-full h-8"></audio>
                                                                        ) : (
                                                                            <video controls src={rec.url} className="w-full max-h-32 rounded-md border border-border"></video>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {/* Hover Actions for CAGED */}
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex space-x-2 transition-opacity">
                                                    <Link to="/tools/caged" className="p-2 hover:bg-border rounded transition-colors" title="View in Explorer">
                                                        📊
                                                    </Link>
                                                </div>
                                                
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3 mb-2">
                                                            <h3 className="text-lg font-semibold">
                                                                {new Date(activity.date).toLocaleDateString('en-CA')} - CAGED Session
                                                            </h3>
                                                            <div className={`text-lg font-bold ${getScoreColor((activity.data as CAGEDSession).score)}`}>
                                                                {(activity.data as CAGEDSession).score}/100
                                                            </div>
                                                            <div className="text-text-secondary">
                                                                {formatTime((activity.data as CAGEDSession).timeSeconds)}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center space-x-4 mb-2">
                                                            <div className="flex space-x-1">
                                                                <span className="text-sm text-text-secondary">Shapes:</span>
                                                                {(activity.data as CAGEDSession).shapes.map(shape => (
                                                                    <span key={shape} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">
                                                                        {shape}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <div className="text-sm text-text-secondary">
                                                                {getAccuracyLabel((activity.data as CAGEDSession).accuracy)}
                                                            </div>
                                                        </div>

                                                        {(activity.data as CAGEDSession).notes && (
                                                            <p className="text-text-primary text-sm">{(activity.data as CAGEDSession).notes}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {allActivities.length === 0 && searchTerm && (
                <div className="text-center p-8 bg-surface rounded-lg">
                    <p className="text-text-secondary">No sessions found matching "{searchTerm}"</p>
                </div>
            )}

            {allActivities.length === 0 && !searchTerm && (
                <div className="text-center p-8 bg-surface rounded-lg">
                    <h2 className="text-xl font-bold mb-2">No Practice Sessions Yet</h2>
                    <p className="text-text-secondary">Start logging your practice to see your progress!</p>
                </div>
            )}

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
                            {newRecordings.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {newRecordings.map((file, index) => (
                                        <div key={index} className="text-sm text-text-secondary flex justify-between items-center">
                                            <span>{file.name}</span>
                                            <span className="text-xs">{formatFileSize(file.size)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button onClick={closeModal} disabled={isSaving} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50">Cancel</button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving || !currentSession?.date || !currentSession?.duration || !currentSession?.mood} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
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

            {isUploading && (
                <UploadProgress 
                    files={uploadProgress}
                    onCancel={() => {
                        setIsUploading(false);
                        setUploadProgress([]);
                    }}
                />
            )}
        </div>
    );
};