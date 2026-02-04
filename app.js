// Simple client-side app for dataset collection and training (demo only)
let currentUser = null;
let dataset = []; // {label, dataUrl}
let labels = [];
let net = null; // mobilenet
let classifier = null; // tf model
let predicting = false;
let predictInterval = null;

// --- AUTH ---
function createAccount() {
    const name = document.querySelector('input[placeholder="Your Name"]').value;
    const email = document.querySelector('input[placeholder="Your Email"]').value;
    const password = document.querySelector('input[placeholder="Password"]').value;
    if (!email || !password) {
        alert('Please provide email and password');
        return;
    }
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    accounts[email] = { name, email, password };
    localStorage.setItem('accounts', JSON.stringify(accounts));
    alert('Account created. You can now log in.');
    window.location = 'login.html';
}

function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    if (accounts[email] && accounts[email].password === password) {
        localStorage.setItem('currentUser', email);
        window.location = 'home.html';
    } else {
        alert('Invalid credentials');
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location = 'login.html';
}

// --- ON LOAD helpers ---
async function initHome() {
    currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
        window.location = 'login.html';
        return;
    }
    document.getElementById('userEmail').innerText = currentUser;
    // load mobilenet
    document.getElementById('trainingLog').innerText = 'Loading feature extractor...';
    net = await mobilenet.load();
    document.getElementById('trainingLog').innerText = 'Feature extractor loaded.';
    // start webcam
    await startWebcam();
    // restore dataset if any
    const saved = JSON.parse(localStorage.getItem('dataset_' + currentUser) || '[]');
    dataset = saved;
    labels = Array.from(new Set(dataset.map(d => d.label)));
    refreshLabelSelect();
    updateDatasetView();
}

function initCreateAccountPage() {
    // attach create account button
    const btn = document.querySelector('.create-btn');
    if (btn && document.title.includes('Create')) {
        btn.addEventListener('click', createAccount);
    }
}

if (document.title.includes('Dashboard')) {
    window.addEventListener('load', initHome);
}
if (document.title.includes('Create Account')) {
    window.addEventListener('load', initCreateAccountPage);
}

// --- WEBCAM ---
async function startWebcam() {
    const webcam = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcam.srcObject = stream;
    } catch (err) {
        alert('Could not access webcam: ' + err.message);
    }
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
    const sel = document.getElementById('labelSelect');
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
    const label = sel.value;
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
    const grid = document.getElementById('datasetGrid');
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
    const lc = document.getElementById('labelCounts'); lc.innerHTML = '';
    Object.keys(counts).forEach(k=> {
        const b = document.createElement('div'); b.className = 'label-badge'; b.innerText = k + ': ' + counts[k]; lc.appendChild(b);
    });
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
    document.getElementById('trainingLog').innerText = 'Preparing data...';
    // Map label to index
    const label2idx = {};
    labels.forEach((l,i)=> label2idx[l] = i);
    const xs = [];
    const ys = [];
    for (let i=0;i<dataset.length;i++) {
        const item = dataset[i];
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => img.onload = r);
        const tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([224,224]).toFloat().div(127).sub(1);
        const embedding = net.infer(tensor, 'conv_preds');
        xs.push(embedding);
        const labelTensor = tf.tensor1d([label2idx[item.label]], 'int32');
        ys.push(labelTensor);
        tensor.dispose();
    }
    // Stack xs
    const xStack = tf.concat(xs);
    const yStack = tf.tensor1d(dataset.map(d=> label2idx[d.label]), 'int32');
    const yOneHot = tf.oneHot(yStack, labels.length);

    document.getElementById('trainingLog').innerText = 'Building classifier...';
    // build a simple classifier
    const model = tf.sequential();
    model.add(tf.layers.flatten({ inputShape: xStack.shape.slice(1) }));
    model.add(tf.layers.dense({ units: 100, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(tf.layers.dense({ units: labels.length, activation: 'softmax' }));
    model.compile({ optimizer: tf.train.adam(0.0001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    document.getElementById('trainingLog').innerText = 'Training...';
    await model.fit(xStack, yOneHot, { epochs: 15, batchSize: 8, callbacks: { onEpochEnd: (epoch, logs) => { document.getElementById('trainingLog').innerText = `Epoch ${epoch+1}: loss=${logs.loss.toFixed(4)} acc=${(logs.acc||logs.acc).toFixed(2)}`; } } });

    document.getElementById('trainingLog').innerText = 'Training complete.';
    classifier = { model, net, labels };

    // dispose temp tensors
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

// --- EXPORTS for console ---
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
