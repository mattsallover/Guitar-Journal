
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { DashboardIcon } from './icons/DashboardIcon';
import { LogIcon } from './icons/LogIcon';
import { RepertoireIcon } from './icons/RepertoireIcon';
import { GoalsIcon } from './icons/GoalsIcon';
import { ToolsIcon } from './icons/ToolsIcon';
import { ProgressionIcon } from './icons/ProgressionIcon';

export const Sidebar: React.FC = () => {
    const { state } = useAppContext();
    const [isJournalOpen, setIsJournalOpen] = useState(true); // Open by default
    const [isToolsOpen, setIsToolsOpen] = useState(false); // Closed by default

    const handleLogout = () => {
        supabase.auth.signOut();
    };

    const navLinkClasses = "flex items-center px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200";
    const subNavLinkClasses = "flex items-center pl-12 pr-4 py-2 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200";
    const activeLinkClasses = "bg-primary text-white";
    const groupButtonClasses = "flex items-center w-full px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200 text-left";

    const journalItems = [
        { to: "/log", icon: LogIcon, label: "Practice Log", exact: false },
        { to: "/repertoire", icon: RepertoireIcon, label: "Repertoire", exact: false },
        { to: "/goals", icon: GoalsIcon, label: "Goals", exact: false },
        { to: "/progression", icon: ProgressionIcon, label: "Progression", exact: false }
    ];

    const toolItems = [
        { to: "/tools/caged", label: "CAGED Explorer", exact: false },
        { to: "/tools/note-finder", label: "Note Finder", exact: false },
        { to: "/tools/scale-practice", label: "Scale Practice", exact: false }
    ];

    return (
        <div className="bg-background-dark border-r border-border w-64 p-4 flex flex-col h-full fixed">
            <div className="flex items-center mb-8">
                <span className="text-2xl font-bold text-primary">Guitar<span className="text-text-primary">Journal</span></span>
            </div>
            
            <nav className="flex-1 space-y-2">
                {/* Dashboard - Standalone */}
                <NavLink to="/" end className={({isActive}) => isActive ? `${navLinkClasses} ${activeLinkClasses}` : navLinkClasses}>
                    <DashboardIcon className="w-6 h-6 mr-3" />
                    <span>Dashboard</span>
                </NavLink>

                {/* Journal Section */}
                <div>
                    <button onClick={() => setIsJournalOpen(!isJournalOpen)} className={groupButtonClasses}>
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-5.247-8.242l10.494 4.99m-10.494 0l10.494-4.99m-10.494-2.508l10.494 9.994" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="flex-1">Journal</span>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isJournalOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                    {isJournalOpen && (
                        <div className="mt-1 space-y-1">
                            {journalItems.map(item => (
                                <NavLink 
                                    key={item.to} 
                                    to={item.to} 
                                    end={item.exact} 
                                    className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}
                                >
                                    <item.icon className="w-5 h-5 mr-3" />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>

                {/* Practice Tools Section */}
                <div>
                    <button onClick={() => setIsToolsOpen(!isToolsOpen)} className={groupButtonClasses}>
                        <ToolsIcon className="w-6 h-6 mr-3" />
                        <span className="flex-1">Practice Tools</span>
                        <svg className={`w-4 h-4 ml-auto transition-transform ${isToolsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    {isToolsOpen && (
                        <div className="mt-1 space-y-1">
                            {toolItems.map(item => (
                                <NavLink 
                                    key={item.to} 
                                    to={item.to} 
                                    end={item.exact} 
                                    className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}
                                >
                                    <div className="w-5 h-5 mr-3 flex items-center justify-center">
                                        {item.label === 'CAGED Explorer' && (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        )}
                                        {item.label === 'Note Finder' && (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        )}
                                        {item.label === 'Scale Practice' && (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-13c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        )}
                                    </div>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>
            </nav>

            <div className="mt-auto">
                <div className="p-4 bg-surface rounded-lg">
                    <p className="font-semibold text-text-primary">{state.user?.name}</p>
                    <p className="text-sm text-text-secondary">{state.user?.email || 'Anonymous User'}</p>
                    <button onClick={handleLogout} className="w-full mt-4 text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
