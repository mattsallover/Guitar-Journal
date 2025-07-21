import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { PracticePlaylist, YouTubeVideo } from '../types';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';

interface PlaylistManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string, videoTitle: string) => void;
}

// Extract YouTube video ID from URL
const extractYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Get video title from YouTube API (simplified version)
const getVideoTitle = async (videoId: string): Promise<string> => {
  try {
    // Note: In a real implementation, you'd use YouTube Data API v3
    // For now, we'll use a placeholder title
    return `YouTube Video ${videoId}`;
  } catch (error) {
    return `YouTube Video ${videoId}`;
  }
};

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({ isOpen, onClose, onVideoSelect }) => {
  const { state } = useAppContext();
  const [playlists, setPlaylists] = useState<PracticePlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PracticePlaylist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && state.user) {
      fetchPlaylists();
    }
  }, [isOpen, state.user]);

  const fetchPlaylists = async () => {
    if (!state.user) return;

    try {
      const { data, error } = await supabase
        .from('practice_playlists')
        .select('*')
        .eq('user_id', state.user.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedPlaylists: PracticePlaylist[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        videos: row.videos || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setPlaylists(mappedPlaylists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim() || !state.user) return;
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('practice_playlists')
        .insert([{
          user_id: state.user.uid,
          name: newPlaylistName.trim(),
          description: '',
          videos: []
        }])
        .select()
        .single();

      if (error) throw error;

      const newPlaylist: PracticePlaylist = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        videos: data.videos || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setPlaylists(prev => [newPlaylist, ...prev]);
      setNewPlaylistName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Failed to create playlist. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addVideoToPlaylist = async () => {
    if (!newVideoUrl.trim() || !selectedPlaylist) return;
    setIsSaving(true);

    try {
      const videoId = extractYouTubeId(newVideoUrl);
      if (!videoId) {
        alert('Please enter a valid YouTube URL');
        return;
      }

      const title = await getVideoTitle(videoId);
      const newVideo: YouTubeVideo = {
        id: videoId,
        title,
        url: newVideoUrl.trim(),
        addedAt: new Date().toISOString()
      };

      const updatedVideos = [...selectedPlaylist.videos, newVideo];

      const { error } = await supabase
        .from('practice_playlists')
        .update({
          videos: updatedVideos,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPlaylist.id);

      if (error) throw error;

      const updatedPlaylist = { ...selectedPlaylist, videos: updatedVideos };
      setSelectedPlaylist(updatedPlaylist);
      setPlaylists(prev => prev.map(p => p.id === selectedPlaylist.id ? updatedPlaylist : p));
      setNewVideoUrl('');
      setIsAddingVideo(false);
    } catch (error) {
      console.error('Error adding video:', error);
      alert('Failed to add video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeVideoFromPlaylist = async (videoId: string) => {
    if (!selectedPlaylist) return;

    try {
      const updatedVideos = selectedPlaylist.videos.filter(v => v.id !== videoId);

      const { error } = await supabase
        .from('practice_playlists')
        .update({
          videos: updatedVideos,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPlaylist.id);

      if (error) throw error;

      const updatedPlaylist = { ...selectedPlaylist, videos: updatedVideos };
      setSelectedPlaylist(updatedPlaylist);
      setPlaylists(prev => prev.map(p => p.id === selectedPlaylist.id ? updatedPlaylist : p));
    } catch (error) {
      console.error('Error removing video:', error);
      alert('Failed to remove video. Please try again.');
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const { error } = await supabase
        .from('practice_playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Failed to delete playlist. Please try again.');
    }
  };

  const handleVideoSelect = (video: YouTubeVideo) => {
    onVideoSelect(video.id, video.title);
    onClose();
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Practice Playlists">
        <div className="text-center p-8">Loading playlists...</div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Practice Playlists">
      <div className="flex h-96">
        {/* Playlist List */}
        <div className="w-1/3 border-r border-border pr-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-text-primary">Your Playlists</h3>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded text-sm"
            >
              + New
            </button>
          </div>

          {isCreating && (
            <div className="mb-4 p-3 bg-background rounded">
              <input
                type="text"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name"
                className="w-full bg-surface p-2 rounded border border-border text-sm mb-2"
                onKeyPress={e => e.key === 'Enter' && createPlaylist()}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={createPlaylist}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {playlists.map(playlist => (
              <div
                key={playlist.id}
                onClick={() => setSelectedPlaylist(playlist)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedPlaylist?.id === playlist.id
                    ? 'bg-primary/20 border border-primary'
                    : 'bg-surface hover:bg-border'
                }`}
              >
                <div className="font-medium text-sm">{playlist.name}</div>
                <div className="text-xs text-text-secondary">
                  {playlist.videos.length} video{playlist.videos.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video List */}
        <div className="flex-1 pl-4">
          {selectedPlaylist ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-text-primary">{selectedPlaylist.name}</h3>
                  <p className="text-sm text-text-secondary">{selectedPlaylist.videos.length} videos</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsAddingVideo(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    + Add Video
                  </button>
                  <button
                    onClick={() => deletePlaylist(selectedPlaylist.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isAddingVideo && (
                <div className="mb-4 p-3 bg-background rounded">
                  <input
                    type="url"
                    value={newVideoUrl}
                    onChange={e => setNewVideoUrl(e.target.value)}
                    placeholder="YouTube URL"
                    className="w-full bg-surface p-2 rounded border border-border text-sm mb-2"
                    onKeyPress={e => e.key === 'Enter' && addVideoToPlaylist()}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={addVideoToPlaylist}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setIsAddingVideo(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedPlaylist.videos.map(video => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-2 bg-surface rounded hover:bg-border transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{video.title}</div>
                      <div className="text-xs text-text-secondary">
                        Added {new Date(video.addedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-2">
                      <button
                        onClick={() => handleVideoSelect(video)}
                        className="bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded text-xs"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => removeVideoFromPlaylist(video.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedPlaylist.videos.length === 0 && (
                <div className="text-center p-8 text-text-secondary">
                  <div className="text-4xl mb-2">🎵</div>
                  <p>No videos in this playlist yet</p>
                  <p className="text-sm">Click "Add Video" to get started</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-8 text-text-secondary">
              <div className="text-4xl mb-2">📋</div>
              <p>Select a playlist to view videos</p>
              <p className="text-sm">Or create your first playlist</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};