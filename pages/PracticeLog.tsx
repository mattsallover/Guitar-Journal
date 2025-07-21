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

// Import CAGEDSession type
import type { CAGEDSession } from '../types';

const moodIcons: Record<Mood, string> = {
    [Mood.Excellent]: '😊',
    [Mood.Good]: '🙂',
    [Mood.Okay]: '😐',
    [Mood.Challenging]: '😕',
    [Mood.Frustrated]: '😠',
};

// View types and filter types
type ViewMode = 'cards' | 'compact';
type FilterType = 'all' | 'practice' | 'caged' | 'with-videos' | Mood;

interface FilterPillProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-2 py-1 rounded-full text-xs transition-all hover:scale-105 ${
            active 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-surface hover:bg-border text-text-secondary hover:text-text-primary'
        }`}
    >
        {children}
    </button>
);

// Compact row component
interface CompactRowProps {
    activity: ActivityItem;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

const CompactRow: React.FC<CompactRowProps> = ({ activity, isExpanded, onToggleExpand, onEdit, onDelete }) => {
    const isPractice = activity.type === 'practice';
    const session = activity.data as PracticeSession;
    const cagedSession = activity.data as CAGEDSession;
    
    return (
        <div className="border-b border-border last:border-b-0 hover:bg-background/30 transition-colors">
            {/* Main row */}
            <div className="px-4 py-2 cursor-pointer" onClick={onToggleExpand}>
                <div className="grid grid-cols-12 gap-3 items-center text-sm">
                    {/* Date */}
                    <div className="col-span-2">
                        <div className="font-semibold text-text-primary">
                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-text-secondary">
                            {new Date(activity.date).getFullYear()}
                        </div>
                    </div>
                    
                    {/* Duration & Type */}
                    <div className="col-span-1">
                        {isPractice ? (
                            <span className="font-medium">{session.duration}m</span>
                        ) : (
                            <span className="text-xs text-primary font-medium">CAGED</span>
                        )}
                    </div>
                    
                    {/* Mood/Score */}
                    <div className="col-span-1">
                        {isPractice ? (
                            <span className="text-lg" title={session.mood}>{moodIcons[session.mood]}</span>
                        ) : (
                            <span className={`text-xs font-bold ${getScoreColor(cagedSession.score)}`}>
                                {cagedSession.score}
                            </span>
                        )}
                    </div>
                    
                    {/* Content tags */}
                    <div className="col-span-5">
                        <div className="flex gap-1 flex-wrap">
                            {isPractice ? (
                                <>
                                    {session.songs.slice(0, 2).map(s => (
                                        <span key={s} className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full text-xs">{s}</span>
                                    ))}
                                    {session.techniques.slice(0, 2).map(t => (
                                        <span key={t} className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full text-xs">{t}</span>
                                    ))}
                                    {((session.songs?.length || 0) + (session.techniques?.length || 0)) > 4 && (
                                        <span className="text-text-secondary text-xs">+{((session.songs?.length || 0) + (session.techniques?.length || 0)) - 4}</span>
                                    )}
                                </>
                            ) : (
                                cagedSession.shapes.map(shape => (
                                    <span key={shape} className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-xs">{shape}</span>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Media indicators */}
                    <div className="col-span-2 flex items-center gap-2">
                        {isPractice && session.recordings?.length > 0 && (
                            <div className="flex items-center gap-1">
                                {session.recordings.some(r => r.type === 'video') && <span title="Has video">📹</span>}
                                {session.recordings.some(r => r.type === 'audio') && <span title="Has audio">🎵</span>}
                                <span className="text-xs text-text-secondary">{session.recordings.length}</span>
                            </div>
                        )}
                        {isPractice && session.link && (
                            <span title="Has link">🔗</span>
                        )}
                    </div>
                    
                    {/* Expand arrow */}
                    <div className="col-span-1 text-right">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            </div>
            
            {/* Expanded details */}
            {isExpanded && (
                <div className="px-4 pb-3 bg-background/50">
                    <div className="pt-2 border-t border-border/50">
                        {isPractice ? (
                            <div className="space-y-2">
                                {session.notes && (
                                    <p className="text-sm text-text-primary whitespace-pre-wrap">{session.notes}</p>
                                )}
                                
                                {session.recordings && session.recordings.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-text-secondary mb-2">Media</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {session.recordings.map(rec => (
                                                <div key={rec.id} className="space-y-1">
                                                    <p className="text-xs text-text-primary truncate">{rec.name}</p>
                                                    {rec.type === 'video' ? (
                                                        <video controls src={rec.url} className="w-full h-16 object-cover rounded border border-border"></video>
                                                    ) : (
                                                        <audio controls src={rec.url} className="w-full h-8"></audio>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {session.link && (
                                    <div>
                                        <a href={session.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                                            📎 View linked resource
                                        </a>
                                    </div>
                                )}
                                
                                <div className="flex gap-2 pt-2">
                                    {onEdit && (
                                        <button onClick={onEdit} className="text-xs text-primary hover:underline">✏️ Edit</button>
                                    )}
                                    {onDelete && (
                                        <button onClick={onDelete} className="text-xs text-red-400 hover:underline">🗑️ Delete</button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                                    <div>
                                        <span className="text-text-secondary">Time:</span> {formatTime(cagedSession.timeSeconds)}
                                    </div>
                                    <div>
                                        <span className="text-text-secondary">Accuracy:</span> {getAccuracyLabel(cagedSession.accuracy)}
                                    </div>
                                    <div>
                                        <span className="text-text-secondary">Score:</span> <span className={getScoreColor(cagedSession.score)}>{cagedSession.score}/100</span>
                                    </div>
                                </div>
                                {cagedSession.notes && (
                                    <p className="text-sm text-text-primary">{cagedSession.notes}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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
    const [viewMode, setViewMode] = useState<ViewMode>('compact');
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

    const [filtersCollapsed, setFiltersCollapsed] = useState(true);

    const repertoireTitles = useMemo(() => state.repertoire.map(r => r.title), [state.repertoire]);
    const allTechniques = useMemo(() => {
        const techniques = state.practiceSessions.flatMap(s => s.techniques);
        return [...new Set(techniques.filter(t => t))];
    }, [state.practiceSessions]);
    
    useEffect(() => {
        const liveSessionData = location.state;
        if (liveSessionData?.topic) {
            const { topic, duration, notes, link } = liveSessionData;
            
            const isSong = repertoireTitles.includes(topic);
            const newSession: Partial<PracticeSession> = {
                date: new Date().toISOString().split('T')[0],
                duration: duration || 30,
                mood: Mood.Okay,
                songs: isSong ? [topic] : [],
                techniques: !isSong ? [topic] : [],
                notes: notes || '',
                recordings: [],
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
            {/* Header with actions */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Practice Log</h1>
                <div className="flex items-center gap-3">
                    <div className="flex bg-surface rounded-md p-1">
                        <button
                            onClick={() => setViewMode('compact')}
                            className={`px-3 py-1 rounded text-sm transition-all ${
                                viewMode === 'compact' ? 'bg-primary text-white' : 'hover:bg-border'
                            }`}
                        >
                            📋 List
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-3 py-1 rounded text-sm transition-all ${
                                viewMode === 'cards' ? 'bg-primary text-white' : 'hover:bg-border'
                            }`}
                        >
                            🃏 Cards
                        </button>
                    </div>
                    <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-4 rounded-md transition-all hover:scale-105">
                        + Log Session
                    </button>
                </div>
            </div>
            
            {/* Compact Summary Statistics */}
            <div className="bg-surface/50 p-3 rounded-lg mb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2" title="Consecutive days with practice">
                            <span className="text-lg">🗓️</span>
                            <div>
                                <div className="font-bold text-sm">{summaryStats.streak}d</div>
                                <div className="text-xs text-text-secondary">Streak</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2" title="Total practice time this week">
                            <span className="text-lg">⏱️</span>
                            <div>
                                <div className="font-bold text-sm">{summaryStats.thisWeekMinutes}m</div>
                                <div className="text-xs text-text-secondary">This Week</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2" title="Average mood this week">
                            <span className="text-lg">⭐</span>
                            <div>
                                <div className="font-bold text-sm">{summaryStats.avgMoodIcon}</div>
                                <div className="text-xs text-text-secondary">Avg Mood</div>
                            </div>
                        </div>
                        {summaryStats.avgCAGEDScore && (
                            <div className="flex items-center gap-2" title="Average CAGED score this week">
                                <span className="text-lg">🎯</span>
                                <div>
                                    <div className="font-bold text-sm">{summaryStats.avgCAGEDScore}/100</div>
                                    <div className="text-xs text-text-secondary">CAGED</div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="text-right">
                        <div className="text-sm font-semibold text-text-primary">{allActivities.length} sessions</div>
                        <div className="text-xs text-text-secondary">Total logged</div>
                    </div>
                </div>
            </div>
            
            {/* Sticky Search and Filters */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-4">
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="🔍 Search sessions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface p-3 rounded-md border border-border focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <button
                                onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                            >
                                Filters {activeFilters.filter(f => f !== 'all').length > 0 && `(${activeFilters.filter(f => f !== 'all').length})`} {filtersCollapsed ? '▼' : '▲'}
                            </button>
                        </div>
                        
                        {!filtersCollapsed && (
                            <div className="text-xs text-text-secondary">
                                {allActivities.length} of {[...state.practiceSessions, ...state.cagedSessions].length} sessions
                            </div>
                        )}
                    </div>
                    
                    {!filtersCollapsed && (
                        <div className="flex flex-wrap items-center gap-2">
                            <FilterPill active={activeFilters.includes('all')} onClick={() => toggleFilter('all')}>
                                All
                            </FilterPill>
                            <FilterPill active={activeFilters.includes('practice')} onClick={() => toggleFilter('practice')}>
                                📝 Practice
                            </FilterPill>
                            <FilterPill active={activeFilters.includes('caged')} onClick={() => toggleFilter('caged')}>
                                🎯 CAGED
                            </FilterPill>
                            <FilterPill active={activeFilters.includes('with-videos')} onClick={() => toggleFilter('with-videos')}>
                                📹 Videos
                            </FilterPill>
                            <div className="w-px h-4 bg-border mx-1"></div>
                            <FilterPill active={activeFilters.includes(Mood.Excellent)} onClick={() => toggleFilter(Mood.Excellent)}>
                                😊
                            </FilterPill>
                            <FilterPill active={activeFilters.includes(Mood.Good)} onClick={() => toggleFilter(Mood.Good)}>
                                🙂
                            </FilterPill>
                            <FilterPill active={activeFilters.includes(Mood.Okay)} onClick={() => toggleFilter(Mood.Okay)}>
                                😐
                            </FilterPill>
                            <FilterPill active={activeFilters.includes(Mood.Challenging)} onClick={() => toggleFilter(Mood.Challenging)}>
                                😕
                            </FilterPill>
                            <FilterPill active={activeFilters.includes(Mood.Frustrated)} onClick={() => toggleFilter(Mood.Frustrated)}>
                                😠
                            </FilterPill>
                        </div>
                    )}
                </div>
            </div>

            {/* Content based on view mode */}
            {viewMode === 'compact' ? (
                <div className="bg-surface rounded-lg overflow-hidden">
                    {/* Table header */}
                    <div className="bg-background px-4 py-3 border-b border-border">
                        <div className="grid grid-cols-12 gap-3 text-xs font-medium text-text-secondary uppercase tracking-wider">
                            <div className="col-span-2">Date</div>
                            <div className="col-span-1">Duration</div>
                            <div className="col-span-1">Mood</div>
                            <div className="col-span-5">Content</div>
                            <div className="col-span-2">Media</div>
                            <div className="col-span-1"></div>
                        </div>
                    </div>
                    
                    {/* Compact rows */}
                    <div className="max-h-[70vh] overflow-y-auto">
                        {allActivities.map(activity => (
                            <CompactRow
                                key={activity.id}
                                activity={activity}
                                isExpanded={expandedRows.has(activity.id)}
                                onToggleExpand={() => toggleRowExpansion(activity.id)}
                                onEdit={activity.type === 'practice' ? () => openModal(activity.data as PracticeSession) : undefined}
                                onDelete={activity.type === 'practice' ? () => handleDelete(activity.data as PracticeSession) : undefined}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                /* Cards View - Improved */
                <div className="space-y-6">
                    {groupedActivities.map(group => (
                        <div key={group.month}>
                            <div className="sticky top-20 bg-background/90 backdrop-blur-sm border-b border-border px-2 py-2 mb-4 z-10">
                                <h2 className="text-lg font-bold text-text-primary">{group.month}</h2>
                            </div>
                            
                            {/* Fixed-height card grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.items.map(activity => (
                                    <div key={activity.id} className="bg-surface rounded-lg p-4 group relative h-48 flex flex-col">
                                        {activity.type === 'practice' ? (
                                            <>
                                                {/* Card Header */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-text-primary">
                                                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {(activity.data as PracticeSession).duration}m
                                                        </p>
                                                        <p className="text-sm text-text-secondary flex items-center gap-1">
                                                            {moodIcons[(activity.data as PracticeSession).mood]} {(activity.data as PracticeSession).mood}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Hover Actions */}
                                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                        <button
                                                            onClick={() => openModal(activity.data as PracticeSession)}
                                                            className="p-1 hover:bg-border rounded text-sm"
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(activity.data as PracticeSession)}
                                                            className="p-1 hover:bg-border rounded text-sm"
                                                            title="Delete"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Content Tags */}
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {(activity.data as PracticeSession).songs.slice(0, 3).map(s => (
                                                            <span key={s} className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs">{s}</span>
                                                        ))}
                                                        {(activity.data as PracticeSession).techniques.slice(0, 2).map(t => (
                                                            <span key={t} className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs">{t}</span>
                                                        ))}
                                                    </div>
                                                    
                                                    {(activity.data as PracticeSession).notes && (
                                                        <p className="text-xs text-text-secondary line-clamp-2">
                                                            {(activity.data as PracticeSession).notes}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {/* Media Strip */}
                                                {(activity.data as PracticeSession).recordings && (activity.data as PracticeSession).recordings.length > 0 && (
                                                    <div className="mt-auto">
                                                        <div className="h-12 bg-background rounded border border-border/50 flex items-center justify-center gap-2">
                                                            {(activity.data as PracticeSession).recordings.some(r => r.type === 'video') && (
                                                                <span className="text-lg" title="Has video recordings">📹</span>
                                                            )}
                                                            {(activity.data as PracticeSession).recordings.some(r => r.type === 'audio') && (
                                                                <span className="text-lg" title="Has audio recordings">🎵</span>
                                                            )}
                                                            <span className="text-xs text-text-secondary">
                                                                {(activity.data as PracticeSession).recordings.length} files
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* CAGED Card */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-semibold text-text-primary">
                                                            {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • CAGED
                                                        </h3>
                                                        <div className={`text-lg font-bold ${getScoreColor((activity.data as CAGEDSession).score)}`}>
                                                            {(activity.data as CAGEDSession).score}/100
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1">
                                                    <div className="flex gap-1 mb-2">
                                                        {(activity.data as CAGEDSession).shapes.map(shape => (
                                                            <span key={shape} className="bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                                                                {shape}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="text-xs text-text-secondary">
                                                        {formatTime((activity.data as CAGEDSession).timeSeconds)} • {getAccuracyLabel((activity.data as CAGEDSession).accuracy)}
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
            
            {/* Empty states */}
            {allActivities.length === 0 && searchTerm && (
                <div className="text-center p-12 bg-surface rounded-lg">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold mb-2">No matches found</h3>
                    <p className="text-text-secondary">No sessions found for "{searchTerm}"</p>
                </div>
            )}

            {allActivities.length === 0 && !searchTerm && !activeFilters.some(f => f !== 'all') && (
                <div className="text-center p-12 bg-surface rounded-lg">
                    <div className="text-4xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">Start Your Practice Journey</h3>
                    <p className="text-text-secondary mb-4">Log your first practice session to begin tracking your progress!</p>
                    <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-6 rounded-md transition-all hover:scale-105">
                        + Log Your First Session
                    </button>
                </div>
            )}

            {/* Session Modal */}
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
                            <textarea 
                                value={currentSession.notes} 
                                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })} 
                                placeholder="What did you work on? Any breakthroughs or challenges?"
                                className="w-full bg-background p-3 rounded-md border border-border h-24 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Resource Link</label>
                            <input
                                type="url"
                                placeholder="Link to lesson, sheet music, etc..."
                                value={currentSession.link || ''}
                                onChange={e => setCurrentSession({ ...currentSession, link: e.target.value })}
                                className="w-full bg-background p-3 rounded-md border border-border focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Media Attachments (Audio/Video)</label>
                            <input 
                                type="file" 
                                multiple 
                                accept="audio/*,video/*" 
                                onChange={handleFileChange} 
                                className="w-full bg-background p-3 rounded-md border border-border focus:ring-2 focus:ring-primary focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary-hover file:transition-colors"
                            />
                            {newRecordings.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs font-medium text-text-secondary">Selected files:</p>
                                    {newRecordings.map((file, index) => (
                                        <div key={index} className="flex justify-between items-center bg-background p-2 rounded border border-border/50">
                                            <span className="text-sm font-medium flex items-center gap-2">
                                                {file.type.startsWith('video') ? '📹' : '🎵'}
                                                {file.name}
                                            </span>
                                            <span className="text-xs text-text-secondary">{formatFileSize(file.size)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button onClick={closeModal} disabled={isSaving} className="bg-surface hover:bg-border text-text-primary font-semibold py-2 px-6 rounded-md disabled:opacity-50 transition-all">Cancel</button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving || !currentSession?.date || !currentSession?.duration || !currentSession?.mood} 
                                className="bg-primary hover:bg-primary-hover text-white font-semibold py-2 px-6 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
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