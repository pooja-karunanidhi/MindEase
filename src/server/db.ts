import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL from environment variables (set in Vercel)
if (!process.env.DATABASE_URL) {
  console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing.');
} else {
  const prefix = process.env.DATABASE_URL.substring(0, 10);
  console.log(`DATABASE_URL is present (starts with: ${prefix}...). Attempting to connect...`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const SEED_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

export const initDb = async () => {
  if (!process.env.DATABASE_URL) return;
  
  console.log('Initializing database...');
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    console.log('Creating tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT CHECK(role IN ('user', 'doctor', 'admin')) DEFAULT 'user',
        is_verified INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS doctor_profiles (
        user_id INTEGER PRIMARY KEY,
        license_id TEXT UNIQUE NOT NULL,
        specialization TEXT NOT NULL,
        experience INTEGER NOT NULL,
        bio TEXT,
        is_approved INTEGER DEFAULT 0,
        rating FLOAT DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'in-progress')) DEFAULT 'pending',
        notes TEXT,
        remedy_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(appointment_id) REFERENCES appointments(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(appointment_id) REFERENCES appointments(id),
        FOREIGN KEY(sender_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS mood_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        mood TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS doctor_availability (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY(doctor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS progress_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        appointment_id INTEGER NOT NULL,
        log_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(appointment_id) REFERENCES appointments(id)
      );
    `);

    // Seed initial data
    const hashedPass = SEED_PASSWORD_HASH;

    const ensureUser = async (email: string, name: string, role: string) => {
      const res = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (res.rows.length === 0) {
        const insertRes = await client.query(
          'INSERT INTO users (email, password, name, role, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [email, hashedPass, name, role, 1]
        );
        return insertRes.rows[0].id;
      }
      await client.query('UPDATE users SET password = $1, role = $2 WHERE email = $3', [hashedPass, role, email]);
      return res.rows[0].id;
    };

    // Ensure Admin
    await ensureUser('admin@mindease.com', 'System Admin', 'admin');

    // Ensure Default Patient
    await ensureUser('user@mindease.com', 'Test Patient', 'user');

    // Ensure Doctors
    const doctors = [
      { name: 'Sarah Wilson', email: 'sarah@mindease.com', spec: 'Anxiety', exp: 8, bio: 'Specializing in cognitive behavioral therapy for anxiety and panic disorders.' },
      { name: 'Michael Chen', email: 'michael@mindease.com', spec: 'Depression', exp: 12, bio: 'Compassionate care for clinical depression and mood disorders.' },
      { name: 'Emily Rodriguez', email: 'emily@mindease.com', spec: 'Stress Management', exp: 5, bio: 'Helping professionals find balance and manage workplace stress.' },
      { name: 'David Park', email: 'david@mindease.com', spec: 'Relationship', exp: 10, bio: 'Expert in couples therapy and interpersonal communication.' }
    ];

    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i];
      const userId = await ensureUser(doc.email, doc.name, 'doctor');
      
      const profileRes = await client.query('SELECT user_id FROM doctor_profiles WHERE user_id = $1', [userId]);
      if (profileRes.rows.length === 0) {
        await client.query(`
          INSERT INTO doctor_profiles (user_id, license_id, specialization, experience, bio, is_approved, rating)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [userId, `LIC-00${i+1}`, doc.spec, doc.exp, doc.bio, 1, 4.5 + (i * 0.1)]);
      } else {
        await client.query('UPDATE doctor_profiles SET is_approved = 1 WHERE user_id = $1', [userId]);
      }
    }

    await client.query('COMMIT');
    console.log('Database initialization complete.');
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error('Database initialization error:', e);
  } finally {
    if (client) client.release();
  }
};

export default pool;
