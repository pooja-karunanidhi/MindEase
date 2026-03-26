import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'doctor' | 'admin';
  isVerified: boolean;
  doctorProfile?: any;
}

interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          await mapSupabaseUserToAppUser(session.user);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        if (session?.user) {
          await mapSupabaseUserToAppUser(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in onAuthStateChange:', error);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapSupabaseUserToAppUser = async (sbUser: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*, doctor_profiles(*)')
        .eq('id', sbUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Fallback to metadata if profile fetch fails
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          name: sbUser.user_metadata?.name || 'User',
          role: sbUser.user_metadata?.role || 'user',
          isVerified: !!sbUser.email_confirmed_at,
        });
      } else {
        setUser({
          id: sbUser.id,
          email: sbUser.email || '',
          name: profile.name,
          role: profile.role,
          isVerified: !!sbUser.email_confirmed_at,
          doctorProfile: profile.doctor_profiles?.[0]
        });
      }
    } catch (error) {
      console.error('Unexpected error in mapSupabaseUserToAppUser:', error);
      // Fallback to metadata
      setUser({
        id: sbUser.id,
        email: sbUser.email || '',
        name: sbUser.user_metadata?.name || 'User',
        role: sbUser.user_metadata?.role || 'user',
        isVerified: !!sbUser.email_confirmed_at,
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
