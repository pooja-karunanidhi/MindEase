import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get all approved doctors
router.get('/doctors', (req, res) => {
  const { specialization } = req.query;
  let query = `
    SELECT u.id, u.name, dp.specialization, dp.experience, dp.bio, dp.rating
    FROM users u
    JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.role = 'doctor' AND dp.is_approved = 1
  `;
  
  const params: any[] = [];
  if (specialization) {
    query += ' AND dp.specialization = ?';
    params.push(specialization);
  }

  const doctors = db.prepare(query).all(...params);
  res.json(doctors);
});

// Debug route
router.get('/debug/db', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, is_verified FROM users').all();
  const profiles = db.prepare('SELECT * FROM doctor_profiles').all();
  res.json({ users, profiles });
});

// Book appointment
router.post('/appointments', (req, res) => {
  const { userId, doctorId, scheduledAt, notes } = req.body;
  try {
    const insert = db.prepare('INSERT INTO appointments (user_id, doctor_id, scheduled_at, notes) VALUES (?, ?, ?, ?)');
    insert.run(userId, doctorId, scheduledAt, notes);
    res.status(201).json({ message: 'Appointment requested' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Get user appointments
router.get('/appointments/:userId', (req, res) => {
  const { userId } = req.params;
  const appointments = db.prepare(`
    SELECT a.*, u.name as doctor_name, dp.specialization
    FROM appointments a
    JOIN users u ON a.doctor_id = u.id
    JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE a.user_id = ?
    ORDER BY a.scheduled_at DESC
  `).all(userId);
  res.json(appointments);
});

// Get doctor appointments
router.get('/doctor-appointments/:doctorId', (req, res) => {
  const { doctorId } = req.params;
  const appointments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    WHERE a.doctor_id = ?
    ORDER BY a.scheduled_at DESC
  `).all(doctorId);
  res.json(appointments);
});

// Get single appointment detail
router.get('/appointments/detail/:id', (req, res) => {
  const { id } = req.params;
  try {
    const appointment = db.prepare(`
      SELECT a.*, u.name as user_name, d.name as doctor_name
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      JOIN users d ON a.doctor_id = d.id
      WHERE a.id = ?
    `).get(id);
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointment detail' });
  }
});

// Update appointment status, time, or remedy notes
router.patch('/appointments/:id', (req, res) => {
  const { id } = req.params;
  const { status, scheduledAt, remedyNotes } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (scheduledAt) {
      updates.push('scheduled_at = ?');
      params.push(scheduledAt);
    }
    if (remedyNotes !== undefined) {
      updates.push('remedy_notes = ?');
      params.push(remedyNotes);
    }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ message: 'Appointment updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Admin: Get pending doctors
router.get('/admin/pending-doctors', (req, res) => {
  const doctors = db.prepare(`
    SELECT u.id, u.name, dp.license_id, dp.specialization, dp.experience, dp.bio
    FROM users u
    JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.role = 'doctor' AND dp.is_approved = 0
  `).all();
  res.json(doctors);
});

// Admin: Approve doctor
router.post('/admin/approve-doctor/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('UPDATE doctor_profiles SET is_approved = 1 WHERE user_id = ?').run(id);
    res.json({ message: 'Doctor approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve doctor' });
  }
});

// Submit a review
router.post('/reviews', (req, res) => {
  const { appointmentId, userId, doctorId, rating, comment } = req.body;
  try {
    db.prepare(`
      INSERT INTO reviews (appointment_id, user_id, doctor_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(appointmentId, userId, doctorId, rating, comment);

    // Update doctor's average rating
    const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE doctor_id = ?').get(doctorId) as any;
    db.prepare('UPDATE doctor_profiles SET rating = ? WHERE user_id = ?').run(stats.avg, doctorId);

    res.status(201).json({ message: 'Review submitted' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Review already exists for this appointment' });
    }
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a doctor
router.get('/doctors/:id/reviews', (req, res) => {
  const { id } = req.params;
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.doctor_id = ?
      ORDER BY r.created_at DESC
    `).all(id);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews submitted by a user
router.get('/user-reviews/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.name as doctor_name, dp.specialization
      FROM reviews r
      JOIN users u ON r.doctor_id = u.id
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

// Submit progress log
router.post('/progress-logs', (req, res) => {
  const { userId, appointmentId, logText } = req.body;
  try {
    db.prepare('INSERT INTO progress_logs (user_id, appointment_id, log_text) VALUES (?, ?, ?)').run(userId, appointmentId, logText);
    res.status(201).json({ message: 'Progress logged' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log progress' });
  }
});

// Get progress logs for an appointment
router.get('/progress-logs/:appointmentId', (req, res) => {
  const { appointmentId } = req.params;
  try {
    const logs = db.prepare('SELECT * FROM progress_logs WHERE appointment_id = ? ORDER BY created_at DESC').all(appointmentId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress logs' });
  }
});

// Get all progress logs for a doctor's patients
router.get('/doctor/patient-progress/:doctorId', (req, res) => {
  const { doctorId } = req.params;
  try {
    const logs = db.prepare(`
      SELECT pl.*, u.name as user_name, a.scheduled_at as appointment_date
      FROM progress_logs pl
      JOIN users u ON pl.user_id = u.id
      JOIN appointments a ON pl.appointment_id = a.id
      WHERE a.doctor_id = ?
      ORDER BY pl.created_at DESC
    `).all(doctorId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patient progress' });
  }
});

export const apiRouter = router;
