import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Hydrate from any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(normalizeSupabaseUser(session.user));
        setIsAuthenticated(true);
      }
      setIsLoadingAuth(false);
    });

    // Keep auth state in sync with Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(normalizeSupabaseUser(session.user));
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/AuthPortal';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      // Kept for API compatibility with components that destructure these
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
