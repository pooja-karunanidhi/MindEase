import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Shield, Phone, Video, MoreVertical, Loader2, Star, X, CheckCircle2 } from 'lucide-react';

export function Chat() {
  const { appointmentId } = useParams();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [remedyNotes, setRemedyNotes] = useState('');
  const [isSubmittingRemedy, setIsSubmittingRemedy] = useState(false);
  const [remedySubmitted, setRemedySubmitted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        const response = await fetch(`/api/appointments/detail/${appointmentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setAppointment(data);
        if (data.remedy_notes) {
          setRemedyNotes(data.remedy_notes);
          setRemedySubmitted(true);
        }
        if (data.status === 'completed') {
          setTimeLeft(0);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAppointment();
  }, [appointmentId, token]);

  useEffect(() => {
    if (!appointment || timeLeft === 0) return;

    const timer = setInterval(() => {
      const start = new Date(appointment.scheduled_at).getTime();
      const end = start + 30 * 60 * 1000; // 30 minutes
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      
      if (now < start) {
        setTimeLeft(null); // Not started yet
      } else {
        setTimeLeft(diff);
      }

      if (diff === 0 && now >= end) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [appointment, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setIsSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId: parseInt(appointmentId!),
          userId: user?.id,
          doctorId: appointment.doctor_id,
          rating,
          comment
        })
      });
      if (response.ok) {
        setReviewSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleRemedySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remedyNotes.trim()) return;
    setIsSubmittingRemedy(true);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ remedyNotes })
      });
      if (response.ok) {
        setRemedySubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRemedy(false);
    }
  };

  const handleFinishSession = async () => {
    try {
      await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'completed' })
      });
      
      // Notify other party via socket
      if (socket) {
        socket.send(JSON.stringify({
          type: 'session_ended',
          appointmentId,
          senderId: user?.id
        }));
      }
      
      setTimeLeft(0);
      setShowFinishConfirm(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('Connected to chat');
      ws.send(JSON.stringify({ type: 'join', appointmentId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.appointmentId === appointmentId) {
        if (data.type === 'session_ended') {
          setTimeLeft(0);
          return;
        }
        setMessages((prev) => [...prev, data]);
      }
    };

    setSocket(ws);

    return () => ws.close();
  }, [appointmentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const messageData = {
      appointmentId,
      senderId: user?.id,
      senderName: user?.name,
      text: input,
      timestamp: new Date().toISOString()
    };

    socket.send(JSON.stringify(messageData));
    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-[2.5rem] border border-stone-200 shadow-xl overflow-hidden">
      {/* Chat Header */}
      <header className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <User className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Session Room</h2>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              {timeLeft !== null && timeLeft > 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                  Time Remaining: {formatTime(timeLeft)}
                </div>
              ) : (
                <div className="text-stone-400">
                  {appointment && new Date(appointment.scheduled_at) > new Date() && timeLeft !== 0
                    ? `Starts at ${new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Session Ended'}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'doctor' && appointment?.notes && (
            <button
              onClick={() => setShowNotes(true)}
              className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition-all"
            >
              Intake Notes
            </button>
          )}
          {appointment?.status !== 'completed' && timeLeft !== 0 && (
            <div className="relative">
              {!showFinishConfirm ? (
                <button
                  onClick={() => setShowFinishConfirm(true)}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                >
                  Finish Session
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-red-100 p-1 rounded-xl shadow-lg">
                  <button
                    onClick={handleFinishSession}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 transition-all"
                  >
                    Confirm End
                  </button>
                  <button
                    onClick={() => setShowFinishConfirm(false)}
                    className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-[10px] font-bold hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 border-l border-stone-200 pl-3">
            <button className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all">
              <Phone className="h-5 w-5" />
            </button>
            <button className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all">
              <Video className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/30"
      >
        <div className="flex justify-center">
          <div className="px-4 py-1.5 bg-white border border-stone-100 rounded-full text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-3 w-3" />
            End-to-End Encrypted
          </div>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] space-y-1`}>
                <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.senderId === user?.id 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-white border border-stone-100 text-stone-800 rounded-tl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
                <div className={`text-[10px] text-stone-400 font-medium ${
                  msg.senderId === user?.id ? 'text-right' : 'text-left'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Feedback Section */}
        {timeLeft === 0 && user?.role === 'user' && !reviewSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-white rounded-[2rem] border border-emerald-100 shadow-lg space-y-6 max-w-md mx-auto"
          >
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-stone-900">How was your session?</h3>
              <p className="text-sm text-stone-500">Your feedback helps us improve our care.</p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-6">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= rating ? 'text-amber-400 fill-amber-400' : 'text-stone-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts (optional)..."
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
              />

              <button
                type="submit"
                disabled={rating === 0 || isSubmittingReview}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingReview ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit Feedback'}
              </button>
            </form>
          </motion.div>
        )}

        {/* Remedy Notes Section (Doctor) */}
        {timeLeft === 0 && user?.role === 'doctor' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-white rounded-[2rem] border border-blue-100 shadow-lg space-y-6 max-w-md mx-auto"
          >
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-stone-900">Session Remedy Notes</h3>
              <p className="text-sm text-stone-500">Provide guidance and next steps for the patient.</p>
            </div>

            <form onSubmit={handleRemedySubmit} className="space-y-6">
              <textarea
                value={remedyNotes}
                onChange={(e) => setRemedyNotes(e.target.value)}
                disabled={remedySubmitted}
                placeholder="Enter remedies, exercises, or advice..."
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px] disabled:opacity-70"
              />

              {!remedySubmitted ? (
                <button
                  type="submit"
                  disabled={!remedyNotes.trim() || isSubmittingRemedy}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingRemedy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Remedy Notes'}
                </button>
              ) : (
                <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl text-center font-bold text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Notes Saved Successfully
                </div>
              )}
            </form>
          </motion.div>
        )}

        {reviewSubmitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 text-center space-y-4 max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Star className="h-8 w-8 text-emerald-600 fill-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-emerald-900">Thank you!</h3>
            <p className="text-emerald-700 text-sm">Your feedback has been submitted successfully.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSend}
        className="p-6 bg-white border-t border-stone-100"
      >
        <div className="relative flex items-center gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={timeLeft === 0}
            placeholder={timeLeft === 0 ? "Session has ended" : "Type your message here..."}
            className="flex-1 pl-6 pr-14 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || timeLeft === 0}
            className="absolute right-2 p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:hover:bg-emerald-600"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>

      {/* Intake Notes Modal */}
      {showNotes && appointment?.notes && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-900">Patient Intake Notes</h2>
              <button
                onClick={() => setShowNotes(false)}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X className="h-6 w-6 text-stone-400" />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                {appointment.notes}
              </div>
            </div>
            <div className="p-8 border-t border-stone-100 bg-stone-50/50">
              <button
                onClick={() => setShowNotes(false)}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all"
              >
                Close Notes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
