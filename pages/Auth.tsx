
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { state } = useAppContext();
  const [message, setMessage] = useState('Initializing your journal...');
  const [error, setError] = useState('');

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          throw error;
        }
        // onAuthStateChanged in AppContext will handle navigating away
      } catch (err: any) {
        console.error("Anonymous sign-in failed:", err);
        setError('Failed to initialize. Please check your internet connection and ensure your Supabase configuration is correct.');
        setMessage('Initialization Error');
      }
    };

    // Auth state change listener will give us the user, but we need to sign in if no one is there.
    // The listener in AppContext handles the user state, but this page triggers the initial sign-in.
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user && !state.loading) {
        await initUser();
      }
    };

    checkAuth();
    
  }, [state.loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full bg-surface p-8 rounded-xl shadow-lg text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Guitar<span className="text-text-primary">Journal</span></h1>
        <p className="text-text-secondary mb-8">Your digital companion for musical growth.</p>
        
        <div className="p-4 rounded-lg bg-background">
          <h2 className="text-xl font-bold">{message}</h2>
          {error ? (
             <p className="text-red-400 mt-4 text-sm">{error}</p>
          ) : (
            <div className="mt-4 text-text-secondary animate-pulse">Loading your data...</div>
          )}
        </div>
      </div>
    </div>
  );
};
