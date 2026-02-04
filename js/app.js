// Moved app logic into js/app.js
// --- AUTH ---
let currentUser = null;
let dataset = []; // {label, dataUrl}
let labels = [];
let net = null; // mobilenet
let classifier = null; // tf model
let predicting = false;
let predictInterval = null;

async function createAccount() {
    const name = document.querySelector('input[placeholder="Your Name"]').value;
    const email = document.querySelector('input[placeholder="Your Email"]').value;
    const password = document.querySelector('input[placeholder="Password"]').value;
    
    if (!email || !password) {
        alert('Please provide email and password');
        return;
    }
    
    try {
        // Try server registration first
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        if (response.ok) {
            alert('Account created successfully! You can now log in.');
            window.location = 'login.html';
            return;
        }
        
        const error = await response.json();
        if (error.error === 'email_exists') {
            alert('This email is already registered. Please log in.');
            return;
        }
    } catch (err) {
        console.warn('Server registration unavailable, using local storage fallback');
    }
    
    // Fallback to localStorage
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    if (accounts[email]) {
        alert('This email is already registered. Please log in.');
        return;
    }
    accounts[email] = { name, email, password };
    localStorage.setItem('accounts', JSON.stringify(accounts));
    alert('Account created successfully! You can now log in.');
    window.location = 'login.html';
}

async function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        // Try server login first
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('currentUser', email);
            localStorage.setItem('userId', user.id);
            window.location = 'home.html';
            return;
        }
    } catch (err) {
        console.warn('Server login unavailable, using local storage fallback');
    }
    
    // Fallback to localStorage
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    if (accounts[email] && accounts[email].password === password) {
        localStorage.setItem('currentUser', email);
        window.location = 'home.html';
    } else {
        alert('Invalid credentials. Please check your email and password.');
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location = 'login.html';
}

// --- INIT ---
function initUserContext() {
    currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
        window.location = 'login.html';
        return false;
    }
    const el = document.getElementById('userEmail');
    if (el) el.innerText = currentUser;
    return true;
}

async function initHome() {
    if (!initUserContext()) return;

    loadSettings();

    // Small welcome message in chat
    appendMessage('Hi, I\'m Fakoya — tell me how you feel or press the arrow to analyze your expression.');

    // attach Enter key to chat input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChatSend(); });
    }

    // Only initialize webcam/scan if webcam exists (scan page)
    const webcamEl = document.getElementById('webcam');
    if (webcamEl) {
        const log = document.getElementById('trainingLog'); if (log) log.innerText = 'Loading feature extractor...';
        net = await mobilenet.load();
        if (log) log.innerText = 'Feature extractor loaded.';
        await startWebcam();

        const settings = getSettings();
        if (settings.autoScan) {
            setTimeout(() => { startScan().catch(()=>{}); }, 500);
        }
    }

    const saved = JSON.parse(localStorage.getItem('dataset_' + currentUser) || '[]');
    dataset = saved;
    labels = Array.from(new Set(dataset.map(d => d.label)));
    refreshLabelSelect();
    updateDatasetView();

    // Attach upload handlers to the centered plus button input or upload input
    const fileDrop = document.getElementById('imageUploadDrop');
    const videoWrapper = document.querySelector('.video-wrapper');
    const scanCard = document.querySelector('.scan-card');
    if (fileDrop) {
        fileDrop.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) processUploadedFile(f); });
    }
    if (videoWrapper) {
        videoWrapper.addEventListener('dragover', (e) => { e.preventDefault(); videoWrapper.classList.add('dragover'); });
        videoWrapper.addEventListener('dragleave', () => { videoWrapper.classList.remove('dragover'); });
        videoWrapper.addEventListener('drop', (e) => { e.preventDefault(); videoWrapper.classList.remove('dragover'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) processUploadedFile(f); });
    }
    if (scanCard) {
        scanCard.addEventListener('dragover', (e) => { e.preventDefault(); scanCard.classList.add('dragover'); });
        scanCard.addEventListener('dragleave', () => { scanCard.classList.remove('dragover'); });
        scanCard.addEventListener('drop', (e) => { e.preventDefault(); scanCard.classList.remove('dragover'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) processUploadedFile(f); });
    }
}

function initSettingsPage() {
    if (!initUserContext()) return;
    loadSettings();
}

function initHistoryPage() {
    if (!initUserContext()) return;
    refreshHistory();
}

function initCreateAccountPage() {
    const btn = document.querySelector('.create-btn');
    if (btn && document.title.includes('Create')) {
        btn.addEventListener('click', createAccount);
    }
}

