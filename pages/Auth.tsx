import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { state } = useAppContext();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      let data, error;
      
      if (isSignUp) {
        ({ data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            emailRedirectTo: window.location.origin
          }
        }));
        
        if (!error && data.user && !data.user.email_confirmed_at) {
          setError('Success! Please check your email to verify your account before signing in.');
          setIsSignUp(false);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setIsLoading(false);
          return;
        }
      } else {
        ({ data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        }));
      }

      if (error) {
        throw error;
      }

      // The auth state change will be handled by AppContext
    } catch (err: any) {
      console.error("Authentication failed:", err);
      
      // Handle specific error messages
      if (err.message.includes('Invalid API key')) {
        setError('Configuration Error: Invalid Supabase API key. Please check your .env file and ensure VITE_SUPABASE_ANON_KEY is correct. Restart the development server after making changes.');
      } else if (err.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.');
      } else if (err.message.includes('User already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}. Please try again.`);
      }
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
      if (err.message.includes('Invalid API key')) {
        setError('Configuration Error: Invalid Supabase API key. Please check your .env file and ensure VITE_SUPABASE_ANON_KEY is correct. Restart the development server after making changes.');
      } else {
        setError('Failed to sign in anonymously. Please check your internet connection.');
      }
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
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
          {/* Email/Password Form */}
          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-border rounded-lg bg-background text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
                autoComplete="email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-border rounded-lg bg-background text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>
            
            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>
          
          {/* Auth Button */}
          <button
            onClick={handleEmailAuth}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            {isLoading ? 
              (isSignUp ? 'Creating Account...' : 'Signing In...') : 
              (isSignUp ? 'Create Account' : 'Sign In')
            }
          </button>
          
          {/* Toggle Auth Mode */}
          <div className="text-center">
            <button
              onClick={toggleAuthMode}
              disabled={isLoading}
              className="text-sm text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

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
            Your practice data is private and secure. Create an account to sync across devices.
            {' '}
            <span className="text-primary">Anonymous mode</span> lets you try the app without creating an account.
          </p>
        </div>
      </div>
    </div>
  );
};