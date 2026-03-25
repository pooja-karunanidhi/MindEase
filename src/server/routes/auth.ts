import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mindease-secret-key';

router.post('/register', async (req, res) => {
  const { email, password, name, role, doctorInfo } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const insertUser = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
    const result = insertUser.run(email, hashedPassword, name, role || 'user');
    const userId = result.lastInsertRowid;

    if (role === 'doctor' && doctorInfo) {
      const insertDoctor = db.prepare(`
        INSERT INTO doctor_profiles (user_id, license_id, specialization, experience, bio)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertDoctor.run(userId, doctorInfo.licenseId, doctorInfo.specialization, doctorInfo.experience, doctorInfo.bio);
    }

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    let doctorProfile = null;
    if (user.role === 'doctor') {
      doctorProfile = db.prepare('SELECT * FROM doctor_profiles WHERE user_id = ?').get(user.id);
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const authRouter = router;
