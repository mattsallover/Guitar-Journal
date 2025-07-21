import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { CAGEDSession } from '../../types';
import { Modal } from '../../components/Modal';
import { supabase } from '../../services/supabase';
import { computeCAGEDScore, getAccuracyLabel, getScoreColor, formatTime } from '../../utils/cagedUtils';
import { compressVideo, compressImage, formatFileSize } from '../../utils/mediaUtils';

export const CAGEDSessions: React.FC = () => {
    const { state } = useAppContext();
    const [sessions, setSessions] = useState<CAGEDSession[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSession, setCurrentSession] = useState<Partial<CAGEDSession> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);

    const SHAPE_OPTIONS = ['C', 'A', 'G', 'E', 'D'];
    const ACCURACY_OPTIONS = [
        { value: 1, label: 'Poor - Many mistakes' },
        { value: 2, label: 'Fair - Some mistakes' },
        { value: 3, label: 'Good - Few mistakes' },
        { value: 4, label: 'Very Good - Rare mistakes' },
        { value: 5, label: 'Perfect - No mistakes' }
    ];

    useEffect(() => {
        if (state.user) {
            fetchSessions();
        }
    }, [state.user]);

    const fetchSessions = async () => {
        if (!state.user) return;
        
        try {
            const { data, error } = await supabase
                .from('caged_sessions')
                .select('*')
                .eq('user_id', state.user.uid)
                .order('session_date', { ascending: false });

            if (error) throw error;

            const mappedSessions: CAGEDSession[] = data.map(row => ({
                id: row.id,
                userId: row.user_id,
                sessionDate: row.session_date,
                shapes: row.shapes,
                accuracy: row.accuracy,
                timeSeconds: row.time_seconds,
                score: row.score,
                notes: row.notes || '',
                recording: row.recording || '',
                createdAt: row.created_at,
            }));

            setSessions(mappedSessions);
        } catch (error) {
            console.error('Error fetching CAGED sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (session: Partial<CAGEDSession> | null = null) => {
        setCurrentSession(session || {
            sessionDate: new Date().toISOString().split('T')[0],
            shapes: [],
            accuracy: 3,
            timeSeconds: 0,
            notes: ''
        });
        setSelectedFile(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentSession(null);
        setSelectedFile(null);
    };

    const handleSave = async () => {
        if (!currentSession || !state.user || !currentSession.shapes || currentSession.shapes.length === 0) {
            alert('Please select at least one CAGED shape');
            return;
        }

        setIsSaving(true);
        setIsUploading(!!selectedFile);

        try {
            // Upload recording if provided
            let recordingPath = currentSession.recording || '';
            
            if (selectedFile) {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) throw new Error('Authentication error');

                // Compress file if needed
                let processedFile = selectedFile;
                if (selectedFile.type.startsWith('video/')) {
                    processedFile = await compressVideo(selectedFile, { 
                        maxWidth: 1280, 
                        maxHeight: 720, 
                        quality: 0.7,
                        maxSizeMB: 25 
                    });
                } else if (selectedFile.type.startsWith('image/')) {
                    processedFile = await compressImage(selectedFile, {
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.8,
                        maxSizeMB: 5
                    });
                }

                const fileName = `caged-${Date.now()}-${processedFile.name}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('recordings')
                    .upload(filePath, processedFile);

                if (uploadError) throw uploadError;
                recordingPath = filePath;
            }

            // Calculate score
            const score = computeCAGEDScore({
                shapes: currentSession.shapes,
                accuracy: currentSession.accuracy || 3,
                time_seconds: currentSession.timeSeconds || 0
            });

            const sessionData = {
                user_id: state.user.uid,
                session_date: currentSession.sessionDate,
                shapes: currentSession.shapes,
                accuracy: currentSession.accuracy || 3,
                time_seconds: currentSession.timeSeconds || 0,
                score,
                notes: currentSession.notes || '',
                recording: recordingPath
            };

            if (currentSession.id) {
                const { error } = await supabase
                    .from('caged_sessions')
                    .update(sessionData)
                    .eq('id', currentSession.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('caged_sessions')
                    .insert([sessionData]);
                if (error) throw error;
            }

            await fetchSessions();
            closeModal();
        } catch (error) {
            console.error('Error saving CAGED session:', error);
            alert('Failed to save session. Please try again.');
        } finally {
            setIsSaving(false);
            setIsUploading(false);
        }
    };

    const handleDelete = async (session: CAGEDSession) => {
        if (!window.confirm('Are you sure you want to delete this CAGED session?')) return;

        try {
            // Delete recording if exists
            if (session.recording) {
                await supabase.storage
                    .from('recordings')
                    .remove([session.recording]);
            }

            const { error } = await supabase
                .from('caged_sessions')
                .delete()
                .eq('id', session.id);

            if (error) throw error;
            await fetchSessions();
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete session. Please try again.');
        }
    };

    const toggleShape = (shape: string) => {
        if (!currentSession) return;
        
        const currentShapes = currentSession.shapes || [];
        const newShapes = currentShapes.includes(shape)
            ? currentShapes.filter(s => s !== shape)
            : [...currentShapes, shape];
        
        setCurrentSession({ ...currentSession, shapes: newShapes });
    };

    const averageStats = sessions.length > 0 ? {
        avgScore: Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length),
        avgTime: Math.round(sessions.reduce((sum, s) => sum + s.timeSeconds, 0) / sessions.length),
        bestScore: Math.max(...sessions.map(s => s.score)),
        bestTime: Math.min(...sessions.map(s => s.timeSeconds))
    } : null;

    if (loading) {
        return <div className="p-8 text-center">Loading CAGED sessions...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">CAGED Sessions</h1>
                <button 
                    onClick={() => openModal()} 
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md"
                >
                    + Log Session
                </button>
            </div>

            {/* Stats Overview */}
            {averageStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-primary">{averageStats.avgScore}</div>
                        <div className="text-sm text-text-secondary">Avg Score</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-primary">{formatTime(averageStats.avgTime)}</div>
                        <div className="text-sm text-text-secondary">Avg Time</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{averageStats.bestScore}</div>
                        <div className="text-sm text-text-secondary">Best Score</div>
                    </div>
                    <div className="bg-surface p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-400">{formatTime(averageStats.bestTime)}</div>
                        <div className="text-sm text-text-secondary">Best Time</div>
                    </div>
                </div>
            )}

            {/* Sessions List */}
            <div className="space-y-4">
                {sessions.length === 0 ? (
                    <div className="bg-surface p-8 rounded-lg text-center">
                        <h2 className="text-xl font-bold mb-2">No CAGED Sessions Yet</h2>
                        <p className="text-text-secondary mb-4">Start tracking your CAGED system practice to see progress over time!</p>
                        <button 
                            onClick={() => openModal()} 
                            className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md"
                        >
                            Log Your First Session
                        </button>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div key={session.id} className="bg-surface p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-4 mb-2">
                                        <h3 className="text-lg font-semibold">
                                            {new Date(session.sessionDate).toLocaleDateString()}
                                        </h3>
                                        <div className={`text-xl font-bold ${getScoreColor(session.score)}`}>
                                            {session.score}/100
                                        </div>
                                        <div className="text-text-secondary">
                                            {formatTime(session.timeSeconds)}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 mb-2">
                                        <div className="flex space-x-1">
                                            <span className="text-sm text-text-secondary">Shapes:</span>
                                            {session.shapes.map(shape => (
                                                <span key={shape} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">
                                                    {shape}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="text-sm text-text-secondary">
                                            Accuracy: {getAccuracyLabel(session.accuracy)}
                                        </div>
                                    </div>

                                    {session.notes && (
                                        <p className="text-text-primary text-sm mb-2">{session.notes}</p>
                                    )}

                                    {session.recording && (
                                        <div className="mt-2">
                                            <p className="text-xs text-text-secondary mb-1">Recording:</p>
                                            {session.recording.includes('.mp4') || session.recording.includes('.webm') ? (
                                                <video 
                                                    controls 
                                                    src={supabase.storage.from('recordings').getPublicUrl(session.recording).data.publicUrl}
                                                    className="max-w-xs rounded border border-border"
                                                />
                                            ) : (
                                                <audio 
                                                    controls 
                                                    src={supabase.storage.from('recordings').getPublicUrl(session.recording).data.publicUrl}
                                                    className="w-full h-8"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex space-x-2 ml-4">
                                    <button 
                                        onClick={() => openModal(session)} 
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(session)} 
                                        className="text-sm text-red-400 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && currentSession && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={closeModal} 
                    title={currentSession.id ? "Edit CAGED Session" : "Log New CAGED Session"}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Session Date</label>
                            <input 
                                type="date" 
                                value={currentSession.sessionDate} 
                                onChange={e => setCurrentSession({ ...currentSession, sessionDate: e.target.value })}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                CAGED Shapes Practiced
                            </label>
                            <div className="flex space-x-2">
                                {SHAPE_OPTIONS.map(shape => (
                                    <button
                                        key={shape}
                                        type="button"
                                        onClick={() => toggleShape(shape)}
                                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                                            (currentSession.shapes || []).includes(shape)
                                                ? 'bg-primary text-white'
                                                : 'bg-surface hover:bg-border text-text-secondary'
                                        }`}
                                    >
                                        {shape}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-text-secondary mt-1">
                                Select all CAGED shapes you practiced in this session
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Time to Complete (seconds)
                            </label>
                            <input 
                                type="number" 
                                min="0"
                                value={currentSession.timeSeconds || 0} 
                                onChange={e => setCurrentSession({ ...currentSession, timeSeconds: parseInt(e.target.value) || 0 })}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                            <p className="text-xs text-text-secondary mt-1">
                                How many seconds to complete all selected shapes once through
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Accuracy ({currentSession.accuracy || 3}/5)
                            </label>
                            <select 
                                value={currentSession.accuracy || 3} 
                                onChange={e => setCurrentSession({ ...currentSession, accuracy: parseInt(e.target.value) })}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            >
                                {ACCURACY_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.value} - {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Notes</label>
                            <textarea 
                                value={currentSession.notes || ''} 
                                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })}
                                className="w-full bg-background p-2 rounded-md border border-border h-20"
                                placeholder="Any observations, difficulties, or improvements..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Recording (optional)</label>
                            <input 
                                type="file" 
                                accept="audio/*,video/*" 
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="w-full bg-background p-2 rounded-md border border-border"
                            />
                            {selectedFile && (
                                <p className="text-xs text-text-secondary mt-1">
                                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                </p>
                            )}
                        </div>

                        {/* Score Preview */}
                        {currentSession.shapes && currentSession.shapes.length > 0 && (
                            <div className="bg-background p-3 rounded-md">
                                <p className="text-sm text-text-secondary">Estimated Score:</p>
                                <p className={`text-xl font-bold ${getScoreColor(computeCAGEDScore({
                                    shapes: currentSession.shapes,
                                    accuracy: currentSession.accuracy || 3,
                                    time_seconds: currentSession.timeSeconds || 0
                                }))}`}>
                                    {computeCAGEDScore({
                                        shapes: currentSession.shapes,
                                        accuracy: currentSession.accuracy || 3,
                                        time_seconds: currentSession.timeSeconds || 0
                                    })}/100
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end space-x-4 pt-4">
                            <button 
                                onClick={closeModal} 
                                disabled={isSaving}
                                className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving || !currentSession.shapes?.length}
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
                            >
                                {isSaving ? (isUploading ? 'Uploading...' : 'Saving...') : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};