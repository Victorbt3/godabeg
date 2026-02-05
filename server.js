require('dotenv').config();
console.log('--- Server Booting ---');
console.log('Node Version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port Configured:', process.env.PORT);

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json()); // Parse JSON request bodies

// serve frontend files (home.html, scan.html, css, js, etc.) from project root
const path = require('path');
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const PY_SERVICE = process.env.PY_SERVICE_URL || 'http://localhost:8000';

// use memory storage so we can forward buffer directly
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Root route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbAvailable ? 'connected' : 'in-memory',
    port: PORT
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbAvailable ? 'connected' : 'in-memory',
    port: PORT
  });
});

app.post('/api/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    // basic validation
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'invalid_type' });

    // Try to forward to python ML service
    try {
      const form = new FormData();
      form.append('image', req.file.buffer, { filename: req.file.originalname || 'upload.jpg', contentType: req.file.mimetype });

      const headers = form.getHeaders();

      const resp = await axios.post(`${PY_SERVICE}/predict`, form, { headers, timeout: 10000 });
      if (resp && resp.data) {
        // validate python response
        const body = resp.data;
        if (body.emotion && typeof body.confidence !== 'undefined') {
          return res.status(resp.status).json({
            emotion: body.emotion,
            confidence: Number(body.confidence),
            happy: Number(body.happy || 0),
            neutral: Number(body.neutral || 0),
            surprise: Number(body.surprise || 0),
            bbox: body.bbox || null
          });
        }
      }
    } catch (mlError) {
      console.warn('ML service unavailable, using fallback:', mlError.message);
    }
    
    // Fallback: return a mock prediction if ML service is down
    const emotions = ['happy', 'neutral', 'sad', 'surprised', 'angry', 'fearful'];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    const confidence = 0.70 + Math.random() * 0.25;
    
    return res.status(200).json({
      emotion: randomEmotion,
      confidence: confidence,
      happy: randomEmotion === 'happy' ? 80 + Math.random() * 15 : 10 + Math.random() * 20,
      neutral: randomEmotion === 'neutral' ? 75 + Math.random() * 20 : 10 + Math.random() * 25,
      surprise: randomEmotion === 'surprised' ? 70 + Math.random() * 25 : 5 + Math.random() * 15,
      bbox: null,
      fallback: true
    });
  } catch (err) {
    console.error('API /api/scan error:', err.message || err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// --- Text Analysis ---
app.post('/analyze_text', express.json(), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'no_text' });
    
    // Forward to Python service
    const resp = await axios.post(`${PY_SERVICE}/analyze_text`, { text }, { timeout: 10000 });
    if (resp && resp.data) {
      const body = resp.data;
      if (body.emotion && typeof body.confidence !== 'undefined') {
        return res.json({ emotion: body.emotion, confidence: Number(body.confidence), happy: body.happy || 0, neutral: body.neutral || 0, surprise: body.surprise || 0 });
      }
    }
    return res.status(502).json({ error: 'invalid_response' });
  } catch (err) {
    console.error('Text analysis error:', err.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// --- Save Text Entry ---
app.post('/save_text_entry', express.json(), async (req, res) => {
  try {
    const { user_id, text, emotion, confidence } = req.body;
    if (!user_id || !text) return res.status(400).json({ error: 'missing_fields' });
    
    // Forward to Python service
    const resp = await axios.post(`${PY_SERVICE}/save_text_entry`, { user_id, text, emotion, confidence }, { timeout: 10000 });
    return res.json(resp.data);
  } catch (err) {
    console.error('Save text entry error:', err.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// --- User Auth System ---

app.post('/api/register', express.json(), async (req, res) => {
  const { email, password, name } = req.body;
  console.log(`[Auth] Registration attempt for: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (dbAvailable && User) {
      // Create user in database
      const existingUser = await User.findOne({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(409).json({ success: false, error: 'email_exists' });
      }

      const user = await User.create({
        email: normalizedEmail,
        password: password, // Simple string for now, as per user's setup
        name: name || normalizedEmail.split('@')[0]
      });

      console.log(`[Auth] User registered in DB: ${user.email} (ID: ${user.id})`);
      return res.status(201).json({ success: true, id: user.id, email: user.email, name: user.name });
    } else {
      // In-memory fallback
      if (users.has(normalizedEmail)) {
        return res.status(409).json({ success: false, error: 'email_exists' });
      }

      const user = {
        id: userIdCounter++,
        email: normalizedEmail,
        password,
        name: name || normalizedEmail.split('@')[0]
      };

      users.set(normalizedEmail, user);
      console.log(`[Auth] User registered in memory: ${user.email}`);
      return res.status(201).json({ success: true, id: user.id, email: user.email, name: user.name });
    }
  } catch (err) {
    console.error(`[Auth] Registration error:`, err);
    return res.status(500).json({ success: false, error: 'server_error', message: err.message });
  }
});

app.post('/api/login', express.json(), async (req, res) => {
  const { email, password } = req.body;
  console.log(`[Auth] Login attempt for: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (dbAvailable && User) {
      const user = await User.findOne({ where: { email: normalizedEmail, password: password } });
      if (!user) {
        console.log(`[Auth] Login failed for: ${normalizedEmail}`);
        return res.status(401).json({ success: false, error: 'invalid_credentials' });
      }

      console.log(`[Auth] Login successful for: ${user.email}`);
      return res.json({ success: true, id: user.id, email: user.email, name: user.name });
    } else {
      // In-memory fallback
      const user = users.get(normalizedEmail);
      if (!user || user.password !== password) {
        console.log(`[Auth] Login failed for: ${normalizedEmail} (Memory)`);
        return res.status(401).json({ success: false, error: 'invalid_credentials' });
      }

      console.log(`[Auth] Login successful for: ${user.email} (Memory)`);
      return res.json({ success: true, id: user.id, email: user.email, name: user.name });
    }
  } catch (err) {
    console.error(`[Auth] Login error:`, err);
    return res.status(500).json({ success: false, error: 'server_error', message: err.message });
  }
});

// --- Save Scan Result ---
app.post('/api/save_scan', async (req, res) => {
  const { userId, imageUrl, emotion, confidence } = req.body;
  if (!userId || !emotion) return res.status(400).json({ error: 'missing_fields' });
  try {
    const scan = await Scan.create({ userId, imageUrl, emotion, confidence });
    res.json(scan);
  } catch (e) {
    res.status(500).json({ error: 'db_error' });
  }
});

// --- Save Text Entry ---
app.post('/api/save_text', async (req, res) => {
  const { userId, text, emotion, confidence } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'missing_fields' });
  try {
    const entry = await TextEntry.create({ userId, text, emotion, confidence });
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: 'db_error' });
  }
});

// --- Save Advice ---
app.post('/api/save_advice', async (req, res) => {
  const { userId, scanId, textEntryId, advice } = req.body;
  if (!userId || !advice) return res.status(400).json({ error: 'missing_fields' });
  try {
    const adv = await Advice.create({ userId, scanId, textEntryId, advice });
    res.json(adv);
  } catch (e) {
    res.status(500).json({ error: 'db_error' });
  }
});

// --- Get User History ---
app.get('/api/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const scans = await Scan.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    const texts = await TextEntry.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    const advices = await Advice.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    res.json({ scans, texts, advices });
  } catch (e) {
    res.status(500).json({ error: 'db_error' });
  }
});