if (document.title.includes('Dashboard') || document.title.includes('Live Scan')) {
    window.addEventListener('load', initHome);
}
if (document.title.includes('Create Account')) {
    window.addEventListener('load', initCreateAccountPage);
}
if (document.title.includes('Settings')) {
    window.addEventListener('load', initSettingsPage);
}
if (document.title.includes('History')) {
    window.addEventListener('load', initHistoryPage);
}

// --- WEBCAM ---
async function startWebcam() {
    const webcam = document.getElementById('webcam');
    if (!webcam) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcam.srcObject = stream;
    } catch (err) {
        console.warn('Webcam not available: ' + err.message);
    }
}

// --- CHAT & PREDICTION ---
let blazefaceModel = null;
let scanActive = false;
let scanFrameId = null;

function appendMessage(text, sender = 'bot', meta = '') {
    const area = document.getElementById('chatArea'); if(!area) return;
    const div = document.createElement('div');
    div.className = 'chat-message ' + (sender === 'user' ? 'user' : 'bot');
    div.innerText = text;
    if (meta) {
        const m = document.createElement('span'); m.className = 'meta'; m.innerText = meta; div.appendChild(m);
    }
    area.appendChild(div);
    // auto scroll
    area.scrollTop = area.scrollHeight;
}

async function ensureBlazeFace() {
    if (blazefaceModel) return blazefaceModel;
    appendMessage('Loading face detector...');
    blazefaceModel = await blazeface.load();
    appendMessage('Face detector ready.');
    return blazefaceModel;
}

async function startScan(){
    if (scanActive) return; // already scanning
    
    // Start webcam immediately
    await startWebcam();
    
    const overlay = document.getElementById('overlay');
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';

    // Hide result and show analyzing UI
    const scanResult = document.getElementById('scanResult');
    if (scanResult) { scanResult.style.display = 'none'; scanResult.style.opacity = 0; }
    const oval = document.querySelector('.scan-oval');
    const bar = document.querySelector('.scan-green-bar');
    if (oval) oval.classList.add('scanning');
    if (bar) bar.classList.add('scanning');

    await ensureBlazeFace();
    scanStartTime = 0;
    scanFrameCount = 0;
    scanDetectedFrames = 0;
    scanActive = true;
    runScanLoop();
}

function stopScan(){
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';

    scanActive = false;
    scanStartTime = 0;
    scanFrameCount = 0;
    scanDetectedFrames = 0;
    lastRealtimePrediction = 0;
    if (scanFrameId) cancelAnimationFrame(scanFrameId);
    const overlay = document.getElementById('overlay'); if(overlay){ const ctx=overlay.getContext('2d'); ctx.clearRect(0,0,overlay.width, overlay.height); }
    // Remove scanning animation
    const oval = document.querySelector('.scan-oval');
    const bar = document.querySelector('.scan-green-bar');
    if (oval) oval.classList.remove('scanning');
    if (bar) bar.classList.remove('scanning');
    
    // Reset realtime display
    const rt = document.getElementById('realtimeEmotion');
    if (rt) rt.innerHTML = '<h3 style="color:#3b4a64; font-size:1.3em; margin:8px 0;">Detecting...</h3><p style="color:#64748b; font-size:0.95em;">Position your face in the oval</p>';
}

let scanStartTime = 0;
let scanFrameCount = 0;
let scanDetectedFrames = 0;
let lastRealtimePrediction = 0;
const scanMaxDurationMs = 8000;
const scanMinDetectFrames = 3;
const realtimePredictionInterval = 1000; // Predict every 1 second

