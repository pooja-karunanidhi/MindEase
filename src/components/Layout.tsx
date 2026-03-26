import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, User, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { supabase } from '../lib/supabase';

function ConnectionStatus() {
  const [status, setStatus] = React.useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) {
          const message = error.message || '';
          // PGRST116 means table exists but is empty, 42P01 means table doesn't exist
          if (error.code === 'PGRST116' || error.code === '42P01' || message.includes('relation')) {
            setStatus('connected');
          } else {
            setStatus('error');
            setErrorMsg(`${message || 'Unknown Error'} (Code: ${error.code || 'N/A'})`);
          }
        } else {
          setStatus('connected');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)));
      }
    }
    check();
  }, []);

  if (status === 'error') {
    return (
      <div className="bg-red-600 text-white text-center py-2 px-4 text-xs font-bold animate-pulse">
        ⚠️ Supabase Connection Error: {errorMsg}. Please check your project URL and API key.
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      <button 
        onClick={() => alert(`Supabase URL: ${import.meta.env.VITE_SUPABASE_URL}\nSupabase Key: ${import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10)}...`)}
        className="bg-stone-800 text-white text-[9px] px-2 py-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
      >
        Debug Config
      </button>
      <div className="bg-white/90 backdrop-blur-sm border border-stone-200 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${
          status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-stone-300 animate-pulse'
        }`} />
        <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
          {status === 'connected' ? 'Supabase Live' : 'Syncing...'}
        </span>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-emerald-600 fill-emerald-600" />
              <span className="text-xl font-bold tracking-tight text-stone-900">MindEase</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center md:gap-8">
              <Link to="/" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Home</Link>
              {user && (
                <>
                  <Link to="/dashboard" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Dashboard</Link>
                  {user.role === 'doctor' && (
                    <Link to="/dashboard?tab=progress" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Patient Progress</Link>
                  )}
                  {user.role === 'user' && (
                    <Link to="/doctors" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Find Doctors</Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Admin Panel</Link>
                  )}
                </>
              )}
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200">
                    <User className="h-4 w-4 text-stone-500" />
                    <span className="text-sm font-medium text-stone-700">{user.name}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/login" className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors">Login</Link>
                  <Link
                    to="/register"
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-stone-600 hover:text-stone-900"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-stone-100 bg-white"
            >
              <div className="space-y-1 px-4 pb-3 pt-2">
                <Link to="/" className="block py-2 text-base font-medium text-stone-600">Home</Link>
                {user && (
                  <>
                    <Link to="/dashboard" className="block py-2 text-base font-medium text-stone-600">Dashboard</Link>
                    {user.role === 'doctor' && (
                      <Link to="/dashboard?tab=progress" className="block py-2 text-base font-medium text-stone-600">Patient Progress</Link>
                    )}
                    {user.role === 'user' && (
                      <Link to="/doctors" className="block py-2 text-base font-medium text-stone-600">Find Doctors</Link>
                    )}
                    {user.role === 'admin' && (
                      <Link to="/admin" className="block py-2 text-base font-medium text-stone-600">Admin Panel</Link>
                    )}
                  </>
                )}
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left py-2 text-base font-medium text-red-600"
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <Link to="/login" className="block py-2 text-base font-medium text-stone-600">Login</Link>
                    <Link to="/register" className="block py-2 text-base font-medium text-emerald-600">Register</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-stone-200 bg-white py-12 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-emerald-600 fill-emerald-600" />
              <span className="text-lg font-bold tracking-tight text-stone-900">MindEase</span>
            </div>
            <p className="text-sm text-stone-500">
              © 2026 MindEase Counselling. Your mental health matters.
            </p>
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="flex gap-6">
                <a href="#" className="text-sm text-stone-500 hover:text-emerald-600">Privacy Policy</a>
                <a href="#" className="text-sm text-stone-500 hover:text-emerald-600">Terms of Service</a>
                <a href="#" className="text-sm text-stone-500 hover:text-emerald-600">Emergency Help</a>
              </div>
              <p className="text-[10px] text-stone-300">
                Connected to: {import.meta.env.VITE_SUPABASE_URL?.substring(0, 30)}...
              </p>
              <ConnectionStatus />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
