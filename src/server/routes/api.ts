import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Health check route
router.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db: 'connected', time: dbRes.rows[0].now });
  } catch (error: any) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: error.message });
  }
});

// Temporary debug route to check if DATABASE_URL is present
router.get('/debug/env', (req, res) => {
  res.json({
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL
  });
});

// Get all approved doctors
router.get('/doctors', async (req, res) => {
  const { specialization } = req.query;
  let query = `
    SELECT u.id, u.name, dp.specialization, dp.experience, dp.bio, dp.rating
    FROM users u
    JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.role = 'doctor' AND dp.is_approved = 1
  `;
  
  const params: any[] = [];
  if (specialization) {
    query += ' AND dp.specialization = $1';
    params.push(specialization);
  }

  try {
    const doctorsRes = await pool.query(query, params);
    res.json(doctorsRes.rows);
  } catch (error) {
    console.error('Fetch doctors error:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Debug route
router.get('/debug/db', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, email, name, role, is_verified FROM users');
    const profilesRes = await pool.query('SELECT * FROM doctor_profiles');
    res.json({ users: usersRes.rows, profiles: profilesRes.rows });
  } catch (error) {
    res.status(500).json({ error: 'Debug error' });
  }
});

// Book appointment
router.post('/appointments', async (req, res) => {
  const { userId, doctorId, scheduledAt, notes } = req.body;
  try {
    await pool.query(
      'INSERT INTO appointments (user_id, doctor_id, scheduled_at, notes) VALUES ($1, $2, $3, $4)',
      [userId, doctorId, scheduledAt, notes]
    );
    res.status(201).json({ message: 'Appointment requested' });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Get user appointments
router.get('/appointments/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const appointmentsRes = await pool.query(`
      SELECT a.*, u.name as doctor_name, dp.specialization
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE a.user_id = $1
      ORDER BY a.scheduled_at DESC
    `, [userId]);
    res.json(appointmentsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get doctor appointments
router.get('/doctor-appointments/:doctorId', async (req, res) => {
  const { doctorId } = req.params;
  try {
    const appointmentsRes = await pool.query(`
      SELECT a.*, u.name as user_name
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      WHERE a.doctor_id = $1
      ORDER BY a.scheduled_at DESC
    `, [doctorId]);
    res.json(appointmentsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doctor appointments' });
  }
});

// Get single appointment detail
router.get('/appointments/detail/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const appointmentRes = await pool.query(`
      SELECT a.*, u.name as user_name, d.name as doctor_name
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      JOIN users d ON a.doctor_id = d.id
      WHERE a.id = $1
    `, [id]);
    res.json(appointmentRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointment detail' });
  }
});

// Update appointment status, time, or remedy notes
router.patch('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { status, scheduledAt, remedyNotes } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (scheduledAt) {
      params.push(scheduledAt);
      updates.push(`scheduled_at = $${params.length}`);
    }
    if (remedyNotes !== undefined) {
      params.push(remedyNotes);
      updates.push(`remedy_notes = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    }
    
    res.json({ message: 'Appointment updated' });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Admin: Get pending doctors
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    const doctorsRes = await pool.query(`
      SELECT u.id, u.name, dp.license_id, dp.specialization, dp.experience, dp.bio
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'doctor' AND dp.is_approved = 0
    `);
    res.json(doctorsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending doctors' });
  }
});

// Admin: Approve doctor
router.post('/admin/approve-doctor/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE doctor_profiles SET is_approved = 1 WHERE user_id = $1', [id]);
    res.json({ message: 'Doctor approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve doctor' });
  }
});

// Submit a review
router.post('/reviews', async (req, res) => {
  const { appointmentId, userId, doctorId, rating, comment } = req.body;
  try {
    await pool.query(`
      INSERT INTO reviews (appointment_id, user_id, doctor_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
    `, [appointmentId, userId, doctorId, rating, comment]);

    // Update doctor's average rating
    const statsRes = await pool.query('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE doctor_id = $1', [doctorId]);
    const stats = statsRes.rows[0];
    await pool.query('UPDATE doctor_profiles SET rating = $1 WHERE user_id = $2', [stats.avg, doctorId]);

    res.status(201).json({ message: 'Review submitted' });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Review already exists for this appointment' });
    }
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a doctor
router.get('/doctors/:id/reviews', async (req, res) => {
  const { id } = req.params;
  try {
    const reviewsRes = await pool.query(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.doctor_id = $1
      ORDER BY r.created_at DESC
    `, [id]);
    res.json(reviewsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews submitted by a user
router.get('/user-reviews/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const reviewsRes = await pool.query(`
      SELECT r.*, u.name as doctor_name, dp.specialization
      FROM reviews r
      JOIN users u ON r.doctor_id = u.id
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [userId]);
    res.json(reviewsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

// Submit progress log
router.post('/progress-logs', async (req, res) => {
  const { userId, appointmentId, logText } = req.body;
  try {
    await pool.query('INSERT INTO progress_logs (user_id, appointment_id, log_text) VALUES ($1, $2, $3)', [userId, appointmentId, logText]);
    res.status(201).json({ message: 'Progress logged' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log progress' });
  }
});

// Get progress logs for an appointment
router.get('/progress-logs/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  try {
    const logsRes = await pool.query('SELECT * FROM progress_logs WHERE appointment_id = $1 ORDER BY created_at DESC', [appointmentId]);
    res.json(logsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress logs' });
  }
});

// Get all progress logs for a doctor's patients
router.get('/doctor/patient-progress/:doctorId', async (req, res) => {
  const { doctorId } = req.params;
  try {
    const logsRes = await pool.query(`
      SELECT pl.*, u.name as user_name, a.scheduled_at as appointment_date
      FROM progress_logs pl
      JOIN users u ON pl.user_id = u.id
      JOIN appointments a ON pl.appointment_id = a.id
      WHERE a.doctor_id = $1
      ORDER BY pl.created_at DESC
    `, [doctorId]);
    res.json(logsRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patient progress' });
  }
});

export const apiRouter = router;
