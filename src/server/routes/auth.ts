import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mindease-secret-key';

router.post('/register', async (req, res) => {
  const { email, password, name, role, doctorInfo } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hashedPassword, name, role || 'user']
    );
    const userId = result.rows[0].id;

    if (role === 'doctor' && doctorInfo) {
      await pool.query(`
        INSERT INTO doctor_profiles (user_id, license_id, specialization, experience, bio)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, doctorInfo.licenseId, doctorInfo.specialization, doctorInfo.experience, doctorInfo.bio]);
    }

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error: any) {
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    let doctorProfile = null;
    if (user.role === 'doctor') {
      const profileRes = await pool.query('SELECT * FROM doctor_profiles WHERE user_id = $1', [user.id]);
      doctorProfile = profileRes.rows[0];
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: !!user.is_verified,
        doctorProfile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const authRouter = router;