// --- In-Memory Storage (fallback when no DB) ---
const users = new Map(); // email -> {id, name, email, password}
const scans = [];
const textEntries = [];
const adviceList = [];
let userIdCounter = 1;

// --- DB Setup (optional) ---
let User, Scan, TextEntry, Advice, sequelize;
let dbAvailable = false;

// Initialize database if not on Vercel
async function initDatabase() {
  if (process.env.VERCEL) {
    console.log('⚠️  Vercel environment - using in-memory storage');
    return;
  }
  
  try {
    const db = require('./db');
    sequelize = db.sequelize;
    User = db.User;
    Scan = db.Scan;
    TextEntry = db.TextEntry;
    Advice = db.Advice;
    
    await sequelize.sync();
    dbAvailable = true;
    console.log('✅ Database connected and synced');
  } catch (err) {
    console.warn('⚠️  Database unavailable, using in-memory storage:', err.message);
    dbAvailable = false;
  }
}

// Start server
async function startServer() {
  await initDatabase();
  
  if (process.env.VERCEL) {
    module.exports = app;
  } else {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Python ML service: ${PY_SERVICE}`);
      console.log(`💾 Database: ${dbAvailable ? 'Connected (PostgreSQL)' : 'In-Memory Mode'}\n`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, closing server gracefully...');
      server.close(() => {
        console.log('Server closed');
        if (sequelize) sequelize.close();
        process.exit(0);
      });
    });
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
