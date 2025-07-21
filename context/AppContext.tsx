
import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { User, PracticeSession, RepertoireItem, Goal, CAGEDSession, NoteFinderAttempt, PracticePlaylist } from '../types';
import { supabase } from '../services/supabase';
import { AuthSession } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  practiceSessions: PracticeSession[];
  repertoire: RepertoireItem[];
  goals: Goal[];
  cagedSessions: CAGEDSession[];
  noteFinderAttempts: NoteFinderAttempt[];
  playlists: PracticePlaylist[];
  loading: boolean;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PRACTICE_SESSIONS'; payload: PracticeSession[] }
  | { type: 'SET_REPERTOIRE'; payload: RepertoireItem[] }
  | { type: 'SET_GOALS'; payload: Goal[] }
  | { type: 'SET_CAGED_SESSIONS'; payload: CAGEDSession[] }
  | { type: 'SET_PLAYLISTS'; payload: PracticePlaylist[] }
  | { type: 'SET_NOTE_FINDER_ATTEMPTS'; payload: NoteFinderAttempt[] };


const initialState: AppState = {
  user: null,
  practiceSessions: [],
  repertoire: [],
  goals: [],
  cagedSessions: [],
  noteFinderAttempts: [],
  playlists: [],
  loading: true,
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_PRACTICE_SESSIONS':
      return { ...state, practiceSessions: action.payload };
    case 'SET_REPERTOIRE':
      return { ...state, repertoire: action.payload };
    case 'SET_GOALS':
      return { ...state, goals: action.payload };
    case 'SET_CAGED_SESSIONS':
      return { ...state, cagedSessions: action.payload };
    case 'SET_PLAYLISTS':
      return { ...state, playlists: action.payload };
    case 'SET_NOTE_FINDER_ATTEMPTS':
      return { ...state, noteFinderAttempts: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action>; refreshData: () => Promise<void> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Extract data fetching functions so they can be called independently
  const ensureUserExists = async (user: User) => {
    try {
      // First, try to fetch the user
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.uid)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // User doesn't exist, create them
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: user.uid,
            name: user.name,
            email: user.email
          }]);
        
        if (insertError) {
          console.error('Error creating user profile:', insertError);
        }
      } else if (error) {
        console.error('Error checking user existence:', error);
      }
    } catch (err) {
      console.error('Error ensuring user exists:', err);
    }
  };

  const fetchPracticeSessions = async (user: User) => {
    console.log('Fetching practice sessions for user:', user.uid);
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', user.uid)
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching practice sessions:', error);
    } else {
      console.log('Raw practice sessions data from database:', data);
      const sessions: PracticeSession[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        duration: row.duration,
        mood: row.mood,
        techniques: row.techniques || [],
        songs: row.songs || [],
        notes: row.notes,
        tags: row.tags || [],
        recordings: row.recordings || [],
        link: row.link || '',
      }));
      console.log('Mapped practice sessions:', sessions);
      dispatch({ type: 'SET_PRACTICE_SESSIONS', payload: sessions });
    }
  };

  const fetchRepertoire = async (user: User) => {
    const { data, error } = await supabase
      .from('repertoire')
      .select('*')
      .eq('user_id', user.uid)
      .order('title');
    
    if (error) {
      console.error('Error fetching repertoire:', error);
    } else {
      const repertoire: RepertoireItem[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        artist: row.artist,
        difficulty: row.difficulty,
        mastery: row.mastery,
        dateAdded: row.date_added,
        lastPracticed: row.last_practiced,
        notes: row.notes,
      }));
      dispatch({ type: 'SET_REPERTOIRE', payload: repertoire });
    }
  };
  
  const fetchCAGEDSessions = async (user: User) => {
    const { data, error } = await supabase
      .from('caged_sessions')
      .select('*')
      .eq('user_id', user.uid)
      .order('session_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching CAGED sessions:', error);
    } else {
      const sessions: CAGEDSession[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        sessionDate: row.session_date,
        shapes: row.shapes,
        accuracy: row.accuracy,
        timeSeconds: row.time_seconds,
        score: row.score,
        notes: row.notes || '',
        recording: row.recording || '',
        createdAt: row.created_at,
      }));
      dispatch({ type: 'SET_CAGED_SESSIONS', payload: sessions });
    }
  };

  const fetchNoteFinderAttempts = async (user: User) => {
    const { data, error } = await supabase
      .from('note_finder_practice')
      .select('*')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching note finder attempts:', error);
    } else {
      const attempts: NoteFinderAttempt[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        sessionDate: row.session_date,
        noteName: row.note_name,
        stringNum: row.string_num,
        fretNum: row.fret_num,
        correct: row.correct,
        timeSeconds: row.time_seconds,
        createdAt: row.created_at,
      }));
      dispatch({ type: 'SET_NOTE_FINDER_ATTEMPTS', payload: attempts });
    }
  };
  const fetchGoals = async (user: User) => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching goals:', error);
    } else {
      const goals: Goal[] = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        targetDate: row.target_date,
        status: row.status,
        progress: row.progress,
        category: row.category,
      }));
      dispatch({ type: 'SET_GOALS', payload: goals });
    }
  };

  // Function to refresh all data - can be called by other components
  const refreshData = async () => {
    if (!state.user) return;
    
    try {
      await Promise.all([
        fetchPracticeSessions(state.user),
        fetchRepertoire(state.user),
        fetchGoals(state.user),
        fetchCAGEDSessions(state.user),
        fetchNoteFinderAttempts(state.user)
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const appUser: User = {
          uid: session.user.id,
          isAnonymous: session.user.is_anonymous || false,
          name: session.user.user_metadata?.name || 'Practice Hero',
          email: session.user.email || null,
        };
        dispatch({ type: 'SET_USER', payload: appUser });
      } else {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const appUser: User = {
          uid: session.user.id,
          isAnonymous: session.user.is_anonymous || false,
          name: session.user.user_metadata?.name || 'Practice Hero',
          email: session.user.email || null,
        };
        dispatch({ type: 'SET_USER', payload: appUser });
      } else {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.user) {
      dispatch({ type: 'SET_PRACTICE_SESSIONS', payload: [] });
      dispatch({ type: 'SET_REPERTOIRE', payload: [] });
      dispatch({ type: 'SET_GOALS', payload: [] });
      dispatch({ type: 'SET_CAGED_SESSIONS', payload: [] });
      dispatch({ type: 'SET_NOTE_FINDER_ATTEMPTS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    // Fetch all data
    Promise.all([
      ensureUserExists(state.user),
      fetchPracticeSessions(state.user),
      fetchRepertoire(state.user),
      fetchGoals(state.user),
      fetchCAGEDSessions(state.user),
      fetchNoteFinderAttempts(state.user)
    ]).then(() => {
      dispatch({ type: 'SET_LOADING', payload: false });
    });
  }, [state.user]);

  return (
    <AppContext.Provider value={{ state, dispatch, refreshData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): { state: AppState; dispatch: React.Dispatch<Action>; refreshData: () => Promise<void> } => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
