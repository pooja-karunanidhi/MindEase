import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '../../mindease.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'doctor', 'admin')) DEFAULT 'user',
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id INTEGER PRIMARY KEY,
    license_id TEXT UNIQUE NOT NULL,
    specialization TEXT NOT NULL,
    experience INTEGER NOT NULL,
    bio TEXT,
    is_approved INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'in-progress')) DEFAULT 'pending',
    notes TEXT,
    remedy_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(doctor_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(doctor_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(appointment_id) REFERENCES appointments(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS mood_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mood TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS doctor_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0-6
    start_time TEXT NOT NULL, -- HH:MM
    end_time TEXT NOT NULL, -- HH:MM
    FOREIGN KEY(doctor_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS progress_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    appointment_id INTEGER NOT NULL,
    log_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(appointment_id) REFERENCES appointments(id)
  );
`);

// Migration: Add notes to appointments if not exists
try {
  db.prepare('SELECT notes FROM appointments LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE appointments ADD COLUMN notes TEXT');
}

try {
  db.prepare('SELECT remedy_notes FROM appointments LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE appointments ADD COLUMN remedy_notes TEXT');
}

// Seed initial data if missing
const hashedPass = bcrypt.hashSync('password123', 10);

const ensureUser = (email: string, name: string, role: string) => {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    const result = db.prepare('INSERT INTO users (email, password, name, role, is_verified) VALUES (?, ?, ?, ?, ?)')
      .run(email, hashedPass, name, role, 1);
    return result.lastInsertRowid;
  }
  // Always update password and role for demo to ensure consistency
  db.prepare('UPDATE users SET password = ?, role = ? WHERE email = ?').run(hashedPass, role, email);
  return user.id;
};

// Ensure Admin
ensureUser('admin@mindease.com', 'System Admin', 'admin');

// Ensure Default Patient
ensureUser('user@mindease.com', 'Test Patient', 'user');

// Ensure Doctors
const doctors = [
  { name: 'Sarah Wilson', email: 'sarah@mindease.com', spec: 'Anxiety', exp: 8, bio: 'Specializing in cognitive behavioral therapy for anxiety and panic disorders.' },
  { name: 'Michael Chen', email: 'michael@mindease.com', spec: 'Depression', exp: 12, bio: 'Compassionate care for clinical depression and mood disorders.' },
  { name: 'Emily Rodriguez', email: 'emily@mindease.com', spec: 'Stress Management', exp: 5, bio: 'Helping professionals find balance and manage workplace stress.' },
  { name: 'David Park', email: 'david@mindease.com', spec: 'Relationship', exp: 10, bio: 'Expert in couples therapy and interpersonal communication.' }
];

doctors.forEach((doc, i) => {
  const userId = ensureUser(doc.email, doc.name, 'doctor');
  
  const profile = db.prepare('SELECT user_id FROM doctor_profiles WHERE user_id = ?').get(userId);
  if (!profile) {
    db.prepare(`
      INSERT INTO doctor_profiles (user_id, license_id, specialization, experience, bio, is_approved, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, `LIC-00${i+1}`, doc.spec, doc.exp, doc.bio, 1, 4.5 + (i * 0.1));
  } else {
    // Force approve
    db.prepare('UPDATE doctor_profiles SET is_approved = 1 WHERE user_id = ?').run(userId);
  }
});

export default db;
