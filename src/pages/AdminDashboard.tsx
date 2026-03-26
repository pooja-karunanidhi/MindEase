import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { ShieldCheck, Users, UserCheck, AlertTriangle, TrendingUp, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AdminDashboard() {
  const { user } = useAuth();
  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, doctors: 0, appointments: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch pending doctors
      const { data: pending, error: pendingError } = await supabase
        .from('doctor_profiles')
        .select(`
          *,
          profiles:id(id, name, email)
        `)
        .eq('is_approved', false);

      if (pendingError) throw pendingError;
      
      const mappedPending = pending.map(p => ({
        ...p,
        id: p.profiles.id,
        name: p.profiles.name,
        email: p.profiles.email
      }));
      setPendingDoctors(mappedPending);
      
      // Fetch stats
      const [
        { count: userCount },
        { count: doctorCount },
        { count: appointmentCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('appointments').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        users: userCount || 0,
        doctors: doctorCount || 0,
        appointments: appointmentCount || 0
      });
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (doctorId: string) => {
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ is_approved: true })
        .eq('id', doctorId);

      if (error) throw error;
      
      setPendingDoctors(prev => prev.filter(d => d.id !== doctorId));
    } catch (err) {
      console.error('Error approving doctor:', err);
    }
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          Admin Control Center
        </h1>
        <p className="text-stone-500 mt-1">Manage platform integrity and verify professional credentials.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Verified Doctors', value: stats.doctors, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Sessions', value: stats.appointments, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' }
        ].map((stat, idx) => (
          <div key={idx} className="p-8 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm space-y-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-bold text-stone-900">{stat.value.toLocaleString()}</div>
              <div className="text-stone-500 text-sm font-medium">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Verifications */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Pending Doctor Verifications
        </h2>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : pendingDoctors.length === 0 ? (
          <div className="p-12 bg-white rounded-[2.5rem] border border-stone-100 text-center space-y-4">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="h-8 w-8 text-stone-200" />
            </div>
            <p className="text-stone-500">No pending verifications at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="px-8 py-4 text-sm font-bold text-stone-600">Doctor Name</th>
                  <th className="px-8 py-4 text-sm font-bold text-stone-600">Specialization</th>
                  <th className="px-8 py-4 text-sm font-bold text-stone-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {pendingDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-stone-50/30 transition-colors">
                    <td className="px-8 py-6 font-bold text-stone-900">{doc.name}</td>
                    <td className="px-8 py-6 text-stone-600">{doc.specialization}</td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(doc.id)}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                          title="Approve"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                          title="Reject"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
