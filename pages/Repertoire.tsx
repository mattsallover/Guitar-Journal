import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { RepertoireItem, Difficulty, GoalCategory } from '../types';
import { Modal } from '../components/Modal';
import { PracticeStartModal } from '../components/PracticeStartModal';
import { DIFFICULTY_OPTIONS } from '../constants';
import { supabase } from '../services/supabase';


// Levenshtein distance algorithm for fuzzy matching
const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
        matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
        matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    
    return matrix[str2.length][str1.length];
};

// Normalize string for comparison
const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
};

// Check for potential duplicates
const checkForDuplicates = (title: string, artist: string, repertoire: RepertoireItem[]): RepertoireItem[] => {
    const normalizedTitle = normalizeString(title);
    const normalizedArtist = normalizeString(artist);
    
    return repertoire.filter(item => {
        const itemTitle = normalizeString(item.title);
        const itemArtist = normalizeString(item.artist);
        
        // Exact match (normalized)
        if (itemTitle === normalizedTitle && itemArtist === normalizedArtist) {
            return true;
        }
        
        // Fuzzy matching with Levenshtein distance (within 2 characters)
        const titleDistance = levenshteinDistance(normalizedTitle, itemTitle);
        const artistDistance = levenshteinDistance(normalizedArtist, itemArtist);
        
        // Consider it a potential duplicate if:
        // - Title is very close (within 2 chars) and artist is exact match
        // - Title is exact match and artist is close (within 2 chars)
        // - Both title and artist are close (within 1 char each)
        if ((titleDistance <= 2 && itemArtist === normalizedArtist) ||
            (itemTitle === normalizedTitle && artistDistance <= 2) ||
            (titleDistance <= 1 && artistDistance <= 1)) {
            return true;
        }
        
        return false;
    });
};