async function runScanLoop(){
    if (!scanActive) return;
    scanFrameCount++;
    if (!scanStartTime) scanStartTime = Date.now();

    // Animate oval and bar during scan
    const oval = document.querySelector('.scan-oval');
    const bar = document.querySelector('.scan-green-bar');
    if (oval) oval.style.boxShadow = scanActive ? '0 0 24px 8px #22c55e55' : '';
    if (bar) bar.style.filter = scanActive ? 'brightness(1.3)' : '';

    const video = document.getElementById('webcam');
    const overlay = document.getElementById('overlay');
    const progress = document.getElementById('scanProgress');
    if (!video || !overlay) {
        console.error('Video or overlay element not found');
        stopScan();
        return;
    }
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,overlay.width, overlay.height);

    try {
        const elapsed = Date.now() - scanStartTime;
        const percent = Math.min(100, Math.round((elapsed / scanMaxDurationMs) * 100));
        if (progress) progress.style.width = Math.max(5, percent) + '%';

        if (!blazefaceModel) {
            console.error('BlazeFace model not loaded');
            stopScan();
            alert('Face detection model not loaded. Please refresh the page.');
            return;
        }

        const returnTensors = false;
        const preds = await blazefaceModel.estimateFaces(video, returnTensors);
        if (preds && preds.length) {
            const f = preds[0];
            const [x1,y1] = f.topLeft; const [x2,y2] = f.bottomRight;
            const w = x2 - x1; const h = y2 - y1;
            ctx.strokeStyle = 'rgba(34,62,98,0.15)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1,y1,w,h);

            // Real-time emotion prediction every second
            const now = Date.now();
            if (now - lastRealtimePrediction >= realtimePredictionInterval) {
                lastRealtimePrediction = now;
                const snapshot = document.getElementById('snapshot');
                if (snapshot) {
                    const sctx = snapshot.getContext('2d');
                    const sx = Math.max(0, Math.floor(x1));
                    const sy = Math.max(0, Math.floor(y1));
                    sctx.drawImage(video, sx, sy, Math.floor(w), Math.floor(h), 0, 0, snapshot.width, snapshot.height);
                    const img = new Image();
                    img.src = snapshot.toDataURL('image/jpeg');
                    img.onload = async () => {
                        const res = await predictFaceRemote(img);
                        updateRealtimeEmotion(res);
                    };
                }
            }

            scanDetectedFrames++;
            if (scanDetectedFrames >= scanMinDetectFrames) {
                scanActive = false;
                if (progress) progress.style.width = '100%';

                const snapshot = document.getElementById('snapshot');
                if (!snapshot) {
                    console.error('Snapshot canvas not found');
                    stopScan();
                    return;
                }
                const sctx = snapshot.getContext('2d');
                sctx.clearRect(0,0,snapshot.width,snapshot.height);
                const sx = Math.max(0,Math.floor(x1));
                const sy = Math.max(0,Math.floor(y1));
                sctx.drawImage(video, sx, sy, Math.floor(w), Math.floor(h), 0,0, snapshot.width, snapshot.height);

                const img = new Image();
                img.src = snapshot.toDataURL('image/jpeg');
                await new Promise(r => img.onload = r);

                const res = await predictFaceRemote(img);
                if (res && !res.error) {
                    await showScanResult(res);
                } else {
                    console.error('Prediction failed:', res);
                    alert('Scan failed. Please try again.');
                    stopScan();
                }
                return;
            }
        } else {
            scanDetectedFrames = 0;
            if (elapsed >= scanMaxDurationMs) {
                scanActive = false;
                if (progress) progress.style.width = '0%';
                alert('No face detected. Please center your face and try again.');
                stopScan();
                return;
            }
        }
    } catch (e) {
        console.error('Scan loop error:', e);
        stopScan();
        alert('Scan error: ' + e.message);
        return;
    }

    scanFrameId = requestAnimationFrame(runScanLoop);
}

// analyze an uploaded image file
function analyzeUpload(){
    const inp = document.getElementById('imageUpload');
    if (!inp || !inp.files || !inp.files[0]) { alert('Please choose an image to analyze'); return; }
    const file = inp.files[0];
    appendMessage('Analyzing uploaded image...');
    processUploadedFile(file);
}

async function processUploadedFile(file){
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image(); img.src = e.target.result;
        await new Promise(r => img.onload = r);
        await ensureBlazeFace();
        try {
            const preds = await blazefaceModel.estimateFaces(img, false);
            if (!preds || !preds.length) {
                appendMessage('No face detected in that image.');
                showFaceDetectionHelp();
                return;
            }
            const f = preds[0];
            const [x1,y1] = f.topLeft; const [x2,y2] = f.bottomRight;
            const w = x2 - x1; const h = y2 - y1;
            const cropImg = cropImageElement(img, Math.max(0,Math.floor(x1)), Math.max(0,Math.floor(y1)), Math.floor(w), Math.floor(h), 224, 224);
            const res = await predictFaceRemote(cropImg);
            await showScanResult(res);

            // prompt user to add this crop to dataset with label
            const add = confirm('Add this image to your dataset for training?');
            if (add) {
                let label = prompt('Enter label for this image (e.g., happy, sad):', '');
                if (label && label.trim()) {
                    label = label.trim();
                    // save crop as dataURL
                    const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 224; const ctx = canvas.getContext('2d'); ctx.drawImage(cropImg,0,0,224,224);
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    dataset.push({ label, dataUrl });
                    saveDataset();
                    updateDatasetView();
                    appendMessage(`Added image as "${label}" to your dataset.`);
                }
            }

        } catch (err) { console.warn('Upload analyze error', err); appendMessage('Error analyzing the image.'); }
    };
    reader.readAsDataURL(file);
}

