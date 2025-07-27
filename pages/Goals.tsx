import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Goal, GoalStatus, GoalCategory } from '../types';
import { Modal } from '../components/Modal';
import { GOAL_STATUS_OPTIONS, GOAL_CATEGORY_OPTIONS } from '../constants';
import { supabase } from '../services/supabase';
import * as aiService from '../services/aiService';


export const Goals: React.FC = () => {
    const { state, refreshData } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentGoal, setCurrentGoal] = useState<Partial<Goal> | null>(null);
    const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [goalSuggestions, setGoalSuggestions] = useState<any[]>([]);

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
            const goalData = {
                user_id: state.user.uid,
                title: currentGoal.title || '',
                description: currentGoal.description || '',
                target_date: currentGoal.targetDate || new Date().toISOString().split('T')[0],
                status: currentGoal.status || GoalStatus.Active,
                progress: currentGoal.progress || 0,
                category: currentGoal.category || GoalCategory.Technique,
            };

            if (currentGoal.id) {
                const { error } = await supabase
                    .from('goals')
                    .update(goalData)
                    .eq('id', currentGoal.id);
                
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('goals')
                    .insert([goalData]);
                
                if (error) throw error;
            }
            await refreshData();
            closeModal();
        } catch (error) {
            console.error("Error saving goal:", error);
            alert("Failed to save goal. Check your internet connection or Supabase configuration.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if(window.confirm('Are you sure you want to delete this goal?')){
            try {
                const { error } = await supabase
                    .from('goals')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                await refreshData();
            } catch (error) {
                console.error("Error deleting goal:", error);
                alert("Failed to delete goal. Please try again.");
            }
        }
    };
    
    const generateGoalSuggestions = async () => {
        if (!state.user) return;
        setLoadingSuggestions(true);
        
        try {
            const suggestions = await aiService.generateGoalSuggestions({
                practiceSessions: state.practiceSessions.slice(-30),
                repertoire: state.repertoire,
                goals: state.goals,
                noteFinder: [], // Add note finder data if available
            });
            
            setGoalSuggestions(suggestions);
            setShowSuggestions(true);
        } catch (error) {
            console.error("Error generating goal suggestions:", error);
            alert("Failed to generate goal suggestions. Please try again.");
        } finally {
            setLoadingSuggestions(false);
        }
    };
    
    const createGoalFromSuggestion = (suggestion: any) => {
        openModal({
            title: suggestion.title,
            description: suggestion.description,
            category: suggestion.category,
            targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
            status: GoalStatus.Active,
            progress: 0,
        });
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
                <div>
                    <h1 className="text-4xl font-bold text-text-primary">Your Goals</h1>
                    <p className="text-text-secondary mt-1">Track your musical aspirations and progress</p>
                </div>
                <button 
                    onClick={() => openModal()} 
                    className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                    title="Set a new practice goal"
                >
                    <span>+</span>
                    <span>Set New Goal</span>
                </button>
            </div>
            
            {/* AI Goal Suggestions Section */}
            {state.practiceSessions.length > 0 && (
                <div className="bg-surface p-6 rounded-lg mb-6 border border-border/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="text-2xl">🎯</div>
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">AI Goal Suggestions</h2>
                                <p className="text-sm text-text-secondary">Get personalized goal recommendations based on your practice data</p>
                            </div>
                        </div>
                        <button
                            onClick={generateGoalSuggestions}
                            disabled={loadingSuggestions}
                            className="bg-secondary hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingSuggestions ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <span>✨</span>
                                    <span>Suggest Goals</span>
                                </>
                            )}
                        </button>
                    </div>
                    
                    {showSuggestions && goalSuggestions.length > 0 && (
                        <div className="space-y-4">
                            {goalSuggestions.map((suggestion, index) => (
                                <div key={index} className="bg-background/50 p-4 rounded-lg border border-border/30 hover:bg-background/70 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <h3 className="font-semibold text-text-primary">{suggestion.title}</h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    suggestion.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                    suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                    'bg-blue-500/20 text-blue-300'
                                                }`}>
                                                    {suggestion.priority} priority
                                                </span>
                                                <span className="px-2 py-1 rounded-full text-xs bg-secondary/20 text-secondary-300">
                                                    {suggestion.category}
                                                </span>
                                            </div>
                                            <p className="text-text-primary mb-2">{suggestion.description}</p>
                                            <p className="text-sm text-text-secondary italic">{suggestion.reasoning}</p>
                                        </div>
                                        <button
                                            onClick={() => createGoalFromSuggestion(suggestion)}
                                            className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg ml-4 transition-all duration-200 hover:scale-105"
                                        >
                                            Add Goal
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            <div className="mb-4">
                <span className="mr-4 text-text-secondary">Filter:</span>
                <div className="inline-flex space-x-2">
                    <button 
                        onClick={() => setFilterStatus('all')} 
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-surface hover:bg-border'}`}
                    >
                        All ({state.goals.length})
                    </button>
                    <button 
                        onClick={() => setFilterStatus(GoalStatus.Active)} 
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filterStatus === GoalStatus.Active ? 'bg-primary text-white' : 'bg-surface hover:bg-border'}`}
                    >
                        Active ({state.goals.filter(g => g.status === GoalStatus.Active).length})
                    </button>
                    <button 
                        onClick={() => setFilterStatus(GoalStatus.Completed)} 
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${filterStatus === GoalStatus.Completed ? 'bg-primary text-white' : 'bg-surface hover:bg-border'}`}
                    >
                        Completed ({state.goals.filter(g => g.status === GoalStatus.Completed).length})
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {filteredGoals.map(goal => (
                    <div key={goal.id} className="bg-surface p-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1 mb-4 sm:mb-0">
                                <div className="flex items-center space-x-2 mb-2">
                                    <h3 className="text-xl font-semibold text-text-primary">{goal.title}</h3>
                                    {goal.status === GoalStatus.Completed && <span className="text-2xl">✅</span>}
                                </div>
                                <div className="flex items-center space-x-4 mb-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary/20 text-secondary-300">
                                        {goal.category}
                                    </span>
                                    <span className="text-sm text-text-secondary">
                                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="mt-2 text-text-primary">{goal.description}</p>
                                <div className="mt-2 w-full sm:w-48">
                                   <p className="text-xs text-left mb-1">{goal.progress}% Complete</p>
                                   <div className="w-full bg-background rounded-full h-2.5">
                                       <div className={`${progressColor(goal.progress)} h-2.5 rounded-full transition-all duration-500`} style={{width: `${goal.progress}%`}}></div>
                                   </div>
                               </div>
                            </div>
                             <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-end flex-wrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                               {goal.status === GoalStatus.Active && (
                                   <button 
                                      onClick={() => handleStartPractice(goal.title)} 
                                     className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md text-sm whitespace-nowrap transition-all duration-200 hover:scale-105"
                                      title="Start practicing this goal"
                                   >
                                      🚀 Practice
                                   </button>
                               )}
                               <Link 
                                  to={`/progression?focus=${encodeURIComponent(goal.title)}`} 
                                  className="text-sm text-secondary hover:underline whitespace-nowrap transition-colors duration-200"
                                  title="View your progress on this goal"
                               >
                                  📈 Progress
                               </Link>
                                <button 
                                   onClick={() => openModal(goal)} 
                                   className="text-sm text-primary hover:underline transition-colors duration-200"
                                   title="Edit this goal"
                                >
                                   ✏️ Edit
                                </button>
                                <button 
                                   onClick={() => handleDelete(goal.id)} 
                                   className="text-sm text-red-400 hover:underline transition-colors duration-200"
                                   title="Delete this goal"
                                >
                                   🗑️ Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredGoals.length === 0 && (
                    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
                        <div className="text-6xl mb-6">🎯</div>
                        <h2 className="text-2xl font-bold text-text-primary mb-3">
                            {filterStatus === 'all' ? 'Set Your First Goal' : `No ${filterStatus} Goals`}
                        </h2>
                        <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
                            {filterStatus === 'all' 
                                ? 'Goals help you stay focused and track your musical progress over time.' 
                                : `You don't have any ${filterStatus.toLowerCase()} goals right now.`
                            }
                        </p>
                        {filterStatus === 'all' && (
                            <button 
                                onClick={() => openModal()} 
                                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-md transition-all duration-200 hover:scale-105"
                            >
                                Set Your First Goal
                            </button>
                        )}
                    </div>
                )}
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