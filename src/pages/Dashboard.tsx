import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Calendar, Clock, MessageSquare, CheckCircle, XCircle, AlertCircle, Plus, Star, User, Shield, Activity, Loader2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

export function Dashboard() {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patientProgress, setPatientProgress] = useState<any[]>([]);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [viewingNotesId, setViewingNotesId] = useState<number | null>(null);
  const [viewingRemedyId, setViewingRemedyId] = useState<number | null>(null);
  const [editingRemedyId, setEditingRemedyId] = useState<number | null>(null);
  const [remedyInput, setRemedyInput] = useState('');
  const [isSavingRemedy, setIsSavingRemedy] = useState(false);
  const [loggingProgressId, setLoggingProgressId] = useState<number | null>(null);
  const [progressInput, setProgressInput] = useState('');
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [viewingProgressId, setViewingProgressId] = useState<number | null>(null);
  const [progressLogs, setProgressLogs] = useState<{ [key: number]: any[] }>({});
  const [isAICheckingIn, setIsAICheckingIn] = useState(false);
  const [aiCheckInStep, setAiCheckInStep] = useState<'idle' | 'chatting' | 'saving'>('idle');
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  
  const queryParams = new URLSearchParams(location.search);
  const initialTab = (queryParams.get('tab') as 'sessions' | 'progress') || 'sessions';
  const [activeTab, setActiveTab] = useState<'sessions' | 'progress'>(initialTab);

  useEffect(() => {
    const tab = queryParams.get('tab');
    if (tab === 'progress' || tab === 'sessions') {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoint = user?.role === 'doctor' 
          ? `/api/doctor-appointments/${user?.id}`
          : `/api/appointments/${user?.id}`;
        
        const reviewsEndpoint = user?.role === 'doctor'
          ? `/api/doctors/${user?.id}/reviews`
          : `/api/user-reviews/${user?.id}`;
        
        const [aptRes, revRes] = await Promise.all([
          fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(reviewsEndpoint, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const aptData = await aptRes.json();
        const revData = await revRes.json();

        setAppointments(aptData);
        setReviews(revData);

        if (user?.role === 'doctor') {
          const progressRes = await fetch(`/api/doctor/patient-progress/${user?.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const progressData = await progressRes.json();
          setPatientProgress(Array.isArray(progressData) ? progressData : []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, token]);

  const handleStatusUpdate = async (appointmentId: number, status: string, scheduledAt?: string) => {
    try {
      await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, scheduledAt })
      });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status, scheduled_at: scheduledAt || a.scheduled_at } : a));
      setSchedulingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRemedy = async (appointmentId: number) => {
    setIsSavingRemedy(true);
    try {
      await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ remedyNotes: remedyInput })
      });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, remedy_notes: remedyInput } : a));
      setEditingRemedyId(null);
      setRemedyInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRemedy(false);
    }
  };

  const handleSaveProgress = async (appointmentId: number) => {
    setIsSavingProgress(true);
    try {
      await fetch('/api/progress-logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user?.id, appointmentId, logText: progressInput })
      });
      setLoggingProgressId(null);
      setProgressInput('');
      // Refresh logs if currently viewing
      if (viewingProgressId === appointmentId) {
        fetchProgressLogs(appointmentId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProgress(false);
    }
  };

  const fetchProgressLogs = async (appointmentId: number) => {
    try {
      const response = await fetch(`/api/progress-logs/${appointmentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProgressLogs(prev => ({ ...prev, [appointmentId]: data }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleProgressView = (appointmentId: number) => {
    if (viewingProgressId === appointmentId) {
      setViewingProgressId(null);
    } else {
      setViewingProgressId(appointmentId);
      if (!progressLogs[appointmentId]) {
        fetchProgressLogs(appointmentId);
      }
    }
  };

  const startAICheckIn = (apt: any) => {
    setLoggingProgressId(apt.id);
    setIsAICheckingIn(true);
    setAiCheckInStep('chatting');
    setAiMessages([
      { role: 'model', text: `Hi ${user?.name}! I'm here to help you track your progress. Your doctor suggested: "${apt.remedy_notes}". How has it been going with these remedies?` }
    ]);
  };

  const handleAISend = async () => {
    if (!aiInput.trim()) return;
    
    const userMessage = aiInput;
    const newUserMsg = { role: 'user' as const, text: userMessage };
    setAiMessages(prev => [...prev, newUserMsg]);
    setAiInput('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const apt = appointments.find(a => a.id === loggingProgressId);
      
      const history = aiMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `You are a supportive mental health assistant. The patient is checking in about their progress following these remedies: "${apt?.remedy_notes}". 
          Acknowledge their progress, ask a follow-up question if needed, and eventually offer to summarize their update for their doctor. 
          Keep responses concise and empathetic.`
        }
      });

      const aiText = response.text || "I'm having trouble connecting right now, but I've noted your progress. Would you like to save this update?";
      
      setAiMessages(prev => [...prev, { role: 'model', text: aiText }]);
      
      // If the AI response suggests it's done or summarizing
      if (aiText.toLowerCase().includes('summarize') || aiText.toLowerCase().includes('save')) {
        setAiCheckInStep('saving');
      }
    } catch (err) {
      console.error(err);
      setAiMessages(prev => [...prev, { role: 'model', text: "I'm here to support you. Let's save your progress for your doctor to review." }]);
      setAiCheckInStep('saving');
    }
  };

  const saveAICheckIn = async (appointmentId: number) => {
    const summary = aiMessages.map(m => `${m.role === 'user' ? 'Patient' : 'AI'}: ${m.text}`).join('\n');
    setProgressInput(summary);
    await handleSaveProgress(appointmentId);
    setIsAICheckingIn(false);
    setAiCheckInStep('idle');
    setAiMessages([]);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-stone-900">Welcome back, {user?.name}</h1>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              user?.role === 'doctor' ? 'bg-blue-100 text-blue-700' :
              user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {user?.role}
            </span>
          </div>
          <p className="text-stone-500">Here's what's happening with your care today.</p>
        </div>
        {user?.role === 'user' && (
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Plus className="h-5 w-5" />
            Book New Session
          </Link>
        )}
        {user?.role === 'doctor' && (
          <button
            onClick={() => setActiveTab(activeTab === 'progress' ? 'sessions' : 'progress')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${
              activeTab === 'progress' 
                ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-stone-100' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
            }`}
          >
            <Activity className="h-5 w-5" />
            {activeTab === 'progress' ? 'View Sessions' : 'View Patient Progress'}
          </button>
        )}
      </header>

      {/* Tab Navigation (Doctor Only) */}
      {user?.role === 'doctor' && (
        <div className="flex gap-4 border-b border-stone-100">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'sessions' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Sessions & History
            {activeTab === 'sessions' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'progress' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Patient Progress Feed
            {patientProgress.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full">
                {patientProgress.length}
              </span>
            )}
            {activeTab === 'progress' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Patient Progress Feed (Doctor Only - Tabbed) */}
          {user?.role === 'doctor' && activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-600" />
                  Patient Progress Monitoring
                </h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={async () => {
                      const progressRes = await fetch(`/api/doctor/patient-progress/${user?.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const progressData = await progressRes.json();
                      setPatientProgress(Array.isArray(progressData) ? progressData : []);
                    }}
                    className="p-2 hover:bg-stone-100 rounded-xl transition-colors group"
                    title="Refresh Progress"
                  >
                    <Loader2 className="h-4 w-4 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                  </button>
                </div>
              </div>

              {!Array.isArray(patientProgress) || patientProgress.length === 0 ? (
                <div className="p-12 bg-white rounded-[2rem] border border-stone-100 text-center space-y-4">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                    <Activity className="h-8 w-8 text-stone-300" />
                  </div>
                  <p className="text-stone-500">No patient progress updates recorded yet.</p>
                  <p className="text-xs text-stone-400">When patients complete an AI Check-in or Manual Update, their logs will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientProgress.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-white rounded-[2rem] border border-stone-100 shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <User className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-900">{log.user_name}</h4>
                            <p className="text-[10px] text-stone-400 font-medium">
                              {format(new Date(log.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="px-2 py-0.5 bg-stone-50 text-stone-400 rounded-full text-[8px] font-bold uppercase tracking-widest">
                          Session: {format(new Date(log.appointment_date), 'MMM d')}
                        </div>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                          {log.log_text}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sessions Section (Visible if not on progress tab or if patient) */}
          {(user?.role !== 'doctor' || activeTab === 'sessions') && (
            <div className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  Upcoming Sessions
                </h2>
            
            {appointments.filter(a => a.status !== 'completed').length === 0 ? (
              <div className="p-12 bg-white rounded-[2rem] border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-stone-500">No upcoming appointments scheduled yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.filter(a => a.status !== 'completed').map((apt) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 bg-white rounded-[2rem] border border-stone-100 shadow-sm flex flex-col gap-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                          <User className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-stone-900">
                            {user?.role === 'doctor' ? apt.user_name : apt.doctor_name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-stone-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(apt.scheduled_at), 'MMM d, h:mm a')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              apt.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              apt.status === 'in-progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                              apt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {apt.status === 'in-progress' ? 'Session In Progress' : apt.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user?.role === 'doctor' && apt.notes && (
                          <button
                            onClick={() => setViewingNotesId(viewingNotesId === apt.id ? null : apt.id)}
                            className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all flex items-center gap-2"
                          >
                            <AlertCircle className="h-4 w-4" />
                            {viewingNotesId === apt.id ? 'Hide Notes' : 'View Notes'}
                          </button>
                        )}
                        {user?.role === 'doctor' && apt.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'approved')}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'rejected')}
                              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        {user?.role === 'doctor' && apt.status === 'approved' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'in-progress')}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                              <Activity className="h-4 w-4" />
                              Start Session
                            </button>
                            <button
                              onClick={() => {
                                setSchedulingId(apt.id);
                                setSelectedTime(format(new Date(apt.scheduled_at), "yyyy-MM-dd'T'HH:mm"));
                              }}
                              className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all"
                            >
                              Set Time
                            </button>
                          </div>
                        )}
                        {user?.role === 'doctor' && apt.status === 'in-progress' && (
                          <button
                            onClick={() => handleStatusUpdate(apt.id, 'completed')}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Complete Session
                          </button>
                        )}
                        {user?.role === 'doctor' && (apt.status === 'approved' || apt.status === 'in-progress') && (
                          <button
                            onClick={() => toggleProgressView(apt.id)}
                            className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all flex items-center gap-2"
                          >
                            <Activity className="h-4 w-4" />
                            {viewingProgressId === apt.id ? 'Hide Progress' : 'View Progress'}
                          </button>
                        )}
                        {(apt.status === 'approved' || apt.status === 'in-progress') && (
                          <Link
                            to={`/chat/${apt.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Join Session
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Progress Logs Display (Doctor Only) */}
                    {user?.role === 'doctor' && viewingProgressId === apt.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-4"
                      >
                        <h5 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Patient Progress Updates</h5>
                        {!progressLogs[apt.id] ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
                          </div>
                        ) : progressLogs[apt.id].length === 0 ? (
                          <p className="text-sm text-stone-500 text-center py-4">No progress updates logged yet for this patient.</p>
                        ) : (
                          <div className="space-y-3">
                            {progressLogs[apt.id].map((log: any) => (
                              <div key={log.id} className="p-4 bg-white rounded-xl border border-stone-100 shadow-sm space-y-1">
                                <p className="text-sm text-stone-700">{log.log_text}</p>
                                <p className="text-[10px] text-stone-400 font-medium">
                                  {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Intake Notes Display */}
                    {viewingNotesId === apt.id && apt.notes && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-3"
                      >
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Patient Intake Notes</h4>
                        <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                          {apt.notes}
                        </div>
                      </motion.div>
                    )}

                    {/* Scheduling Form */}
                    {schedulingId === apt.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-4 border-t border-stone-50 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                          <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Select Date & Time</label>
                            <input
                              type="datetime-local"
                              value={selectedTime}
                              onChange={(e) => setSelectedTime(e.target.value)}
                              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'approved', new Date(selectedTime).toISOString())}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                            >
                              Confirm Time
                            </button>
                            <button
                              onClick={() => setSchedulingId(null)}
                              className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Session History & Feedback */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Session History & Feedback
            </h2>

            {appointments.filter(a => a.status === 'completed').length === 0 ? (
              <div className="p-12 bg-white rounded-[2rem] border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-stone-500">No completed sessions yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.filter(a => a.status === 'completed').map((apt) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white rounded-[2rem] border border-stone-100 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
                          <User className="h-5 w-5 text-stone-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900">
                            {user?.role === 'doctor' ? apt.user_name : `Dr. ${apt.doctor_name}`}
                          </h4>
                          <p className="text-xs text-stone-400">{format(new Date(apt.scheduled_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {user?.role === 'doctor' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingRemedyId(apt.id);
                                setRemedyInput(apt.remedy_notes || '');
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {apt.remedy_notes ? 'Edit Remedy' : 'Add Remedy'}
                            </button>
                            <button
                              onClick={() => toggleProgressView(apt.id)}
                              className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition-all flex items-center gap-2"
                            >
                              <Activity className="h-3.5 w-3.5" />
                              {viewingProgressId === apt.id ? 'Hide Progress' : 'View Progress'}
                            </button>
                          </>
                        )}
                        {user?.role === 'user' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setLoggingProgressId(apt.id)}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                            >
                              <Activity className="h-3.5 w-3.5" />
                              Manual Update
                            </button>
                            <button
                              onClick={() => startAICheckIn(apt)}
                              className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all flex items-center gap-2"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              AI Check-in
                            </button>
                          </div>
                        )}
                        {apt.remedy_notes && (
                          <button
                            onClick={() => setViewingRemedyId(viewingRemedyId === apt.id ? null : apt.id)}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            {viewingRemedyId === apt.id ? 'Hide Remedies' : 'View Remedies'}
                          </button>
                        )}
                        <Link
                          to={`/chat/${apt.id}`}
                          className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition-all"
                        >
                          View Chat
                        </Link>
                      </div>
                    </div>

                    {viewingRemedyId === apt.id && apt.remedy_notes && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2"
                      >
                        <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Doctor's Remedy Notes</h5>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed italic">
                          "{apt.remedy_notes}"
                        </p>
                      </motion.div>
                    )}

                    {/* Progress Logs Display (Doctor Only) */}
                    {user?.role === 'doctor' && viewingProgressId === apt.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-4"
                      >
                        <h5 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Patient Progress Updates</h5>
                        {!progressLogs[apt.id] ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
                          </div>
                        ) : progressLogs[apt.id].length === 0 ? (
                          <p className="text-sm text-stone-500 text-center py-4">No progress updates logged yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {progressLogs[apt.id].map((log: any) => (
                              <div key={log.id} className="p-4 bg-white rounded-xl border border-stone-100 shadow-sm space-y-1">
                                <p className="text-sm text-stone-700">{log.log_text}</p>
                                <p className="text-[10px] text-stone-400 font-medium">
                                  {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Remedy Edit Form */}
                    {editingRemedyId === apt.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4"
                      >
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Remedy Notes for {apt.user_name}</label>
                          <textarea
                            value={remedyInput}
                            onChange={(e) => setRemedyInput(e.target.value)}
                            placeholder="Enter guidance, exercises, or remedies..."
                            className="w-full p-4 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveRemedy(apt.id)}
                            disabled={isSavingRemedy || !remedyInput.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {isSavingRemedy ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Notes'}
                          </button>
                          <button
                            onClick={() => setEditingRemedyId(null)}
                            className="px-6 py-2 bg-stone-200 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-300 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Show review if exists */}
                    {reviews.find(r => r.appointment_id === apt.id) && (
                      <div className="pt-4 border-t border-stone-50 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-stone-500 italic">
                            "{reviews.find(r => r.appointment_id === apt.id).comment}"
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${
                                s <= reviews.find(r => r.appointment_id === apt.id).rating ? 'text-amber-400 fill-amber-400' : 'text-stone-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Recent Reviews
            </h2>

            {reviews.length === 0 ? (
              <div className="p-12 bg-white rounded-[2rem] border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                  <Star className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-stone-500">No reviews recorded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.slice(0, 4).map((rev) => (
                  <motion.div
                    key={rev.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white rounded-[2rem] border border-stone-100 shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-stone-900">
                          {user?.role === 'doctor' ? rev.user_name : `Dr. ${rev.doctor_name}`}
                        </h4>
                        <p className="text-xs text-stone-400">{format(new Date(rev.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-stone-600 italic leading-relaxed">
                      "{rev.comment || 'No comment provided.'}"
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Patient Progress Summary (Doctor Only) */}
          {user?.role === 'doctor' && (
            <div className="p-8 bg-stone-900 rounded-[2.5rem] text-white space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Recent Updates</h2>
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="space-y-4">
                {patientProgress.length === 0 ? (
                  <p className="text-stone-400 text-sm">No recent patient updates.</p>
                ) : (
                  patientProgress.slice(0, 3).map((log) => (
                    <div key={log.id} className="space-y-1">
                      <p className="text-sm font-bold">{log.user_name}</p>
                      <p className="text-xs text-stone-400 line-clamp-1">{log.log_text}</p>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setActiveTab('progress')}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-bold transition-all"
              >
                View All Progress
              </button>
            </div>
          )}

          {/* Emergency Widget */}
          <div className="p-8 bg-white rounded-[2.5rem] border border-stone-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Emergency Help</h2>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              If you are in immediate danger or experiencing a crisis, please contact emergency services or a helpline.
            </p>
            <div className="space-y-2">
              <a href="tel:988" className="block w-full py-3 bg-red-50 text-red-600 rounded-2xl text-center font-bold hover:bg-red-100 transition-colors">
                Call 988 (Crisis Line)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Logging Modal */}
      {loggingProgressId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-900">
                {isAICheckingIn ? 'AI Progress Check-in' : 'Update Your Progress'}
              </h2>
              <button
                onClick={() => {
                  setLoggingProgressId(null);
                  setIsAICheckingIn(false);
                  setAiCheckInStep('idle');
                  setAiMessages([]);
                }}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <XCircle className="h-6 w-6 text-stone-400" />
              </button>
            </div>
            
            {isAICheckingIn ? (
              <div className="flex flex-col h-[500px]">
                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                        msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-800'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-8 border-t border-stone-100 bg-stone-50/50">
                  {aiCheckInStep === 'chatting' ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAISend()}
                        placeholder="Type your response..."
                        className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleAISend}
                        className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => saveAICheckIn(loggingProgressId)}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Save Update to Dashboard
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="p-8 space-y-4">
                  <p className="text-sm text-stone-500">
                    How are you following the remedies provided by your doctor? Share your daily progress or any challenges.
                  </p>
                  <textarea
                    value={progressInput}
                    onChange={(e) => setProgressInput(e.target.value)}
                    placeholder="e.g., I've been doing the breathing exercises twice a day and feeling more calm..."
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[150px]"
                  />
                </div>
                <div className="p-8 border-t border-stone-100 bg-stone-50/50 flex gap-3">
                  <button
                    onClick={() => handleSaveProgress(loggingProgressId)}
                    disabled={isSavingProgress || !progressInput.trim()}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingProgress ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit Update'}
                  </button>
                  <button
                    onClick={() => setLoggingProgressId(null)}
                    className="px-6 py-4 bg-stone-200 text-stone-600 rounded-2xl font-bold hover:bg-stone-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