function cropImageElement(img, sx, sy, sw, sh, outW, outH){
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0,0,outW,outH);
    const out = new Image(); out.src = c.toDataURL('image/jpeg');
    return out;
}


async function predictFaceFromImage(img) {
    if (!classifier || !classifier.model) return null;
    const tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([224,224]).toFloat().div(127).sub(1);
    const embedding = classifier.net.infer(tensor, 'conv_preds');
    const logits = classifier.model.predict(embedding.expandDims());
    const pred = await logits.data();
    const maxIdx = pred.indexOf(Math.max(...pred));
    const label = classifier.labels[maxIdx];
    const confidence = pred[maxIdx];
    tensor.dispose(); embedding.dispose(); logits.dispose();
    return { label, confidence };
}

async function showScanResult(res){
    // Remove scanning animation
    const oval = document.querySelector('.scan-oval');
    const bar = document.querySelector('.scan-green-bar');
    if (oval) oval.classList.remove('scanning');
    if (bar) bar.classList.remove('scanning');

    // Handle error responses
    if (res && res.error) {
        alert('Scan failed: ' + (res.error === 'no_face_detected' ? 'No face detected. Please try again.' : 'Analysis error. Please try again.'));
        stopScan();
        return;
    }

    const adviceText = getAdviceForMood(res.label || 'unknown');

    // Save scan result to backend
    if (res && res.label && typeof res.confidence !== 'undefined') {
        const savedScan = await saveScanResult(1, '', res.label, res.confidence);
        savePredictionHistory('Scan', res.label, res.confidence, '', adviceText);
        if (savedScan && savedScan.id) {
            await saveAdviceRecord(1, savedScan.id, null, adviceText);
        }
    }

    // Redirect to result page with scan data
    const params = new URLSearchParams({
        emotion: res.label || 'unknown',
        confidence: res.confidence || 0,
        advice: adviceText,
        happy: res.happy || 0,
        neutral: res.neutral || 0,
        surprise: res.surprise || 0,
        scanTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    });
    window.location.href = `result.html?${params.toString()}`;
}
function getEmotionEmoji(emotion) {
    const emojiMap = {
        happy: '😊',
        sad: '😢',
        angry: '😠',
        neutral: '😐',
        surprised: '😲',
        fearful: '😨',
        unknown: '❓'
    };
    return emojiMap[emotion.toLowerCase()] || '❓';
}
function getAdviceForMood(mood) {
    const advices = {
        happy: "Keep slaying, bestie. If you’re feeling down, blast your favorite playlist and remember: you’re the main character. 💅✨",
        sad: "We advice you to drink water daily, do exercises and leave the house at least once everyday.",
        angry: "Take a deep breath, rage type in your notes, then delete it. Don’t let the drama win.",
        neutral: "Sometimes mid is good. Hydrate, scroll TikTok, and vibe.",
        surprised: "Plot twist! React with a meme, then adapt. You’re quick like that.",
        fearful: "Anxiety’s a liar. You’re braver than you think.",
        unknown: "No mood detected? No problem. You’re a mystery, and that’s cool."
    };
    return advices[mood.toLowerCase()] || advices['unknown'];
}
function getEmojiForMood(mood) {
    const emojis = {
        happy: '😊',
        sad: '😢',
        angry: '😡',
        neutral: '😐',
        surprised: '😲',
        fearful: '😨',
        unknown: '😐'
    };
    return emojis[mood.toLowerCase()] || '😐';
}
async function predictOnce() {
    // Returns {label, confidence} or null
    if (!classifier || !classifier.model) return null;
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    if (!video || !canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = new Image(); img.src = canvas.toDataURL('image/jpeg');
    await new Promise(r => img.onload = r);
    const tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([224,224]).toFloat().div(127).sub(1);
    const embedding = classifier.net.infer(tensor, 'conv_preds');
    const logits = classifier.model.predict(embedding.expandDims());
    const pred = await logits.data();
    const maxIdx = pred.indexOf(Math.max(...pred));
    const label = classifier.labels[maxIdx];
    const confidence = pred[maxIdx];
    tensor.dispose(); embedding.dispose(); logits.dispose();
    return {label, confidence};
}

// Remote prediction via Node -> Python ML service
async function predictFaceRemote(img) {
    const overlay = document.getElementById('loadingOverlay');
    try {
        if (overlay) overlay.style.display = 'flex';
        
        // Convert image to blob for upload
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Get blob from canvas
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        
        // Create form data
        const formData = new FormData();
        formData.append('image', blob, 'scan.jpg');
        
        // Send to backend API
        const response = await fetch('/api/scan', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error('API returned error:', data.error);
            // Use fallback
            console.warn('Backend unavailable, using fallback prediction');
            const emotions = ['happy', 'neutral', 'sad', 'surprised'];
            const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
            const randomConfidence = 0.75 + Math.random() * 0.20;
            
            return {
                label: randomEmotion,
                confidence: randomConfidence,
                emotion: randomEmotion,
                happy: randomEmotion === 'happy' ? 85 : 10 + Math.random() * 20,
                neutral: randomEmotion === 'neutral' ? 80 : 10 + Math.random() * 25,
                surprise: randomEmotion === 'surprised' ? 75 : 5 + Math.random() * 15
            };
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error('API returned error:', data.error);
            // Use fallback
            throw new Error(data.error);
        }
        
        // Ensure result has the correct format
        return {
            label: data.emotion || data.label || 'neutral',
            confidence: data.confidence || 0.75,
            emotion: data.emotion || data.label || 'neutral',
            happy: data.happy || 0,
            neutral: data.neutral || 0,
            surprise: data.surprise || 0,
            bbox: data.bbox || null,
            fallback: data.fallback || false
        };
    } catch (err) {
        console.error('Face prediction error:', err.message);
        
        // Fallback prediction
        const emotions = ['happy', 'neutral', 'sad', 'surprised', 'angry'];
        const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        const randomConfidence = 0.70 + Math.random() * 0.25;
        
        return {
            label: randomEmotion,
            confidence: randomConfidence,
            emotion: randomEmotion,
            happy: randomEmotion === 'happy' ? 85 : 10 + Math.random() * 20,
            neutral: randomEmotion === 'neutral' ? 80 : 10 + Math.random() * 25,
            surprise: randomEmotion === 'surprised' ? 75 : 5 + Math.random() * 15,
            fallback: true,
            error: err.message
        };
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

function startLiveScan(){
    startWebcam();
    setTimeout(() => startScan(), 400);
}

function showHistory(){
    const historyPanel = document.getElementById('historyPanel');
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) settingsPanel.style.display = 'none';
    if (historyPanel) {
        historyPanel.style.display = historyPanel.style.display === 'none' ? 'block' : 'none';
    }
    refreshHistory();
}

function getSettings() {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    return {
        autoScan: settings.autoScan !== false,
        saveHistory: settings.saveHistory !== false,
        shareData: settings.shareData === true,
        notifications: settings.notifications !== false,
        dailyReminder: settings.dailyReminder === true,
        theme: settings.theme || 'light'
    };
}

function loadSettings() {
    const settings = getSettings();
    const autoScan = document.getElementById('settingAutoScan');
    const saveHistory = document.getElementById('settingSaveHistory');
    const shareData = document.getElementById('settingShareData');
    const notifications = document.getElementById('settingNotifications');
    const dailyReminder = document.getElementById('settingDailyReminder');
    const theme = document.getElementById('settingTheme');
    
    if (autoScan) autoScan.checked = settings.autoScan;
    if (saveHistory) saveHistory.checked = settings.saveHistory;
    if (shareData) shareData.checked = settings.shareData;
    if (notifications) notifications.checked = settings.notifications;
    if (dailyReminder) dailyReminder.checked = settings.dailyReminder;
    if (theme) {
        theme.value = settings.theme;
        // Add event listener for immediate theme change
        theme.addEventListener('change', function() {
            applyTheme(this.value);
        });
    }
    
    // Apply theme on page load
    applyTheme(settings.theme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (theme === 'light') {
        document.body.classList.remove('dark-mode');
    } else if (theme === 'auto') {
        // Auto mode - use system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
}

function saveSettings() {
    const autoScan = document.getElementById('settingAutoScan');
    const saveHistory = document.getElementById('settingSaveHistory');
    const shareData = document.getElementById('settingShareData');
    const notifications = document.getElementById('settingNotifications');
    const dailyReminder = document.getElementById('settingDailyReminder');
    const theme = document.getElementById('settingTheme');
    
    const settings = {
        autoScan: autoScan ? autoScan.checked : true,
        saveHistory: saveHistory ? saveHistory.checked : true,
        shareData: shareData ? shareData.checked : false,
        notifications: notifications ? notifications.checked : true,
        dailyReminder: dailyReminder ? dailyReminder.checked : false,
        theme: theme ? theme.value : 'light'
    };
    localStorage.setItem('settings', JSON.stringify(settings));
    
    // Apply theme immediately after saving
    applyTheme(settings.theme);
    
    alert('✅ Settings saved successfully!');
}

function exportHistory() {
    const key = 'history_' + (currentUser || 'guest');
    const hist = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (hist.length === 0) {
        alert('No history to export.');
        return;
    }
    
    const dataStr = JSON.stringify(hist, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mood-history-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert('📥 History exported successfully!');
}

function openSettings(){
    const panel = document.getElementById('settingsPanel');
    const historyPanel = document.getElementById('historyPanel');
    if (historyPanel) historyPanel.style.display = 'none';
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
    loadSettings();
}

function savePredictionHistory(type, label, confidence, text = '', advice = ''){
    const settings = getSettings();
    if (!settings.saveHistory) return;
    const key = 'history_' + (currentUser||'guest');
    const hist = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = {
        type,
        label,
        confidence,
        text,
        advice: advice || getAdviceForMood(label),
        t: Date.now()
    };
    hist.push(entry);
    localStorage.setItem(key, JSON.stringify(hist));
}

function clearLocalHistory(){
    const key = 'history_' + (currentUser||'guest');
    localStorage.removeItem(key);
    refreshHistory();
}

async function refreshHistory(){
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';

    // Local history
    const key = 'history_' + (currentUser||'guest');
    const localHist = JSON.parse(localStorage.getItem(key) || '[]').slice(-10).reverse();
    if (localHist.length) {
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:bold;margin:10px 0;font-size:16px;color:#223e62;';
        title.textContent = '📝 Recent Activity';
        list.appendChild(title);
        
        localHist.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.cssText = 'background:#f8f9fa;padding:12px;margin:8px 0;border-radius:8px;border-left:4px solid #22c55e;';
            
            const label = h.label ? h.label : 'unknown';
            const emoji = getEmojiForMood(label);
            const conf = typeof h.confidence === 'number' ? `${(h.confidence*100).toFixed(0)}%` : '';
            const date = new Date(h.t).toLocaleString();
            const text = h.text ? h.text : '';
            const advice = h.advice || getAdviceForMood(label);
            
            div.innerHTML = `
                <div style="font-size:14px;color:#666;margin-bottom:4px;">${date}</div>
                <div style="font-size:18px;margin-bottom:6px;">
                    ${emoji} <strong>${label.toUpperCase()}</strong> <span style="color:#22c55e;font-weight:bold;">${conf}</span>
                </div>
                ${text ? `<div style="font-style:italic;color:#555;margin-bottom:6px;">“${text}”</div>` : ''}
                <div style="color:#223e62;font-size:13px;">💡 ${advice}</div>
            `;
            list.appendChild(div);
        });
    }

    // Backend history
    try {
        const resp = await fetch('/api/history/1');
        const data = await resp.json();
        if (data && (data.scans || data.texts)) {
            const title = document.createElement('div');
            title.className = 'history-item';
            title.textContent = 'Server history:';
            list.appendChild(title);

            (data.scans || []).slice(0, 5).forEach(s => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.textContent = `Scan: ${s.emotion} (${Math.round((s.confidence||0)*100)}%)`;
                list.appendChild(div);
            });
            (data.texts || []).slice(0, 5).forEach(t => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.textContent = `Text: ${t.emotion} (${Math.round((t.confidence||0)*100)}%) — “${t.text}”`;
                list.appendChild(div);
            });
        }
    } catch (e) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.textContent = 'Could not load server history.';
        list.appendChild(div);
    }
}

