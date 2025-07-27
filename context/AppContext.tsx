
import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { User, PracticeSession, RepertoireItem, Goal, CAGEDSession, NoteFinderAttempt } from '../types';
import { supabase } from '../services/supabase';
import { AuthSession } from '@supabase/supabase-js';
import { ALL_NOTES } from '../constants';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface AppState {
  user: User | null;
  practiceSessions: PracticeSession[];
  repertoire: RepertoireItem[];
  goals: Goal[];
  cagedSessions: CAGEDSession[];
  noteFinderAttempts: NoteFinderAttempt[];
  isChatModalOpen: boolean;
  chatMessages: ChatMessage[];
  loading: boolean;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PRACTICE_SESSIONS'; payload: PracticeSession[] }
  | { type: 'SET_REPERTOIRE'; payload: RepertoireItem[] }
  | { type: 'SET_GOALS'; payload: Goal[] }
  | { type: 'SET_CAGED_SESSIONS'; payload: CAGEDSession[] }
  | { type: 'SET_NOTE_FINDER_ATTEMPTS'; payload: NoteFinderAttempt[] }
  | { type: 'TOGGLE_CHAT_MODAL'; payload: boolean }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_CHAT_MESSAGES' };


// Sample data population function
const populateSampleData = async (userId: string) => {
  console.log('Populating sample data for new user:', userId);

  const samplePracticeSessions = [
    {
      user_id: userId,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      duration: 45,
      mood: 'Good',
      techniques: ['Alternate Picking', 'Legato'],
      songs: ['Stairway to Heaven'],
      notes: 'Worked on the intro riff and first solo section. Legato feels smoother after focused practice.',
      tags: [],
      recordings: [],
      link: '',
    },
    {
      user_id: userId,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
      duration: 30,
      mood: 'Good',
      techniques: ['Chords'],
      songs: ['Wonderwall'],
      notes: 'Practiced chord changes for the chorus. Getting faster with the transitions!',
      tags: [],
      recordings: [],
      link: '',
    },
    {
      user_id: userId,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day ago
      duration: 60,
      mood: 'Good',
      techniques: ['Fingerpicking', 'Arpeggios'],
      songs: ['Blackbird'],
      notes: 'Working on the fingerpicking pattern. Left hand is getting more comfortable with the chord shapes.',
      tags: [],
      recordings: [],
      link: '',
    },
  ];

  const sampleRepertoire = [
    {
      user_id: userId,
      title: 'Stairway to Heaven',
      artist: 'Led Zeppelin',
      difficulty: 'Advanced',
      mastery: 60,
      date_added: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      last_practiced: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Focus on dynamics and phrasing in the acoustic intro. The solo is challenging but making progress.',
    },
    {
      user_id: userId,
      title: 'Wonderwall',
      artist: 'Oasis',
      difficulty: 'Intermediate',
      mastery: 85,
      date_added: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      last_practiced: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Almost have this one down! Just need to work on the strumming pattern consistency.',
    },
    {
      user_id: userId,
      title: 'Blackbird',
      artist: 'The Beatles',
      difficulty: 'Intermediate',
      mastery: 45,
      date_added: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      last_practiced: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Beautiful fingerpicking song. The chord changes are tricky but very rewarding when done right.',
    },
  ];

  const sampleGoals = [
    {
      user_id: userId,
      title: 'Master Barre Chords',
      description: 'Be able to play all major and minor barre chords cleanly across the fretboard.',
      target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      status: 'Active',
      progress: 40,
      category: 'Technique',
    },
    {
      user_id: userId,
      title: 'Learn "Sweet Child o\' Mine" Solo',
      description: 'Learn the entire solo from Sweet Child o\' Mine by Guns N\' Roses.',
      target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
      status: 'Active',
      progress: 15,
      category: 'Song',
    },
    {
      user_id: userId,
      title: 'Complete "Blackbird" with perfect fingerpicking',
      description: 'Master the fingerpicking pattern and be able to play Blackbird smoothly from start to finish.',
      target_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 45 days from now
      status: 'Active',
      progress: 30,
      category: 'Song',
    },
  ];

  const sampleCagedSessions = [
    {
      user_id: userId,
      session_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shapes: ['C', 'A', 'G'],
      accuracy: 3,
      time_seconds: 120,
      score: 65,
      notes: 'Focused on C, A, and G shapes. Accuracy needs work on the higher frets.',
      recording: '',
    },
    {
      user_id: userId,
      session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shapes: ['E', 'D'],
      accuracy: 4,
      time_seconds: 90,
      score: 78,
      notes: 'E and D shapes are getting more comfortable. Good progress!',
      recording: '',
    },
  ];

  const sampleNoteFinderAttempts = [
    {
      user_id: userId,
      session_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note_name: 'A',
      string_num: 6,
      fret_num: 5,
      correct: true,
      time_seconds: 2,
    },
    {
      user_id: userId,
      session_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note_name: 'C#',
      string_num: 4,
      fret_num: 4,
      correct: false,
      time_seconds: 5,
    },
    {
      user_id: userId,
      session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note_name: 'G',
      string_num: 3,
      fret_num: 0,
      correct: true,
      time_seconds: 1,
    },
    {
      user_id: userId,
      session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      note_name: 'F#',
      string_num: 1,
      fret_num: 2,
      correct: true,
      time_seconds: 3,
    },
  ];

  try {
    await Promise.all([
      supabase.from('practice_sessions').insert(samplePracticeSessions),
      supabase.from('repertoire').insert(sampleRepertoire),
      supabase.from('goals').insert(sampleGoals),
      supabase.from('caged_sessions').insert(sampleCagedSessions),
      supabase.from('note_finder_practice').insert(sampleNoteFinderAttempts),
    ]);
    console.log('Sample data populated successfully!');
  } catch (error) {
    console.error('Error populating sample data:', error);
  }
};

const initialState: AppState = {
  user: null,
  practiceSessions: [],
  repertoire: [],
  goals: [],
  cagedSessions: [],
  noteFinderAttempts: [],
  isChatModalOpen: false,
  chatMessages: [],
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
    case 'SET_NOTE_FINDER_ATTEMPTS':
      return { ...state, noteFinderAttempts: action.payload };
    case 'TOGGLE_CHAT_MODAL':
      return { ...state, isChatModalOpen: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'CLEAR_CHAT_MESSAGES':
      return { ...state, chatMessages: [] };
    default:
      return state;
  }
};

const AppContext = createContext<{ 
  state: AppState; 
  dispatch: React.Dispatch<Action>; 
  refreshData: () => Promise<void>;
  openChatModal: () => void;
  closeChatModal: () => void;
  addChatMessage: (sender: 'user' | 'ai', text: string) => void;
  clearChatMessages: () => void;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Extract data fetching functions so they can be called independently
  const ensureUserExists = async (user: User): Promise<{ hasOnboarded: boolean }> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, has_onboarded')
        .eq('id', user.uid)
        .maybeSingle();
      
      if (!data) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: user.uid,
            name: user.name,
            email: user.email,
            has_onboarded: false
          }]);
        
        if (insertError) {
          console.error('Error creating user profile:', insertError);
          throw insertError;
        }
        return { hasOnboarded: false };
      } else if (error) {
        console.error('Error checking user existence:', error);
        throw error;
      }
      return { hasOnboarded: data.has_onboarded || false };
    } catch (err) {
      console.error('Error ensuring user exists:', err);
      // Return default values instead of throwing to prevent auth blocking
      return { hasOnboarded: false };
    }
  };

  // Clear user data function
  const clearUserData = async (userId: string) => {
    console.log('Clearing all user data for:', userId);
    try {
      await Promise.all([
        supabase.from('practice_sessions').delete().eq('user_id', userId),
        supabase.from('repertoire').delete().eq('user_id', userId),
        supabase.from('goals').delete().eq('user_id', userId),
        supabase.from('caged_sessions').delete().eq('user_id', userId),
        supabase.from('note_finder_practice').delete().eq('user_id', userId),
      ]);
      console.log('All user data cleared successfully!');
      await refreshData();
    } catch (error) {
      console.error('Error clearing user data:', error);
      alert('Failed to clear data. Please try again.');
    }
  };

  // Update user onboarding status
  const updateUserOnboardingStatus = async (status: boolean) => {
    if (!state.user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ has_onboarded: status })
        .eq('id', state.user.uid);

      if (error) throw error;

      // Update the user object in the state
      dispatch({
        type: 'SET_USER',
        payload: { ...state.user, hasOnboarded: status }
      });
      console.log(`User onboarding status updated to ${status}`);
    } catch (error) {
      console.error('Error updating onboarding status:', error);
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

  // Chat functions
  const openChatModal = () => {
    dispatch({ type: 'TOGGLE_CHAT_MODAL', payload: true });
  };

  const closeChatModal = () => {
    dispatch({ type: 'TOGGLE_CHAT_MODAL', payload: false });
  };

  const addChatMessage = (sender: 'user' | 'ai', text: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date()
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  };

  const clearChatMessages = () => {
    dispatch({ type: 'CLEAR_CHAT_MESSAGES' });
  };

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          // Fetch hasOnboarded status
          const { data: userData, error: userFetchError } = await supabase
            .from('users')
            .select('has_onboarded')
            .eq('id', session.user.id)
            .maybeSingle();

          const appUser: User = {
            uid: session.user.id,
            isAnonymous: false,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Guitar Player',
            email: session.user.email || null,
            hasOnboarded: userData?.has_onboarded || false,
          };
          dispatch({ type: 'SET_USER', payload: appUser });
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Still set user even if we can't fetch onboarding status
          const appUser: User = {
            uid: session.user.id,
            isAnonymous: false,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Guitar Player',
            email: session.user.email || null,
            hasOnboarded: false, // Default to false if we can't fetch
          };
          dispatch({ type: 'SET_USER', payload: appUser });
        }
      } else {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }).catch(error => {
      console.error('Error getting initial session:', error);
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          // Fetch hasOnboarded status
          const { data: userData, error: userFetchError } = await supabase
            .from('users')
            .select('has_onboarded')
            .eq('id', session.user.id)
            .maybeSingle();

          const appUser: User = {
            uid: session.user.id,
            isAnonymous: false,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Guitar Player',
            email: session.user.email || null,
            hasOnboarded: userData?.has_onboarded || false,
          };
          dispatch({ type: 'SET_USER', payload: appUser });
        } catch (error) {
          console.error('Error fetching user data on auth change:', error);
          // Still set user even if we can't fetch onboarding status
          const appUser: User = {
            uid: session.user.id,
            isAnonymous: false,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Guitar Player',
            email: session.user.email || null,
            hasOnboarded: false, // Default to false if we can't fetch
          };
          dispatch({ type: 'SET_USER', payload: appUser });
        }
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
    const initializeUserData = async () => {
      try {
        const { hasOnboarded } = await ensureUserExists(state.user);

        // Check if user has any existing practice sessions
        const { count, error: countError } = await supabase
          .from('practice_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', state.user.uid);

        if (countError) {
          console.error('Error checking for existing data:', countError);
        } else if (!hasOnboarded && count === 0) {
          // User has not onboarded and no existing data, populate sample data
          console.log('New user detected, populating sample data...');
          await populateSampleData(state.user.uid);
        }

        // Fetch all data (including newly populated sample data if applicable)
        await Promise.all([
          fetchPracticeSessions(state.user),
          fetchRepertoire(state.user),
          fetchGoals(state.user),
          fetchCAGEDSessions(state.user),
          fetchNoteFinderAttempts(state.user)
        ]);
      } catch (error) {
        console.error('Error initializing user data:', error);
        // Still try to fetch basic data even if initialization fails
        try {
          await Promise.all([
            fetchPracticeSessions(state.user),
            fetchRepertoire(state.user),
            fetchGoals(state.user),
            fetchCAGEDSessions(state.user),
            fetchNoteFinderAttempts(state.user)
          ]);
        } catch (fetchError) {
          console.error('Error fetching user data:', fetchError);
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeUserData();
  }, [state.user]);

  return (
    <AppContext.Provider value={{ 
      state, 
      dispatch, 
      refreshData, 
      openChatModal, 
      closeChatModal, 
      addChatMessage, 
      clearChatMessages,
      clearUserData,
      updateUserOnboardingStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): { 
  state: AppState; 
  dispatch: React.Dispatch<Action>; 
  refreshData: () => Promise<void>;
  openChatModal: () => void;
  closeChatModal: () => void;
  addChatMessage: (sender: 'user' | 'ai', text: string) => void;
  clearChatMessages: () => void;
  clearUserData: (userId: string) => Promise<void>;
  updateUserOnboardingStatus: (status: boolean) => Promise<void>;
} => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
