import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PracticeSession, Mood, Recording } from '../types';
import { Modal } from '../components/Modal';
import { TagInput } from '../components/TagInput';
import { MasteryUpdateModal } from '../components/MasteryUpdateModal';
import { GoalUpdateModal } from '../components/GoalUpdateModal';
import { UploadProgress } from '../components/UploadProgress';
import { MOOD_OPTIONS } from '../constants';
import { compressVideo, compressImage, formatFileSize } from '../utils/mediaUtils';
import { supabase } from '../services/supabase';
import * as aiService from '../services/aiService';

const moodIcons: Record<Mood, string> = {
  [Mood.Good]: '🙂', // Only keeping one since we always save as 'Good'
};

export const PracticeLog: React.FC = () => {
  const { state, refreshData } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSession, setCurrentSession] = useState<Partial<PracticeSession> | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgressData, setUploadProgressData] = useState<Array<{
    name: string;
    progress: number;
    status: 'uploading' | 'compressing' | 'completed' | 'error';
    error?: string;
    originalSize?: number;
    compressedSize?: number;
  }>>([]);
  
  // State for tracking expanded sessions
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  
  // AI Insights state
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>('');
  
  // Modal states for updates
  const [showMasteryModal, setShowMasteryModal] = useState(false);
  const [masteryItems, setMasteryItems] = useState<any[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [relatedGoal, setRelatedGoal] = useState<any>(null);

  useEffect(() => {
    // Check if we came from LiveSession with recording data
    if (location.state?.recordings) {
      openModal({
        date: new Date().toISOString().split('T')[0],
        duration: location.state.duration || 30,
        mood: location.state.mood || Mood.Good,
        techniques: location.state.techniques || [],
        songs: location.state.songs || [],
        notes: location.state.notes || '',
        tags: location.state.tags || [],
        recordings: location.state.recordings || [],
        link: location.state.link || ''
      });
      // Clear the location state
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  const openModal = (session: Partial<PracticeSession> | null = null) => {
    setCurrentSession(session || {
      date: new Date().toISOString().split('T')[0],
      duration: 30,
      topics: [], // Combined field for UI
      notes: '',
      recordings: [],
      link: ''
    });
    setSelectedFiles(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentSession(null);
    setSelectedFiles(null);
  };

  const generateAIInsights = async () => {
    if (!state.user) return;
    
    setLoadingInsights(true);
    try {
      const insights = await aiService.analyzePracticeJournalWithContext(
        state.practiceSessions.slice(0, 30), // Last 30 sessions
        state.repertoire,
        state.goals,
        state.noteFinder || []
      );
      setAiInsights(insights);
      setShowInsights(true);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      setAiInsights('Sorry, I encountered an error while analyzing your practice data. Please try again.');
      setShowInsights(true);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleStartLiveSession = () => {
    navigate('/session/live', { state: { topic: 'General Practice' } });
  };

  const uploadFiles = async (files: FileList): Promise<Recording[]> => {
    const recordings: Recording[] = [];
    const fileArray = Array.from(files);
    
    setUploadingFiles(true);
    setUploadProgressData(fileArray.map(file => ({
      name: file.name,
      progress: 0,
      status: 'compressing',
      originalSize: file.size
    })));

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication error');

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        try {
          // Update progress for compression
          setUploadProgressData(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'compressing', progress: 0 } : item
          ));

          // Compress file based on type
          let processedFile = file;
          if (file.type.startsWith('video/')) {
            processedFile = await compressVideo(file, { 
              maxWidth: 1280, 
              maxHeight: 720, 
              quality: 0.7,
              maxSizeMB: 25 
            });
          } else if (file.type.startsWith('image/')) {
            processedFile = await compressImage(file, {
              maxWidth: 1920,
              maxHeight: 1080,
              quality: 0.8,
              maxSizeMB: 5
            });
          }

          // Update progress for upload
          setUploadProgressData(prev => prev.map((item, index) => 
            index === i ? { 
              ...item, 
              status: 'uploading', 
              progress: 50, 
              compressedSize: processedFile.size 
            } : item
          ));

          // Upload to Supabase Storage
          const fileName = `practice-${Date.now()}-${processedFile.name}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, processedFile);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(filePath);

          if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

          const recording: Recording = {
            id: filePath,
            name: file.name,
            type: file.type.startsWith('video/') ? 'video' : 'audio',
            url: urlData.publicUrl,
            originalSize: file.size,
            compressedSize: processedFile.size
          };

          recordings.push(recording);

          // Update progress to completed
          setUploadProgressData(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'completed', progress: 100 } : item
          ));

        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          setUploadProgressData(prev => prev.map((item, index) => 
            index === i ? { 
              ...item, 
              status: 'error', 
              error: 'Upload failed',
              progress: 0 
            } : item
          ));
        }
      }
    } catch (error) {
      console.error('Error during file upload process:', error);
    }

    return recordings;
  };

  const handleSave = async () => {
    if (!currentSession || !state.user) return;
    setIsSaving(true);

    let recordings: Recording[] = [...(currentSession.recordings || [])];

    // Upload new files if any
    if (selectedFiles && selectedFiles.length > 0) {
      try {
        const newRecordings = await uploadFiles(selectedFiles);
        recordings = [...recordings, ...newRecordings];
      } catch (error) {
        if (!window.confirm('Failed to upload some files. Continue without them?')) {
          setIsSaving(false);
          setUploadingFiles(false);
          return;
        }
      }
    }

    setUploadingFiles(false);

    try {
      // Split topics into songs and techniques for database storage
      const repertoireTitles = state.repertoire.map(r => r.title.toLowerCase());
      const songs = (currentSession.topics || []).filter(topic => 
        repertoireTitles.includes(topic.toLowerCase())
      );
      const techniques = (currentSession.topics || []).filter(topic => 
        !repertoireTitles.includes(topic.toLowerCase())
      );
      
      const sessionData = {
        user_id: state.user.uid,
        date: currentSession.date || new Date().toISOString().split('T')[0],
        duration: currentSession.duration || 0,
        mood: 'Good', // Always use default mood
        techniques: techniques,
        songs: songs,
        notes: currentSession.notes || '',
        tags: [], // Empty tags
        recordings: recordings,
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

      // Update repertoire last_practiced for songs
      if (songs.length > 0) {
        for (const songTitle of songs) {
          const matchingSong = state.repertoire.find(item => 
            item.title.toLowerCase() === songTitle.toLowerCase()
          );
          
          if (matchingSong) {
            await supabase
              .from('repertoire')
              .update({ last_practiced: new Date().toISOString() })
              .eq('id', matchingSong.id);
          }
        }
      }

      await refreshData();
      closeModal();

      // Check for mastery updates
      if (songs.length > 0) {
        const songsToUpdate = state.repertoire.filter(item => 
          songs.includes(item.title)
        );
        if (songsToUpdate.length > 0) {
          setMasteryItems(songsToUpdate);
          setShowMasteryModal(true);
          return; // Wait for mastery modal to close before showing goal modal
        }
      }

      // Check for goal updates
      checkForGoalUpdates();

    } catch (error) {
      console.error('Error saving practice session:', error);
      alert('Failed to save practice session. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const checkForGoalUpdates = () => {
    const relatedGoals = state.goals.filter(goal => 
      goal.status === 'Active' && (
        (currentSession?.topics && currentSession.topics.some(topic => 
          topic.toLowerCase().includes(goal.title.toLowerCase())
        ))
      )
    );
    
    if (relatedGoals.length > 0) {
      setRelatedGoal(relatedGoals[0]);
      setShowGoalModal(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this practice session?')) return;

    try {
      // Find the session to get its recordings
      const sessionToDelete = state.practiceSessions.find(s => s.id === id);
      
      // Delete recordings from storage
      if (sessionToDelete?.recordings) {
        for (const recording of sessionToDelete.recordings) {
          await supabase.storage
            .from('recordings')
            .remove([recording.id]);
        }
      }

      // Delete the session
      const { error } = await supabase
        .from('practice_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await refreshData();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const handleMasteryUpdate = async (updatedItems: any[]) => {
    try {
      for (const item of updatedItems) {
        await supabase
          .from('repertoire')
          .update({ mastery: item.mastery })
          .eq('id', item.id);
      }
      await refreshData();
      setShowMasteryModal(false);
      
      // Check for goal updates after mastery update
      setTimeout(() => {
        checkForGoalUpdates();
      }, 100);
    } catch (error) {
      console.error('Error updating mastery:', error);
    }
  };

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleGoalUpdate = async (goal: any, newProgress: number) => {
    try {
      const status = newProgress >= 100 ? 'Completed' : 'Active';
      await supabase
        .from('goals')
        .update({ progress: newProgress, status })
        .eq('id', goal.id);
      
      await refreshData();
      setShowGoalModal(false);
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Practice Log</h1>
          <p className="text-text-secondary mt-1">Track your practice sessions and progress</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleStartLiveSession}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
            title="Start a live practice session with timer and recording"
          >
            <span>🎸</span>
            <span>Start Live Session</span>
          </button>
          <button 
            onClick={() => openModal()}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
            title="Manually log a past practice session"
          >
            <span>+</span>
            <span>Log Past Session</span>
          </button>
        </div>
      </div>

      {/* AI Insights Section */}
      {state.practiceSessions.length > 0 && (
        <div className="bg-surface p-6 rounded-lg mb-6 border border-border/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🧠</div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">AI Practice Insights</h2>
                <p className="text-sm text-text-secondary">Get personalized analysis of your practice patterns</p>
              </div>
            </div>
            <button
              onClick={generateAIInsights}
              disabled={loadingInsights}
              className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingInsights ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Generate Insights</span>
                </>
              )}
            </button>
          </div>
          
          {showInsights && aiInsights && (
            <div className="bg-background/50 p-4 rounded-lg border border-border/30">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🎸</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary mb-2">Your Practice Analysis</h3>
                  <div className="text-text-primary whitespace-pre-wrap leading-relaxed">
                    {aiInsights}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {state.practiceSessions.map(session => (
          <div key={session.id} className="bg-surface rounded-lg transition-all duration-200 hover:shadow-md group border border-border/50">
            {/* Condensed Header - Always Visible */}
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-primary">
                      {new Date(session.date).toLocaleDateString()}
                    </h3>
                    <span className="text-sm text-text-secondary bg-background px-2 py-1 rounded-full">
                      {session.duration} min
                    </span>
                    {session.recordings.length > 0 && (
                      <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded-full">
                        📹 {session.recordings.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSessionExpansion(session.id)}
                    className="text-text-secondary hover:text-text-primary transition-colors flex items-center space-x-1"
                    title={expandedSessions.has(session.id) ? "Collapse details" : "Expand details"}
                  >
                    <span className="text-xs">Details</span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${expandedSessions.has(session.id) ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {/* Practice Topics - Always Visible */}
                {(session.songs.length > 0 || session.techniques.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {session.songs.slice(0, 3).map(song => (
                      <span key={song} className="inline-block bg-primary/15 text-primary px-2 py-1 rounded-full text-xs">
                        🎵 {song}
                      </span>
                    ))}
                    {session.techniques.slice(0, 3).map(technique => (
                      <span key={technique} className="inline-block bg-secondary/15 text-secondary-300 px-2 py-1 rounded-full text-xs">
                        🎸 {technique}
                      </span>
                    ))}
                    {(session.songs.length > 3 || session.techniques.length > 3) && (
                      <span className="inline-block bg-surface text-text-secondary px-2 py-1 rounded-full text-xs">
                        +{(session.songs.length + session.techniques.length) - 6} more
                      </span>
                    )}
                  </div>
                )}
                
                {/* Quick preview of notes - Always Visible */}
                {session.notes && (
                  <p className="text-sm text-text-secondary line-clamp-2 mt-2">
                    {session.notes.length > 100 ? `${session.notes.substring(0, 100)}...` : session.notes}
                  </p>
                )}
              </div>
              
              {/* Action Buttons - Always Visible on Hover */}
              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                <button 
                  onClick={() => openModal(session)}
                  className="text-sm text-primary hover:text-primary-hover transition-colors px-2 py-1 hover:bg-primary/10 rounded"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(session.id)}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors px-2 py-1 hover:bg-red-500/10 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            
            {/* Expanded Details - Only when expanded */}
            {expandedSessions.has(session.id) && (
              <div className="border-t border-border/30 p-4 pt-3 bg-background/30">
                {/* Full Practice Topics */}
                {(session.songs.length > 0 || session.techniques.length > 0) && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-text-secondary mb-2">Practice Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {session.songs.map(song => (
                        <span key={song} className="inline-block bg-primary/20 text-primary px-3 py-1 rounded-full text-sm">
                          🎵 {song}
                        </span>
                      ))}
                      {session.techniques.map(technique => (
                        <span key={technique} className="inline-block bg-secondary/20 text-secondary-300 px-3 py-1 rounded-full text-sm">
                          🎸 {technique}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Notes */}
                {session.notes && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-text-secondary mb-2">Session Notes</h4>
                    <p className="text-text-primary whitespace-pre-wrap bg-surface p-3 rounded-md text-sm">
                      {session.notes}
                    </p>
                  </div>
                )}

                {/* Recordings - Lazy Loaded */}
                {session.recordings.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-text-secondary mb-2">
                      📹 Recordings ({session.recordings.length})
                    </h4>
                    <div className="space-y-3">
                      {session.recordings.map(recording => (
                        <div key={recording.id} className="bg-surface p-3 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-text-primary">{recording.name}</span>
                            {recording.originalSize && recording.compressedSize && (
                              <span className="text-xs text-text-secondary">
                                {formatFileSize(recording.compressedSize)}
                              </span>
                            )}
                          </div>
                          {recording.type === 'video' ? (
                            <video 
                              controls 
                              className="w-full max-w-md rounded border border-border"
                              preload="metadata"
                            >
                              <source src={recording.url} type="video/webm" />
                              <source src={recording.url} type="video/mp4" />
                              Your browser does not support video playback.
                            </video>
                          ) : (
                            <audio 
                              controls 
                              className="w-full max-w-md"
                              preload="metadata"
                            >
                              <source src={recording.url} type="audio/webm" />
                              <source src={recording.url} type="audio/mp4" />
                              Your browser does not support audio playback.
                            </audio>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference Link */}
                {session.link && (
                  <div className="mb-2">
                    <a 
                      href={session.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-primary hover:text-primary-hover text-sm flex items-center space-x-1 hover:underline"
                    >
                      <span>🔗</span>
                      <span>Reference Link</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {state.practiceSessions.length === 0 && (
          <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
            <div className="text-6xl mb-6">📝</div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">Start Your Practice Journey</h2>
            <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
              Begin tracking your practice with a live session or log past practice manually.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={handleStartLiveSession}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
              >
                🎸 Start Live Session
              </button>
              <button 
                onClick={() => openModal()}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
              >
                📝 Log Past Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Modal */}
      {isModalOpen && currentSession && (
        <Modal isOpen={isModalOpen} onClose={closeModal} title={currentSession.id ? "Edit Session" : "Log Practice Session"}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Date</label>
                <input 
                  type="date" 
                  value={currentSession.date?.split('T')[0]} 
                  onChange={e => setCurrentSession({ ...currentSession, date: e.target.value })}
                  className="w-full bg-background p-2 rounded-md border border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Duration (minutes)</label>
                <input 
                  type="number" 
                  value={currentSession.duration} 
                  onChange={e => setCurrentSession({ ...currentSession, duration: parseInt(e.target.value) || 0 })}
                  className="w-full bg-background p-2 rounded-md border border-border"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">What did you practice?</label>
              <TagInput 
                values={currentSession.topics || []}
                onChange={topics => setCurrentSession({ ...currentSession, topics })}
                prioritizedSuggestions={{
                  repertoire: state.repertoire.map(r => r.title),
                  goals: state.goals.filter(g => g.status === 'Active').map(g => g.title),
                  techniques: [
                    'Alternate Picking', 'Sweep Picking', 'Legato', 'Tapping',
                    'Bending', 'Vibrato', 'Slides', 'Hammer-ons', 'Pull-offs',
                    'Palm Muting', 'Fingerpicking', 'Tremolo', 'Harmonics',
                    'Scales', 'Chords', 'Arpeggios', 'Rhythm', 'Lead'
                  ]
                }}
                placeholder="Add songs, techniques, concepts (press Enter)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Notes</label>
              <textarea 
                value={currentSession.notes} 
                onChange={e => setCurrentSession({ ...currentSession, notes: e.target.value })}
                className="w-full bg-background p-2 rounded-md border border-border h-24"
                placeholder="What did you work on? Any breakthroughs or challenges?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Link (optional)</label>
              <input 
                type="url" 
                value={currentSession.link} 
                onChange={e => setCurrentSession({ ...currentSession, link: e.target.value })}
                className="w-full bg-background p-2 rounded-md border border-border"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Recordings</label>
              <input 
                type="file" 
                multiple 
                accept="audio/*,video/*" 
                onChange={e => setSelectedFiles(e.target.files)}
                className="w-full bg-background p-2 rounded-md border border-border"
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-xs text-text-secondary mt-1">
                  Selected {selectedFiles.length} file(s)
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button 
                onClick={closeModal} 
                disabled={isSaving || uploadingFiles}
                className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving || uploadingFiles}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : uploadingFiles ? 'Uploading...' : 'Save Session'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Progress Modal */}
      {uploadingFiles && (
        <UploadProgress 
          files={uploadProgressData}
          onCancel={() => {
            setUploadingFiles(false);
            setUploadProgressData([]);
          }}
        />
      )}

      {/* Mastery Update Modal */}
      <MasteryUpdateModal 
        isOpen={showMasteryModal}
        onClose={() => setShowMasteryModal(false)}
        items={masteryItems}
        onUpdate={handleMasteryUpdate}
      />

      {/* Goal Update Modal */}
      {relatedGoal && (
        <GoalUpdateModal 
          isOpen={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          goal={relatedGoal}
          onUpdate={handleGoalUpdate}
        />
      )}
    </div>
  );
};