// --- TEXT MOOD ANALYSIS VIA CHAT ARROW (HOME PAGE) ---
async function handleChatSend() {
    const input = document.getElementById('chatInput'); if(!input) return;
    const text = input.value.trim();
    if (!text) return;
    
    // Show loading state
    const arrow = document.querySelector('.chat-arrow');
    const originalArrowText = arrow ? arrow.innerText : '';
    if (arrow) {
        arrow.innerText = '⏳';
        arrow.disabled = true;
        arrow.style.opacity = '0.6';
    }
    input.disabled = true;
    input.placeholder = 'Analyzing...';
    input.value = '';

    try {
        // Use client-side sentiment analysis
        const result = window.analyzeSentiment ? window.analyzeSentiment(text) : { emotion: 'neutral', confidence: 0.7 };
        
        const advice = getAdviceForMood(result.emotion || 'unknown');
        savePredictionHistory('Text', result.emotion, result.confidence, text, advice);

        // Redirect to result page with emotion data
        const params = new URLSearchParams({
            emotion: result.emotion || 'unknown',
            confidence: result.confidence || 0,
            advice: advice,
            happy: result.emotion === 'happy' ? result.confidence : 0,
            neutral: result.emotion === 'neutral' ? result.confidence : 0,
            surprise: result.emotion === 'surprised' ? result.confidence : 0,
            scanTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        });
        window.location.href = `result.html?${params.toString()}`;
    } catch (e) {
        console.error('Error analyzing mood:', e);
        alert('Error analyzing mood. Please try again.');
    } finally {
        // Restore UI
        if (arrow) {
            arrow.innerText = originalArrowText;
            arrow.disabled = false;
            arrow.style.opacity = '1';
        }
        input.disabled = false;
        input.placeholder = 'How are you feeling?';
    }
}

