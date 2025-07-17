
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Goal, GoalStatus, GoalCategory } from '../types';
import { Modal } from '../components/Modal';
import { GOAL_STATUS_OPTIONS, GOAL_CATEGORY_OPTIONS } from '../constants';
import { db } from '../services/firebase';


export const Goals: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentGoal, setCurrentGoal] = useState<Partial<Goal> | null>(null);
    const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');

    useEffect(() => {
        const navState = location.state;
        if (navState?.newGoalTitle) {
            openModal({
                title: navState.newGoalTitle,
                category: navState.newGoalCategory || GoalCategory.Song,
                description: navState.newGoalDescription || '',
                targetDate: new Date().toISOString().split('T')[0], 
                status: GoalStatus.Active, 
                progress: 0,
            });
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate]);


    const openModal = (goal: Partial<Goal> | null = null) => {
        setCurrentGoal(goal ? { ...goal } : { title: '', description: '', targetDate: new Date().toISOString().split('T')[0], status: GoalStatus.Active, progress: 0, category: GoalCategory.Technique });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentGoal(null);
    };

    const handleSave = async () => {
        if (!currentGoal || !currentGoal.title || !state.user) return;
        setIsSaving(true);
        
        try {
            const goalDataToSave = {
                userId: state.user.uid,
                title: currentGoal.title || '',
                description: currentGoal.description || '',
                targetDate: currentGoal.targetDate || new Date().toISOString().split('T')[0],
                status: currentGoal.status || GoalStatus.Active,
                progress: currentGoal.progress || 0,
                category: currentGoal.category || GoalCategory.Technique,
            };

            if (currentGoal.id) {
                const docRef = db.collection('goals').doc(currentGoal.id);
                await docRef.update(goalDataToSave);
            } else {
                await db.collection('goals').add(goalDataToSave);
            }
            closeModal();
        } catch (error) {
            console.error("Error saving goal:", error);
            alert("Failed to save goal. Check your internet connection or Firestore security rules.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if(window.confirm('Are you sure you want to delete this goal?')){
            try {
                await db.collection('goals').doc(id).delete();
            } catch (error) {
                console.error("Error deleting goal:", error);
                alert("Failed to delete goal. Please try again.");
            }
        }
    };
    
    const handleStartPractice = (title: string) => {
        navigate('/session/live', { state: { topic: title } });
    };

    const filteredGoals = state.goals.filter(goal => filterStatus === 'all' || goal.status === filterStatus);

    const progressColor = (progress: number) => {
        if (progress < 33) return 'bg-red-500';
        if (progress < 66) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Goals</h1>
                <button onClick={() => openModal()} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md">
                    + Set New Goal
                </button>
            </div>
            
            <div className="mb-4">
                <span className="mr-4">Filter by status:</span>
                <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded-full text-sm ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-surface'}`}>All</button>
                <button onClick={() => setFilterStatus(GoalStatus.Active)} className={`ml-2 px-3 py-1 rounded-full text-sm ${filterStatus === GoalStatus.Active ? 'bg-primary text-white' : 'bg-surface'}`}>Active</button>
                <button onClick={() => setFilterStatus(GoalStatus.Completed)} className={`ml-2 px-3 py-1 rounded-full text-sm ${filterStatus === GoalStatus.Completed ? 'bg-primary text-white' : 'bg-surface'}`}>Completed</button>
            </div>

            <div className="space-y-4">
                {filteredGoals.map(goal => (
                    <div key={goal.id} className="bg-surface p-4 rounded-lg">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1 mb-4 sm:mb-0">
                                <h3 className="text-xl font-semibold">{goal.title} {goal.status === GoalStatus.Completed && '✅'}</h3>
                                <p className="text-sm text-text-secondary">{goal.category} | Target: {new Date(goal.targetDate).toLocaleDateString()}</p>
                                <p className="mt-2 text-text-primary">{goal.description}</p>
                                <div className="mt-2 w-full sm:w-48">
                                   <p className="text-xs text-left mb-1">{goal.progress}% Complete</p>
                                   <div className="w-full bg-background rounded-full h-2.5">
                                       <div className={`${progressColor(goal.progress)} h-2.5 rounded-full`} style={{width: `${goal.progress}%`}}></div>
                                   </div>
                               </div>
                            </div>
                             <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-end flex-wrap">
                               {goal.status === GoalStatus.Active && (
                                   <button onClick={() => handleStartPractice(goal.title)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-3 rounded-md text-sm whitespace-nowrap">Start Practice</button>
                               )}
                               <Link to={`/progression?focus=${encodeURIComponent(goal.title)}`} className="text-sm text-secondary hover:underline whitespace-nowrap">Progression</Link>
                                <button onClick={() => openModal(goal)} className="text-sm text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDelete(goal.id)} className="text-sm text-red-400 hover:underline">Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && currentGoal && (
                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentGoal.id ? "Edit Goal" : "Set New Goal"}>
                     <div className="space-y-4">
                        <div >
                            <label className="block text-sm font-medium text-text-secondary">Title</label>
                            <input type="text" value={currentGoal.title} onChange={e => setCurrentGoal({ ...currentGoal, title: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Description</label>
                            <textarea value={currentGoal.description} onChange={e => setCurrentGoal({ ...currentGoal, description: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border h-24"></textarea>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <label className="block text-sm font-medium text-text-secondary">Category</label>
                                <select value={currentGoal.category} onChange={e => setCurrentGoal({ ...currentGoal, category: e.target.value as GoalCategory })} className="w-full bg-background p-2 rounded-md border border-border">
                                    {GOAL_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Target Date</label>
                                <input type="date" value={currentGoal.targetDate?.split('T')[0]} onChange={e => setCurrentGoal({ ...currentGoal, targetDate: e.target.value })} className="w-full bg-background p-2 rounded-md border border-border" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Progress ({currentGoal.progress || 0}%)</label>
                            <input type="range" min="0" max="100" value={currentGoal.progress} onChange={e => setCurrentGoal({ ...currentGoal, progress: parseInt(e.target.value) })} className="w-full" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary">Status</label>
                            <select value={currentGoal.status} onChange={e => setCurrentGoal({ ...currentGoal, status: e.target.value as GoalStatus })} className="w-full bg-background p-2 rounded-md border border-border">
                                {GOAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-4">
                            <button onClick={closeModal} disabled={isSaving} className="bg-surface hover:bg-border text-text-primary font-bold py-2 px-4 rounded-md disabled:opacity-50">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? 'Saving...' : 'Save Goal'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
