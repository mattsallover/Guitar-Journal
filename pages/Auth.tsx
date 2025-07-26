import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { state } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if user is already signed in on component mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // User is already signed in, AppContext will handle the navigation
        return;
      }
    };

    checkExistingSession();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }

      // The redirect will happen automatically
    } catch (err: any) {
      console.error("Google sign-in failed:", err);
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        throw error;
      }
      // onAuthStateChanged in AppContext will handle navigating away
    } catch (err: any) {
      console.error("Anonymous sign-in failed:", err);
      setError('Failed to sign in anonymously. Please check your internet connection.');
      setIsLoading(false);
    }
  };

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full bg-surface p-8 rounded-xl shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-surface p-8 rounded-xl shadow-lg border border-border">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Guitar<span className="text-text-primary">Journal</span>
          </h1>
          <p className="text-text-secondary">Your digital companion for musical growth</p>
        </div>

        {/* Sign-in Options */}
        <div className="space-y-4">
          {/* Google Sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-border rounded-lg bg-white hover:bg-gray-50 text-gray-900 font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-text-secondary">or</span>
            </div>
          </div>

          {/* Anonymous Sign-in */}
          <button
            onClick={handleAnonymousSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-border rounded-lg bg-background hover:bg-surface text-text-primary font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {isLoading ? 'Starting...' : 'Try Without Account'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="mt-8 text-center text-sm text-text-secondary">
          <p className="mb-3">✨ Track your practice sessions</p>
          <p className="mb-3">🎸 Build your repertoire</p>
          <p className="mb-3">🎯 Set and achieve goals</p>
          <p>🧠 Get personalized AI coaching</p>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 text-xs text-text-secondary text-center">
          <p>
            Your practice data is private and secure. 
            {' '}
            <span className="text-primary">Anonymous mode</span> lets you try the app without creating an account.
          </p>
        </div>
      </div>
    </div>
  );
};