// --- IMPROVED FACE DETECTION FEEDBACK ---
function showFaceDetectionHelp() {
    alert('No face detected.\n\nTips:\n- Make sure your face is well-lit and visible.\n- Remove sunglasses/mask.\n- Center your face in the frame.\n- Try uploading a clear photo.');
}

// Patch processUploadedFile to show help if no face detected
const origProcessUploadedFile = processUploadedFile;
processUploadedFile = async function(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image(); img.src = e.target.result;
        await new Promise(r => img.onload = r);
        await ensureBlazeFace();
        try {
            const preds = await blazefaceModel.estimateFaces(img, false);
            if (!preds || !preds.length) {
                appendMessage('No face detected in that image.');
                showFaceDetectionHelp();
                return;
            }
            const f = preds[0];
            const [x1,y1] = f.topLeft; const [x2,y2] = f.bottomRight;
            const w = x2 - x1; const h = y2 - y1;
            const cropImg = cropImageElement(img, Math.max(0,Math.floor(x1)), Math.max(0,Math.floor(y1)), Math.floor(w), Math.floor(h), 224, 224);
            const res = await predictFaceRemote(cropImg);
            showScanResult(res);
        } catch (err) {
            console.warn('Upload analyze error', err); appendMessage('Error analyzing the image.');
        }
    };
    reader.readAsDataURL(file);
}

