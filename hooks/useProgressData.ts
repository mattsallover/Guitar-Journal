import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';

export function useProgressData(focus?: string) {
  const { state } = useAppContext();

  const progressData = useMemo(() => {
    if (!focus) {
      return {
        totalSessions: state.practiceSessions.length,
        totalTime: state.practiceSessions.reduce((sum, s) => sum + s.duration, 0),
        sessions: []
      };
    }

    const lowerCaseFocus = focus.toLowerCase();
    const filteredSessions = state.practiceSessions
      .filter(session =>
        (session.songs && session.songs.some(s => s.toLowerCase().includes(lowerCaseFocus))) ||
        (session.techniques && session.techniques.some(t => t.toLowerCase().includes(lowerCaseFocus)))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalTime = filteredSessions.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalSessions: filteredSessions.length,
      totalTime,
      sessions: filteredSessions
    };
  }, [focus, state.practiceSessions]);

  return progressData;
}