import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, User, Briefcase, Award, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Register() {
  const [role, setRole] = useState<'user' | 'doctor'>('user');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    licenseId: '',
    specialization: '',
    experience: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting sign up with email:', formData.email);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: role,
          }
        }
      });

      if (authError) {
        console.error('Supabase Auth Error Details:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('No user returned from sign up. Please check if email confirmation is required.');
      }

      console.log('User created successfully:', authData.user.id);
      
      // 2. Create/Update profile in 'profiles' table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          name: formData.name,
          role: role,
          email: formData.email,
        });

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // 3. If doctor, create entry in 'doctor_profiles' table
      if (role === 'doctor') {
        const { error: doctorError } = await supabase
          .from('doctor_profiles')
          .insert({
            id: authData.user.id,
            specialization: formData.specialization,
            license_id: formData.licenseId,
            experience: parseInt(formData.experience) || 0,
            bio: formData.bio,
            is_approved: false
          });

        if (doctorError) {
          console.error('Error creating doctor profile:', doctorError);
        }
      }

      navigate('/login', { state: { message: 'Registration successful! Please sign in.' } });
    } catch (err: any) {
      console.error('Registration error:', err);
      let friendlyMessage = err.message || 'Registration failed';
      
      if (friendlyMessage.includes('rate limit')) {
        friendlyMessage = 'Too many registration attempts. Please wait a few minutes and try again.';
      } else if (friendlyMessage.includes('invalid') && friendlyMessage.toLowerCase().includes('email')) {
        friendlyMessage = 'The email address provided is invalid. Please check for typos or try a different email.';
      }
      
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-stone-200 shadow-xl shadow-stone-100"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-stone-900">Create Account</h1>
          <p className="text-stone-500 mt-2">Join our community of care</p>
        </div>

        {/* Role Switcher */}
        <div className="flex p-1.5 bg-stone-100 rounded-2xl mb-10 max-w-xs mx-auto">
          <button
            onClick={() => setRole('user')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              role === 'user' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            I'm a User
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              role === 'doctor' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            I'm a Doctor
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {role === 'doctor' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6 pt-4 border-t border-stone-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-700 ml-1">License ID</label>
                  <div className="relative">
                    <Award className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={formData.licenseId}
                      onChange={(e) => setFormData({ ...formData, licenseId: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="MED-123456"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-700 ml-1">Specialization</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                    <select
                      required
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">Select Specialization</option>
                      <option value="Anxiety">Anxiety</option>
                      <option value="Depression">Depression</option>
                      <option value="Stress Management">Stress Management</option>
                      <option value="Relationship">Relationship</option>
                      <option value="Trauma">Trauma</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-700 ml-1">Years of Experience</label>
                <div className="relative">
                  <Award className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                  <input
                    type="number"
                    required
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-700 ml-1">Professional Bio</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 h-5 w-5 text-stone-400" />
                  <textarea
                    required
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[120px]"
                    placeholder="Tell us about your background and approach..."
                  />
                </div>
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-70 mt-8"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-stone-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-700">
              Sign in here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
