
import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { User, PracticeSession, RepertoireItem, Goal } from '../types';
import { supabase } from '../services/supabase';
import { AuthSession } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  practiceSessions: PracticeSession[];
  repertoire: RepertoireItem[];
  goals: Goal[];
  loading: boolean;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PRACTICE_SESSIONS'; payload: PracticeSession[] }
  | { type: 'SET_REPERTOIRE'; payload: RepertoireItem[] }
  | { type: 'SET_GOALS'; payload: Goal[] };


const initialState: AppState = {
  user: null,
  practiceSessions: [],
  repertoire: [],
  goals: [],
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
    default:
      return state;
  }
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

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
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Ensure user exists in database
    const ensureUserExists = async () => {
      try {
        // First, try to fetch the user
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', state.user!.uid)
          .single();
        
        if (error && error.code === 'PGRST116') {
          // User doesn't exist, create them
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              id: state.user!.uid,
              name: state.user!.name,
              email: state.user!.email
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

    // Fetch practice sessions
    const fetchPracticeSessions = async () => {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('user_id', state.user!.uid)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching practice sessions:', error);
      } else {
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
        dispatch({ type: 'SET_PRACTICE_SESSIONS', payload: sessions });
      }
    };

    // Fetch repertoire
    const fetchRepertoire = async () => {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', state.user!.uid)
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
    
    // Fetch goals
    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', state.user!.uid)
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
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    // Fetch all data
    Promise.all([
      ensureUserExists(),
      fetchPracticeSessions(),
      fetchRepertoire(),
      fetchGoals()
    ]);
  }, [state.user]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
