require('dotenv').config();
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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

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

// --- User Registration ---
app.post('/api/register', express.json(), async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  
  try {
    if (dbAvailable && User) {
      const user = await User.create({ email, password, name });
      return res.json({ id: user.id, email: user.email, name: user.name });
    } else {
      // In-memory storage
      if (users.has(email.toLowerCase())) {
        return res.status(409).json({ error: 'email_exists' });
      }
      const user = { 
        id: userIdCounter++, 
        email: email.toLowerCase(), 
        password, 
        name: name || email.split('@')[0] 
      };
      users.set(email.toLowerCase(), user);
      return res.json({ id: user.id, email: user.email, name: user.name });
    }
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'email_exists' });
    }
    return res.status(500).json({ error: 'db_error', message: e.message });
  }
});

// --- User Login ---
app.post('/api/login', express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  
  try {
    if (dbAvailable && User) {
      const user = await User.findOne({ where: { email, password } });
      if (!user) return res.status(401).json({ error: 'invalid_credentials' });
      return res.json({ id: user.id, email: user.email, name: user.name });
    } else {
      // In-memory storage
      const user = users.get(email.toLowerCase());
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      return res.json({ id: user.id, email: user.email, name: user.name });
    }
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
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

if (!process.env.VERCEL) {
  try {
    const db = require('./db');
    sequelize = db.sequelize;
    User = db.User;
    Scan = db.Scan;
    TextEntry = db.TextEntry;
    Advice = db.Advice;
    
    sequelize.sync().then(() => {
      console.log('✅ Database connected and synced');
      dbAvailable = true;
    }).catch(err => {
      console.warn('⚠️  Database unavailable, using in-memory storage');
      dbAvailable = false;
    });
  } catch (err) {
    console.warn('⚠️  Database module not available, using in-memory storage');
    dbAvailable = false;
  }
}

// For Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Python ML service: ${PY_SERVICE}`);
    console.log(`💾 Database: ${dbAvailable ? 'Connected' : 'In-Memory Mode'}\n`);
  });
}