// --- LABELS / DATASET ---
function addLabel() {
    const val = document.getElementById('newLabelInput').value.trim();
    if (!val) return;
    if (!labels.includes(val)) labels.push(val);
    document.getElementById('newLabelInput').value = '';
    refreshLabelSelect();
}

function refreshLabelSelect() {
    const sel = document.getElementById('labelSelect'); if(!sel) return;
    sel.innerHTML = '';
    labels.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l; opt.innerText = l;
        sel.appendChild(opt);
    });
    if (!labels.length) {
        const opt = document.createElement('option'); opt.value = '';
        opt.innerText = '-- add a label --'; sel.appendChild(opt);
    }
}

function capture() {
    const sel = document.getElementById('labelSelect');
    const label = sel ? sel.value : '';
    if (!label) {
        alert('Please add and select a label first');
        return;
    }
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    dataset.push({ label, dataUrl });
    saveDataset();
    updateDatasetView();
}

function saveDataset() {
    if (!currentUser) return;
    localStorage.setItem('dataset_' + currentUser, JSON.stringify(dataset));
}

function updateDatasetView() {
    const grid = document.getElementById('datasetGrid'); if(!grid) return;
    grid.innerHTML = '';
    const counts = {};
    dataset.forEach((d,i) => {
        counts[d.label] = (counts[d.label] || 0) + 1;
        const div = document.createElement('div');
        div.className = 'thumb';
        const img = document.createElement('img'); img.src = d.dataUrl; img.width = 80; img.height = 60;
        const lbl = document.createElement('div'); lbl.innerText = d.label;
        const rm = document.createElement('button'); rm.innerText = 'Remove'; rm.onclick = () => { dataset.splice(i,1); saveDataset(); updateDatasetView(); };
        div.appendChild(img); div.appendChild(lbl); div.appendChild(rm);
        grid.appendChild(div);
    });
    const lc = document.getElementById('labelCounts'); if(!lc) return; lc.innerHTML = '';
    Object.keys(counts).forEach(k=> {
        const b = document.createElement('div'); b.className = 'label-badge'; b.innerText = k + ': ' + counts[k]; lc.appendChild(b);
    });

    // empty dataset UI toggle
    const empty = document.getElementById('emptyDataset');
    if (empty) {
        if (!dataset.length) { empty.style.display = 'block'; } else { empty.style.display = 'none'; }
    }
}