export const Repertoire: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<RepertoireItem> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<keyof RepertoireItem>('title');
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [potentialDuplicates, setPotentialDuplicates] = useState<RepertoireItem[]>([]);
    const [showPracticeModal, setShowPracticeModal] = useState(false);

    useEffect(() => {
        const navState = location.state;
        if (navState?.openModal) {
            openModal();
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate]);

    const handleOpenPracticeModal = () => {
        setShowPracticeModal(true);
    };

    const handleLogPastSession = () => {
        setShowPracticeModal(false);
        navigate('/log');
    };
    const openModal = (item: Partial<RepertoireItem> | null = null) => {
        // Smart defaults: pre-fill with sensible values
        setCurrentItem(item ? { ...item } : { 
            title: '', 
            artist: '', 
            difficulty: Difficulty.Intermediate, // Most users are intermediate
            mastery: 25, // Realistic starting mastery
            notes: '' 
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentItem(null);
    };
    
    const closeDuplicateModal = () => {
        setDuplicateModalOpen(false);
        setPotentialDuplicates([]);
    };
    
    const handleEditMyEntry = () => {
        closeDuplicateModal();
        // Form stays open with current data for user to edit
    };
    
    const handleThisIsNew = async () => {
        closeDuplicateModal();
        // Proceed with save despite duplicates
        await performSave();
    };

    const performSave = async () => {
        if (!currentItem || !currentItem.title || !state.user) return;
        setIsSaving(true);

        try {
            if (currentItem.id) { // Update existing item
                const { error } = await supabase
                    .from('repertoire')
                    .update({
                        title: currentItem.title,
                        artist: currentItem.artist || '',
                        difficulty: currentItem.difficulty || 'Beginner',
                        mastery: currentItem.mastery || 0,
                        notes: currentItem.notes || '',
                    })
                    .eq('id', currentItem.id);
                
                if (error) throw error;
            } else { // Add new item
                const { error } = await supabase
                    .from('repertoire')
                    .insert([{
                        user_id: state.user.uid,
                        date_added: new Date().toISOString(),
                        title: currentItem.title,
                        artist: currentItem.artist || '',
                        difficulty: currentItem.difficulty || 'Beginner',
                        mastery: currentItem.mastery || 0,
                        notes: currentItem.notes || '',
                    }]);
                
                if (error) throw error;
            }
            await refreshData(); // Refresh data to show the new/updated item
            closeModal();
        } catch (error) {
            console.error("Error saving repertoire item:", error);
            alert("Failed to save item. Check your internet connection or Supabase configuration.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSave = async () => {
        if (!currentItem || !currentItem.title || !state.user) return;
        
        // Only check for duplicates when adding new items (not editing existing ones)
        if (!currentItem.id && currentItem.title && currentItem.artist) {
            const duplicates = checkForDuplicates(currentItem.title, currentItem.artist, state.repertoire);
            if (duplicates.length > 0) {
                setPotentialDuplicates(duplicates);
                setDuplicateModalOpen(true);
                return;
            }
        }
        
        // No duplicates found, proceed with save
        await performSave();
    };
    
    const handleDelete = async (id: string) => {
        if(window.confirm('Are you sure you want to delete this piece from your repertoire?')){
            try {
                const { error } = await supabase
                    .from('repertoire')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
            } catch (error) {
                console.error("Error deleting repertoire item:", error);
                alert("Failed to delete item. Please try again.");
            }
        }
    };
    
    const handleSetAsGoal = (item: RepertoireItem) => {
        navigate('/goals', { 
            state: { 
                newGoalTitle: item.title,
                newGoalCategory: GoalCategory.Song,
                newGoalDescription: `Master "${item.title}" by ${item.artist}.`
            }
        });
    };

    const handlePracticeNow = (item: RepertoireItem) => {
        navigate('/session/live', { state: { topic: item.title } });
    };


    const sortedRepertoire = [...state.repertoire]
        .filter(item => 
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.artist.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });

    const masteryColor = (mastery: number) => {
        if (mastery < 33) return 'bg-red-500';
        if (mastery < 66) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary">Your Repertoire</h1>
                    <p className="text-text-secondary mt-1">Songs you're learning and mastering</p>
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={handleOpenPracticeModal}
                        className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md transition-all duration-200 hover:scale-105 flex items-center space-x-2"
                        title="Start or log a practice session"
                    >
                        <span>🎸</span>
                        <span>Start Practice</span>
                    </button>
                    <button 
                        onClick={() => openModal()} 
                        className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                        title="Add a new song to your repertoire"
                    >
                        <span>+</span>
                        <span>Add Song</span>
                    </button>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                 <input
                    type="text"
                    placeholder="Search title or artist..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-1/2 bg-surface p-2 rounded-md border border-border"
                />
                <select 
                    value={sortKey} 
                    onChange={e => setSortKey(e.target.value as keyof RepertoireItem)}
                    className="bg-surface p-2 rounded-md border border-border"
                >
                    <option value="title">Sort by Title</option>
                    <option value="artist">Sort by Artist</option>
                    <option value="mastery">Sort by Mastery</option>
                    <option value="lastPracticed">Sort by Last Practiced</option>
                </select>
            </div>

            <div className="space-y-1">
                {sortedRepertoire.map(item => (
                    <div key={item.id} className="bg-surface rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4">
                             <Link to={`/repertoire/${item.id}`} className="flex-1 mb-4 sm:mb-0 cursor-pointer">
                                <h3 className="text-xl font-semibold text-primary hover:underline transition-colors duration-200">{item.title}</h3>
                                <p className="text-text-secondary text-base">by {item.artist}</p>
                                <p className="text-sm text-text-secondary mt-1">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/20 text-primary mr-2">
                                        {item.difficulty}
                                    </span>
                                    Last practiced: {item.lastPracticed ? new Date(item.lastPracticed).toLocaleDateString() : 'Never'}
                                </p>
                               <div className="mt-2 w-full sm:w-48">
                                   <div className="w-full bg-background rounded-full h-2.5">
                                       <div className={`${masteryColor(item.mastery)} h-2.5 rounded-full transition-all duration-500`} style={{width: `${item.mastery}%`}}></div>
                                   </div>
                                    <p className="text-xs text-left mt-1">{item.mastery}% Mastery</p>
                               </div>
                            </Link>
                            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                               <button 
                                  onClick={() => handlePracticeNow(item)} 
                                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md text-sm whitespace-nowrap transition-all duration-200 hover:scale-105"
                                  title="Start practicing this song now"
                               >
                                  🎸 Practice
                               </button>
                               <Link 
                                  to={`/progression?focus=${encodeURIComponent(item.title)}`} 
                                  className="text-sm text-secondary hover:underline transition-colors duration-200"
                                  title="View practice progression for this song"
                               >
                                  📊 Progress
                               </Link>
                               <button 
                                  onClick={() => handleSetAsGoal(item)} 
                                  className="bg-secondary/20 hover:bg-secondary/40 text-secondary-300 font-bold py-2 px-3 rounded-md text-sm whitespace-nowrap transition-all duration-200 hover:scale-105"
                                  title="Create a goal for this song"
                               >
                                  🎯 Set Goal
                               </button>
                               <button 
                                  onClick={() => openModal(item)} 
                                  className="text-sm text-primary hover:underline transition-colors duration-200"
                                  title="Edit this song"
                               >
                                  ✏️ Edit
                               </button>
                               <button 
                                  onClick={() => handleDelete(item.id)} 
                                  className="text-sm text-red-400 hover:underline transition-colors duration-200"
                                  title="Remove this song"
                               >
                                  🗑️ Remove
                               </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {sortedRepertoire.length === 0 && (
                    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                        <div className="text-6xl mb-6">🎵</div>
                        <h2 className="text-2xl font-bold text-text-primary mb-3">Build Your Repertoire</h2>
                        <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
                            Start by adding the songs you're currently learning or want to master.
                        </p>
                        <button 
                            onClick={() => openModal()} 
                            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                        >
                            Add Your First Song
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && currentItem && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentItem.id ? "Edit Song" : "Add New Song"}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Title</label>
                                <input 
                                    type="text" 
                                    value={currentItem.title} 
                                    onChange={e => setCurrentItem({ ...currentItem, title: e.target.value })} 
                                    className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                    placeholder="Enter song title"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Artist</label>
                                <input 
                                    type="text" 
                                    value={currentItem.artist} 
                                    onChange={e => setCurrentItem({ ...currentItem, artist: e.target.value })} 
                                    className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                    placeholder="Enter artist name"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Difficulty</label>
                                <select 
                                    value={currentItem.difficulty} 
                                    onChange={e => setCurrentItem({ ...currentItem, difficulty: e.target.value as Difficulty })} 
                                    className="w-full bg-background p-3 rounded-md border border-border transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Mastery ({currentItem.mastery || 0}%)</label>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={currentItem.mastery} 
                                    onChange={e => setCurrentItem({ ...currentItem, mastery: parseInt(e.target.value) })} 
                                    className="w-full mt-2 accent-primary"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Notes</label>
                            <textarea 
                                value={currentItem.notes} 
                                onChange={e => setCurrentItem({ ...currentItem, notes: e.target.value })} 
                                className="w-full bg-background p-3 rounded-md border border-border h-24 transition-all duration-200 focus:ring-2 focus:ring-primary focus:border-transparent" 
                                placeholder="Add any notes about this song..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end space-x-4">
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
                                {isSaving ? 'Saving...' : 'Save Song'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            
            {/* Duplicate Detection Modal */}
            {duplicateModalOpen && (
                <Modal isOpen={duplicateModalOpen} onClose={closeDuplicateModal} title="⚠️ Potential Duplicate Detected">
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="text-yellow-400 text-4xl mb-2">🔍</div>
                            <p className="text-text-secondary">
                                We found {potentialDuplicates.length} similar {potentialDuplicates.length === 1 ? 'entry' : 'entries'} in your repertoire.
                            </p>
                        </div>
                        
                        {/* Your New Entry */}
                        <div className="bg-blue-900/20 border border-blue-500 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-300 mb-2">📝 Your New Entry:</h3>
                            <div className="text-text-primary">
                                <div className="font-semibold">{currentItem?.title}</div>
                                <div className="text-sm text-text-secondary">by {currentItem?.artist}</div>
                            </div>
                        </div>
                        
                        {/* Existing Entries */}
                        <div className="bg-orange-900/20 border border-orange-500 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-orange-300 mb-3">🎵 Existing {potentialDuplicates.length === 1 ? 'Entry' : 'Entries'}:</h3>
                            <div className="space-y-3">
                                {potentialDuplicates.map(duplicate => (
                                    <div key={duplicate.id} className="border-l-2 border-orange-400 pl-3">
                                        <div className="font-semibold text-text-primary">{duplicate.title}</div>
                                        <div className="text-sm text-text-secondary">by {duplicate.artist}</div>
                                        <div className="text-xs text-text-secondary mt-1">
                                            {duplicate.difficulty} • {duplicate.mastery}% mastery
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="text-sm text-text-secondary text-center">
                            <p>Is this a different song, or did you mean to update an existing entry?</p>
                        </div>
                        
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleEditMyEntry}
                                className="flex-1 bg-surface hover:bg-border text-text-primary font-bold py-3 px-4 rounded-md"
                            >
                                📝 Edit My Entry
                            </button>
                            <button 
                                onClick={handleThisIsNew}
                                disabled={isSaving}
                                className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-md disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : '✅ This is New'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Practice Start Modal */}
            <PracticeStartModal
                isOpen={showPracticeModal}
                onClose={() => setShowPracticeModal(false)}
                onLogPastSession={handleLogPastSession}
            />
        </div>
    );
};