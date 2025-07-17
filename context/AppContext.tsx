
import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { User, PracticeSession, RepertoireItem, Goal } from '../types';
import { auth, db } from '../services/firebase';

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
    const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        const appUser: User = {
          uid: firebaseUser.uid,
          isAnonymous: firebaseUser.isAnonymous,
          name: firebaseUser.displayName || 'Practice Hero',
          email: firebaseUser.email,
        };
        dispatch({ type: 'SET_USER', payload: appUser });
      } else {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!state.user) {
      dispatch({ type: 'SET_PRACTICE_SESSIONS', payload: [] });
      dispatch({ type: 'SET_REPERTOIRE', payload: [] });
      dispatch({ type: 'SET_GOALS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    const unsubSessions = db.collection('practiceSessions').where("userId", "==", state.user.uid)
        .onSnapshot((snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeSession));
            dispatch({ type: 'SET_PRACTICE_SESSIONS', payload: data });
        }, (error) => console.error(`Error fetching practiceSessions:`, error));

    const unsubRepertoire = db.collection('repertoire').where("userId", "==", state.user.uid)
        .onSnapshot((snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepertoireItem));
            dispatch({ type: 'SET_REPERTOIRE', payload: data });
        }, (error) => console.error(`Error fetching repertoire:`, error));
    
    const unsubGoals = db.collection("goals").where("userId", "==", state.user.uid).onSnapshot((snapshot) => {
        const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
        dispatch({ type: 'SET_GOALS', payload: goals });
        dispatch({ type: 'SET_LOADING', payload: false }); // Last fetch toggles loading off
    }, (error) => console.error("Error fetching goals:", error));


    return () => {
      unsubSessions();
      unsubRepertoire();
      unsubGoals();
    };
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
