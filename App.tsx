
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { AuthPage } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { PracticeLog } from './pages/PracticeLog';
import { Repertoire } from './pages/Repertoire';
import { RepertoireDetail } from './pages/RepertoireDetail';
import { Goals } from './pages/Goals';
import { Progression } from './pages/Progression';
import { CagedExplorer } from './pages/tools/CagedExplorer';
import { NoteFinder } from './pages/tools/NoteFinder';
import { ScalePractice } from './pages/tools/ScalePractice';
import { Coach } from './pages/Coach';
import { LiveSession } from './pages/LiveSession';
import { FloatingCoach } from './components/FloatingCoach';

const AppContent: React.FC = () => {
    const { state } = useAppContext();

    if (!state.user) {
        return <AuthPage />;
    }

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 overflow-y-auto bg-background">
                 <Routes>
                    <Route path="/" element={<Goals />} />
                    <Route path="/log" element={<PracticeLog />} />
                    <Route path="/repertoire" element={<Repertoire />} />
                    <Route path="/repertoire/:id" element={<RepertoireDetail />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/progression" element={<Progression />} />
                    <Route path="/session/live" element={<LiveSession />} />
                    <Route path="/tools/caged" element={<CagedExplorer />} />
                    <Route path="/tools/note-finder" element={<NoteFinder />} />
                    <Route path="/tools/scale-practice" element={<ScalePractice />} />
                    <Route path="/coach" element={<Coach />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <FloatingCoach />
        </div>
    );
}

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
};

export default App;