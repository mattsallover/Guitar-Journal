
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { auth } from '../services/firebase';
import { DashboardIcon } from './icons/DashboardIcon';
import { LogIcon } from './icons/LogIcon';
import { RepertoireIcon } from './icons/RepertoireIcon';
import { GoalsIcon } from './icons/GoalsIcon';
import { ToolsIcon } from './icons/ToolsIcon';
import { ProgressionIcon } from './icons/ProgressionIcon';

export const Sidebar: React.FC = () => {
    const { state } = useAppContext();
    const [isToolsOpen, setIsToolsOpen] = useState(false);

    const handleLogout = () => {
        auth.signOut();
    };

    const navLinkClasses = "flex items-center px-4 py-3 text-text-secondary hover:bg-surface hover:text-text-primary rounded-md transition-colors duration-200";
    const activeLinkClasses = "bg-primary text-white";

    const navItems = [
        { to: "/", icon: DashboardIcon, label: "Dashboard", exact: true },
        { to: "/log", icon: LogIcon, label: "Practice Log", exact: false },
        { to: "/repertoire", icon: RepertoireIcon, label: "Repertoire", exact: false },
        { to: "/goals", icon: GoalsIcon, label: "Goals", exact: false },
        { to: "/progression", icon: ProgressionIcon, label: "Progression", exact: false }
    ];

    return (
        <div className="bg-background-dark border-r border-border w-64 p-4 flex flex-col h-full fixed">
            <div className="flex items-center mb-8">
                <span className="text-2xl font-bold text-primary">Guitar<span className="text-text-primary">Journal</span></span>
            </div>
            
            <nav className="flex-1 space-y-2">
                {navItems.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.exact} className={({isActive}) => isActive ? `${navLinkClasses} ${activeLinkClasses}` : navLinkClasses}>
                        <item.icon className="w-6 h-6 mr-3" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                <div>
                    <button onClick={() => setIsToolsOpen(!isToolsOpen)} className={`${navLinkClasses} w-full text-left`}>
                        <ToolsIcon className="w-6 h-6 mr-3" />
                        <span>Practice Tools</span>
                        <svg className={`w-4 h-4 ml-auto transition-transform ${isToolsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    {isToolsOpen && (
                        <div className="pl-8 mt-1 space-y-1">
                             <NavLink to="/tools/caged" className={({isActive}) => `${navLinkClasses} py-2 ${isActive ? activeLinkClasses : ''}`}>CAGED Explorer</NavLink>
                             <NavLink to="/tools/note-finder" className={({isActive}) => `${navLinkClasses} py-2 ${isActive ? activeLinkClasses : ''}`}>Note Finder</NavLink>
                             <NavLink to="/tools/scale-practice" className={({isActive}) => `${navLinkClasses} py-2 ${isActive ? activeLinkClasses : ''}`}>Scale Practice</NavLink>
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
