
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { LogIcon } from './icons/LogIcon';
import { RepertoireIcon } from './icons/RepertoireIcon';
import { GoalsIcon } from './icons/GoalsIcon';
import { ToolsIcon } from './icons/ToolsIcon';

export const Sidebar: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [showPracticeModal, setShowPracticeModal] = React.useState(false);
    const [isJournalOpen, setIsJournalOpen] = useState(true); // Open by default
    const [isToolsOpen, setIsToolsOpen] = useState(false); // Closed by default

    const handleLogout = () => {
        supabase.auth.signOut();
    };

    const handleOpenPracticeModal = () => {
        setShowPracticeModal(true);
    };

    const handleLogPastSession = () => {
        setShowPracticeModal(false);
        navigate('/log');
    };

    const handleAddNewSong = () => {
        navigate('/repertoire', { state: { openModal: true } });
    };

    const handleSetNewGoal = () => {
        navigate('/goals', { state: { openModal: true } });
    };

    const navLinkClasses = "flex items-center px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-all duration-300 hover:scale-[1.02]";
    const subNavLinkClasses = "flex items-center pl-12 pr-4 py-2 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-all duration-300 hover:translate-x-1";
    const activeLinkClasses = "bg-primary text-white";
    const groupButtonClasses = "flex items-center w-full px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-all duration-300 text-left";

    const journalItems = [
        { to: "/log", icon: LogIcon, label: "Log Sessions", exact: false },
        { to: "/repertoire", icon: RepertoireIcon, label: "Repertoire", exact: false },
        { to: "/goals", icon: GoalsIcon, label: "Track Goals", exact: false }
    ];

    const toolItems = [
        { to: "/tools/caged", label: "CAGED Explorer", exact: false },
        { to: "/tools/note-finder", label: "Note Finder", exact: false },
        { to: "/tools/scale-practice", label: "Scale Practice", exact: false }
    ];

    // Import the PracticeStartModal component
    const PracticeStartModal = React.lazy(() => import('./PracticeStartModal').then(module => ({ default: module.PracticeStartModal })));
    return (
        <div className="bg-background-dark border-r border-border w-64 p-4 flex flex-col h-full fixed">
            <div className="flex items-center mb-8">
                <span className="text-2xl font-bold text-primary">Guitar<span className="text-text-primary">Journal</span></span>
            </div>
            
            {/* Quick Actions */}
            <div className="mb-8 bg-surface p-4 rounded-lg border border-primary/20">
                <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">Quick Actions</h3>
                <div className="space-y-2">
                    <button 
                        onClick={handleOpenPracticeModal}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] flex items-center space-x-2 text-sm"
                    >
                        <span>🎸</span>
                        <span>Start Practice</span>
                    </button>
                    <button 
                        onClick={handleAddNewSong}
                        className="w-full bg-secondary hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] flex items-center space-x-2 text-sm"
                    >
                        <span>🎵</span>
                        <span>Add Song</span>
                    </button>
                    <button 
                        onClick={handleSetNewGoal}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] flex items-center space-x-2 text-sm"
                    >
                        <span>🎯</span>
                        <span>Set Goal</span>
                    </button>
                </div>
            </div>
            
            <nav className="flex-1 space-y-2">
                {/* Journal Section */}
                <div>
                    <button 
                        onClick={() => setIsJournalOpen(!isJournalOpen)} 
                        className={`${groupButtonClasses} group`}
                        title="Your practice journal and progress tracking"
                    >
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-5.247-8.242l10.494 4.99m-10.494 0l10.494-4.99m-10.494-2.508l10.494 9.994" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="flex-1">Journal</span>
                        <svg className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isJournalOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${isJournalOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="mt-1 space-y-1 pb-1">
                            {journalItems.map(item => (
                                <NavLink 
                                    key={item.to} 
                                    to={item.to} 
                                    end={item.exact} 
                                    className={({isActive}) => `${subNavLinkClasses} ${isActive ? activeLinkClasses : ''} group`}
                                    title={`Go to ${item.label}`}
                                >
                                    <item.icon className="w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110" />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Practice Tools Section */}
                <div>
                    <button 
                        onClick={() => setIsToolsOpen(!isToolsOpen)} 
                        className={`${groupButtonClasses} group`}
                        title="Interactive tools for focused practice"
                    >
                        <ToolsIcon className="w-6 h-6 mr-3" />
                        <span className="flex-1">Practice Tools</span>
                        <svg className={`w-4 h-4 ml-auto transition-transform duration-300 group-hover:scale-110 ${isToolsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${isToolsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="mt-1 space-y-1 pb-1">
                            {toolItems.map(item => (
                                <NavLink 
                                    key={item.to} 
                                    to={item.to} 
                                    end={item.exact} 
                                    className={({isActive}) => `${subNavLinkClasses} ${isActive ? activeLinkClasses : ''} group`}
                                    title={getToolDescription(item.label)}
                                >
                                    <div className="w-5 h-5 mr-3 flex items-center justify-center">
                                        {item.label === 'CAGED Explorer' && (
                                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        )}
                                        {item.label === 'Note Finder' && (
                                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        )}
                                        {item.label === 'Scale Practice' && (
                                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-13c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        )}
                                    </div>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="mt-auto">
                <div className="p-4 bg-surface rounded-lg transition-all duration-300 hover:bg-surface/80">
                    <p className="font-semibold text-text-primary">{state.user?.name}</p>
                    <p className="text-sm text-text-secondary">{state.user?.email || 'Anonymous User'}</p>
                    <button 
                        onClick={handleLogout} 
                        className="w-full mt-4 text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-200 hover:translate-x-1"
                        title="Sign out of your account"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Practice Start Modal */}
            <React.Suspense fallback={<div>Loading...</div>}>
                <PracticeStartModal
                    isOpen={showPracticeModal}
                    onClose={() => setShowPracticeModal(false)}
                    onLogPastSession={handleLogPastSession}
                />
            </React.Suspense>
        </div>
    );
};

const getToolDescription = (toolName: string): string => {
    switch (toolName) {
        case 'CAGED Explorer':
            return 'Learn chord shapes with interactive quizzes';
        case 'Note Finder':
            return 'Master fretboard note locations';
        case 'Scale Practice':
            return 'Coming soon - scale pattern practice';
        default:
            return '';
    }
};
