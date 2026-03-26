import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Search, Filter, Star, Award, Briefcase, Calendar, CheckCircle2, Loader2, MessageSquare, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function DoctorDiscovery() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialization, setSpecialization] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<{ [key: string]: string }>({});
  const [selectedDoctorReviews, setSelectedDoctorReviews] = useState<any[] | null>(null);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [intakeNotes, setIntakeNotes] = useState({
    reason: '',
    duration: '',
    previousTherapy: '',
    specificConcerns: ''
  });

  useEffect(() => {
    fetchDoctors();
  }, [specialization]);

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('doctor_profiles')
        .select(`
          *,
          profiles:id(id, name, email)
        `)
        .eq('is_approved', true);

      if (specialization) {
        query = query.eq('specialization', specialization);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map to match existing structure
      const mappedDoctors = data.map(d => ({
        ...d,
        id: d.profiles.id,
        name: d.profiles.name,
        email: d.profiles.email
      }));

      setDoctors(mappedDoctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviews = async (doctorId: string) => {
    setIsReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:profiles!reviews_user_id_fkey(name)
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedReviews = data.map(r => ({
        ...r,
        user_name: (r as any).user?.name || 'Anonymous'
      }));
      setSelectedDoctorReviews(mappedReviews);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!bookingDoctor || !user) return;
    const doctorId = bookingDoctor.id;
    setBookingStatus({ ...bookingStatus, [doctorId]: 'booking' });
    
    const notes = `
Reason for visit: ${intakeNotes.reason}
Duration of symptoms: ${intakeNotes.duration}
Previous therapy: ${intakeNotes.previousTherapy}
Specific concerns: ${intakeNotes.specificConcerns}
    `.trim();

    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          doctor_id: doctorId,
          appointment_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          notes,
          status: 'pending'
        });

      if (error) throw error;

      setBookingStatus({ ...bookingStatus, [doctorId]: 'success' });
      setBookingDoctor(null);
      setIntakeNotes({ reason: '', duration: '', previousTherapy: '', specificConcerns: '' });
      setTimeout(() => {
        setBookingStatus(prev => {
          const newState = { ...prev };
          delete newState[doctorId];
          return newState;
        });
      }, 3000);
    } catch (err) {
      console.error('Error booking appointment:', err);
      setBookingStatus({ ...bookingStatus, [doctorId]: 'error' });
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        <h1 className="text-4xl font-bold text-stone-900">Find Your Perfect Match</h1>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name or specialization..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="pl-12 pr-10 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm appearance-none min-w-[200px]"
            >
              <option value="">All Specializations</option>
              <option value="Anxiety">Anxiety</option>
              <option value="Depression">Depression</option>
              <option value="Stress Management">Stress Management</option>
              <option value="Relationship">Relationship</option>
              <option value="Trauma">Trauma</option>
            </select>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="p-20 bg-white rounded-[3rem] border border-stone-100 text-center space-y-6">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
            <Search className="h-10 w-10 text-stone-200" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-stone-900">No doctors found</h3>
            <p className="text-stone-500 max-w-md mx-auto">
              We couldn't find any doctors matching your current filters. Try adjusting your search or specialization.
            </p>
          </div>
          <button 
            onClick={() => setSpecialization('')}
            className="px-6 py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {doctors.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
                    <User className="h-8 w-8 text-stone-400" />
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-bold">
                    <Star className="h-4 w-4 fill-amber-700" />
                    {doc.rating || 'New'}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">
                    Dr. {doc.name}
                  </h3>
                  <div className="flex items-center gap-2 text-stone-500 text-sm mt-1">
                    <Briefcase className="h-4 w-4" />
                    {doc.specialization}
                  </div>
                </div>

                <p className="text-stone-600 text-sm line-clamp-3 leading-relaxed">
                  {doc.bio}
                </p>

                <div className="flex items-center gap-4 text-sm text-stone-500">
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    {doc.experience} Years Exp.
                  </div>
                  <button
                    onClick={() => fetchReviews(doc.id)}
                    className="flex items-center gap-1 text-emerald-600 font-bold hover:underline"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Reviews
                  </button>
                </div>

                <button
                  onClick={() => setBookingDoctor(doc)}
                  disabled={bookingStatus[doc.id] === 'booking' || bookingStatus[doc.id] === 'success'}
                  className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                    bookingStatus[doc.id] === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-stone-900 text-white hover:bg-stone-800'
                  }`}
                >
                  {bookingStatus[doc.id] === 'booking' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : bookingStatus[doc.id] === 'success' ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Request Sent
                    </>
                  ) : (
                    <>
                      <Calendar className="h-5 w-5" />
                      Book Appointment
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Intake Questions Modal */}
      {bookingDoctor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="p-8 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Intake Questions</h2>
                <p className="text-sm text-stone-500">Booking with Dr. {bookingDoctor.name}</p>
              </div>
              <button
                onClick={() => setBookingDoctor(null)}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X className="h-6 w-6 text-stone-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">What is the primary reason for your visit?</label>
                  <textarea
                    value={intakeNotes.reason}
                    onChange={(e) => setIntakeNotes({ ...intakeNotes, reason: e.target.value })}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                    placeholder="e.g., Anxiety, stress, relationship issues..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">How long have you been experiencing these symptoms?</label>
                  <input
                    type="text"
                    value={intakeNotes.duration}
                    onChange={(e) => setIntakeNotes({ ...intakeNotes, duration: e.target.value })}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., 2 weeks, 6 months..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">Have you seen a therapist before?</label>
                  <div className="flex gap-4">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIntakeNotes({ ...intakeNotes, previousTherapy: opt })}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                          intakeNotes.previousTherapy === opt
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-700">Is there anything specific you'd like to discuss?</label>
                  <textarea
                    value={intakeNotes.specificConcerns}
                    onChange={(e) => setIntakeNotes({ ...intakeNotes, specificConcerns: e.target.value })}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                    placeholder="Optional details..."
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-stone-100 bg-stone-50/50">
              <button
                onClick={handleBook}
                disabled={!intakeNotes.reason || !intakeNotes.duration || !intakeNotes.previousTherapy}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bookingStatus[bookingDoctor.id] === 'booking' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-5 w-5" />
                    Confirm Request
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reviews Modal */}
      {selectedDoctorReviews !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="p-8 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-900">Patient Reviews</h2>
              <button
                onClick={() => setSelectedDoctorReviews(null)}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X className="h-6 w-6 text-stone-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {selectedDoctorReviews.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="h-8 w-8 text-stone-200" />
                  </div>
                  <p className="text-stone-500">No reviews yet for this doctor.</p>
                </div>
              ) : (
                selectedDoctorReviews.map((review) => (
                  <div key={review.id} className="p-6 bg-stone-50 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                          {review.user_name.charAt(0)}
                        </div>
                        <span className="font-bold text-stone-900">{review.user_name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-stone-600 text-sm leading-relaxed italic">
                      "{review.comment || 'No comment provided.'}"
                    </p>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