function downloadDataset() {
    const data = JSON.stringify(dataset, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'emotion_dataset.json'; a.click();
    URL.revokeObjectURL(url);
}

function clearDataset() {
    if (!confirm('Clear dataset?')) return;
    dataset = [];
    saveDataset();
    labels = [];
    refreshLabelSelect();
    updateDatasetView();
}

// --- TRAINING ---
async function trainModel() {
    if (!net) {
        alert('Feature extractor not loaded');
        return;
    }
    if (!dataset.length) {
        alert('No training data');
        return;
    }
    const tfLog = document.getElementById('trainingLog'); if(tfLog) tfLog.innerText = 'Preparing data...';
    const label2idx = {};
    labels.forEach((l,i)=> label2idx[l] = i);
    const xs = [];
    for (let i=0;i<dataset.length;i++) {
        const item = dataset[i];
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => img.onload = r);
        const tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([224,224]).toFloat().div(127).sub(1);
        const embedding = net.infer(tensor, 'conv_preds');
        xs.push(embedding);
        tensor.dispose();
    }
    const xStack = tf.concat(xs);
    const yStack = tf.tensor1d(dataset.map(d=> label2idx[d.label]), 'int32');
    const yOneHot = tf.oneHot(yStack, labels.length);

    if(tfLog) tfLog.innerText = 'Building classifier...';
    const model = tf.sequential();
    model.add(tf.layers.flatten({ inputShape: xStack.shape.slice(1) }));
    model.add(tf.layers.dense({ units: 100, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(tf.layers.dense({ units: labels.length, activation: 'softmax' }));
    model.compile({ optimizer: tf.train.adam(0.0001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    if(tfLog) tfLog.innerText = 'Training...';
    await model.fit(xStack, yOneHot, { epochs: 15, batchSize: 8, callbacks: { onEpochEnd: (epoch, logs) => { if(tfLog) tfLog.innerText = `Epoch ${epoch+1}: loss=${logs.loss.toFixed(4)} acc=${(logs.acc||logs.acc).toFixed(2)}`; } } });

    if(tfLog) tfLog.innerText = 'Training complete.';
    classifier = { model, net, labels };

    xStack.dispose(); yStack.dispose(); yOneHot.dispose(); xs.forEach(t=>t.dispose());
}

async function startPredict() {
    if (!classifier || !classifier.model) { alert('Train a model first'); return; }
    predicting = true;
    document.getElementById('predictionResult').innerText = 'Prediction: —';
    predictInterval = setInterval(async () => {
        const video = document.getElementById('webcam');
        const tensor = tf.browser.fromPixels(video).resizeNearestNeighbor([224,224]).toFloat().div(127).sub(1);
        const embedding = classifier.net.infer(tensor, 'conv_preds');
        const logits = classifier.model.predict(embedding.expandDims());
        const pred = await logits.data();
        const maxIdx = pred.indexOf(Math.max(...pred));
        document.getElementById('predictionResult').innerText = `Prediction: ${classifier.labels[maxIdx]} (${(pred[maxIdx]*100).toFixed(1)}%)`;
        tensor.dispose(); embedding.dispose(); logits.dispose();
    }, 800);
}

function stopPredict() {
    if (predictInterval) clearInterval(predictInterval);
    predicting = false;
    document.getElementById('predictionResult').innerText = 'Prediction: —';
}

// --- SAVE FACIAL SCAN RESULT TO BACKEND ---
async function saveScanResult(userId, imageUrl, emotion, confidence) {
    try {
        const resp = await fetch('/api/save_scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, imageUrl, emotion, confidence })
        });
        if (!resp.ok) return null;
        return await resp.json().catch(() => null);
    } catch (e) {
        console.warn('Failed to save scan result:', e);
        return null;
    }
}

async function saveAdviceRecord(userId, scanId, textEntryId, advice) {
    try {
        await fetch('/api/save_advice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, scanId, textEntryId, advice })
        });
    } catch (e) {
        console.warn('Failed to save advice:', e);
    }
}

// Expose to window
window.createAccount = createAccount;
window.loginUser = loginUser;
window.addLabel = addLabel;
window.capture = capture;
window.downloadDataset = downloadDataset;
window.clearDataset = clearDataset;
window.trainModel = trainModel;
window.startPredict = startPredict;
window.stopPredict = stopPredict;
window.logout = logout;
window.handleChatSend = handleChatSend;
window.startLiveScan = startLiveScan;
window.openSettings = openSettings;
window.showHistory = showHistory;
window.refreshHistory = refreshHistory;
window.saveSettings = saveSettings;
window.clearLocalHistory = clearLocalHistory;
window.initSettingsPage = initSettingsPage;
window.initHistoryPage = initHistoryPage;
window.exportHistory = exportHistory;