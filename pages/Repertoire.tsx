
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { RepertoireItem, Difficulty, GoalCategory } from '../types';
import { Modal } from '../components/Modal';
import { DIFFICULTY_OPTIONS } from '../constants';
import { supabase } from '../services/supabase';


export const Repertoire: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<RepertoireItem> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<keyof RepertoireItem>('title');

    const openModal = (item: Partial<RepertoireItem> | null = null) => {
        setCurrentItem(item ? { ...item } : { title: '', artist: '', difficulty: Difficulty.Beginner, mastery: 0, notes: '' });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentItem(null);
    };

    const handleSave = async () => {
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
                <h1 className="text-3xl font-bold">Repertoire</h1>
                <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                    + Add Piece
                </button>
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
                    <div key={item.id} className="bg-surface rounded-lg transition-all hover:ring-2 hover:ring-primary">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4">
                             <Link to={`/repertoire/${item.id}`} className="flex-1 mb-4 sm:mb-0 cursor-pointer group">
                                <h3 className="text-xl font-semibold text-primary group-hover:underline">{item.title}</h3>
                                <p className="text-text-secondary text-base">by {item.artist}</p>
                                <p className="text-sm text-text-secondary mt-1">{item.difficulty} | Last Practiced: {item.lastPracticed ? new Date(item.lastPracticed).toLocaleDateString() : 'Never'}</p>
                               <div className="mt-2 w-full sm:w-48">
                                   <div className="w-full bg-background rounded-full h-2.5">
                                       <div className={`${masteryColor(item.mastery)} h-2.5 rounded-full`} style={{width: `${item.mastery}%`}}></div>
                                   </div>
                                    <p className="text-xs text-left mt-1">{item.mastery}% Mastery</p>
                               </div>
                            </Link>
                            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-end">
                               <button onClick={() => handleSetAsGoal(item)} className="bg-secondary/20 hover:bg-secondary/40 text-secondary-300 font-bold py-2 px-3 rounded-md text-sm whitespace-nowrap">Set as Goal</button>
                               <button onClick={() => openModal(item)} className="text-sm text-primary hover:underline">Edit</button>
                               <button onClick={() => handleDelete(item.id)} className="text-sm text-red-400 hover:underline">Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && currentItem && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentItem.id ? "Edit Piece" : "Add New Piece"}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Title</label>
                                <input type="text" value={currentItem.title} onChange={e => setCurrentItem({ ...currentItem, title: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Artist</label>
                                <input type="text" value={currentItem.artist} onChange={e => setCurrentItem({ ...currentItem, artist: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Difficulty</label>
                                <select value={currentItem.difficulty} onChange={e => setCurrentItem({ ...currentItem, difficulty: e.target.value as Difficulty })} className="w-full bg-background p-2 rounded-md border border-border">
                                    {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary">Mastery ({currentItem.mastery || 0}%)</label>
                                <input type="range" min="0" max="100" value={currentItem.mastery} onChange={e => setCurrentItem({ ...currentItem, mastery: parseInt(e.target.value) })} className="w-full" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Notes</label>
                            <textarea value={currentItem.notes} onChange={e => setCurrentItem({ ...currentItem, notes: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border h-24"></textarea>
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button onClick={closeModal} disabled={isSaving} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? 'Saving...' : 'Save Piece'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
