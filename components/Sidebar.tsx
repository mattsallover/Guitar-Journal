
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

// Book/Journal icon
const BookOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

// Chevron right icon for expand/collapse
const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const Sidebar: React.FC = () => {
    const { state } = useAppContext();
    const [isJournalOpen, setIsJournalOpen] = useState(true);
    const [isToolsOpen, setIsToolsOpen] = useState(false);

    const handleLogout = () => {
        supabase.auth.signOut();
    };

    const navLinkClasses = "flex items-center px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200";
    const subNavLinkClasses = "flex items-center px-8 py-2 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200 text-sm";
    const activeLinkClasses = "bg-primary text-white";
    const sectionButtonClasses = "flex items-center px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200 w-full text-left";

    return (
        <div className="bg-background-dark border-r border-border w-64 p-4 flex flex-col h-full fixed">
            <div className="flex items-center mb-8">
                <span className="text-2xl font-bold text-primary">Guitar<span className="text-text-primary">Journal</span></span>
            </div>
            
            <nav className="flex-1 space-y-2">
                {/* Dashboard - standalone */}
                <NavLink to="/" end className={({isActive}) => isActive ? `${navLinkClasses} ${activeLinkClasses}` : navLinkClasses}>
                    <DashboardIcon className="w-6 h-6 mr-3" />
                    <span>Dashboard</span>
                </NavLink>

                {/* Journal Section */}
                <div>
                    <button 
                        onClick={() => setIsJournalOpen(!isJournalOpen)} 
                        className={sectionButtonClasses}
                    >
                        <BookOpenIcon className="w-6 h-6 mr-3" />
                        <span>Journal</span>
                        <ChevronRightIcon className={`w-4 h-4 ml-auto transition-transform ${isJournalOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isJournalOpen && (
                        <div className="mt-1 space-y-1">
                            <NavLink to="/log" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                <LogIcon className="w-5 h-5 mr-3" />
                                Practice Log
                            </NavLink>
                            <NavLink to="/repertoire" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                <RepertoireIcon className="w-5 h-5 mr-3" />
                                Repertoire
                            </NavLink>
                            <NavLink to="/goals" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                <GoalsIcon className="w-5 h-5 mr-3" />
                                Goals
                            </NavLink>
                            <NavLink to="/progression" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                <ProgressionIcon className="w-5 h-5 mr-3" />
                                Progression
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Practice Tools Section */}
                <div>
                    <button 
                        onClick={() => setIsToolsOpen(!isToolsOpen)} 
                        className={sectionButtonClasses}
                    >
                        <ToolsIcon className="w-6 h-6 mr-3" />
                        <span>Practice Tools</span>
                        <ChevronRightIcon className={`w-4 h-4 ml-auto transition-transform ${isToolsOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isToolsOpen && (
                        <div className="mt-1 space-y-1">
                            <NavLink to="/tools/caged" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                CAGED Explorer
                            </NavLink>
                            <NavLink to="/tools/note-finder" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                Note Finder
                            </NavLink>
                            <NavLink to="/tools/scale-practice" className={({isActive}) => isActive ? `${subNavLinkClasses} ${activeLinkClasses}` : subNavLinkClasses}>
                                Scale Practice
                            </NavLink>
                        </div>
                    )}
                </div>
                    </NavLink>
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
