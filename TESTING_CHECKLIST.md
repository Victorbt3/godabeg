# Testing Checklist

## ✅ Frontend Implementation Verification

### Home Dashboard (home.html)

- [ ] Page loads and shows "How are you feeling today?"
- [ ] Text input field accepts user input
- [ ] Send button triggers analysis
- [ ] Menu shows: "Start a live scan", "Settings & Privacy", "Your History", "Logout"
- [ ] User email displays in user panel

### Text Analysis Flow

- [ ] Type any text and click send arrow
- [ ] Redirects to result.html (not staying on same page)
- [ ] Result page shows emotion (happy/sad/angry/neutral/surprised)
- [ ] Shows emoji matching emotion
- [ ] Displays confidence percentage
- [ ] Shows Happy, Neutral, Surprise percentages
- [ ] Shows scan time in HH:MM format
- [ ] Displays personalized advice
- [ ] "Scan Again" button redirects to scan.html
- [ ] "Done" button returns to home.html

### Live Scan Flow

- [ ] Click "Start a live scan" from home
- [ ] Scan.html loads with webcam
- [ ] "Start Scan" button begins scanning
- [ ] Face detected and progress bar fills
- [ ] Scan completes within 2-3 seconds (not 8+ seconds)
- [ ] Redirects to result.html with emotion data
- [ ] Result page shows emotion with emoji
- [ ] All emotion percentages displayed
- [ ] Custom advice shown
- [ ] Buttons work correctly (Scan Again / Done)

### Settings & Privacy Panel

- [ ] Panel opens without errors
- [ ] Shows 3 checkboxes:
  - [ ] Auto-start live scan on Scan page (default: checked)
  - [ ] Save analysis history locally (default: checked)
  - [ ] Allow sharing anonymized data (default: unchecked)
- [ ] "Save Settings" button saves and shows alert
- [ ] "Clear Local History" button removes all history
- [ ] Settings persist after page refresh
- [ ] Panel closes when opening History panel

### History Panel

- [ ] Panel opens and shows recent analyses
- [ ] Displays local history with:
  - [ ] Type (Text or Scan)
  - [ ] Emotion detected
  - [ ] Confidence percentage
  - [ ] Timestamp
  - [ ] Text snippet (for text analyses only)
- [ ] Shows up to 10 recent entries
- [ ] "Refresh" button reloads history from server
- [ ] History entries update after new analyses
- [ ] Panel closes when opening Settings panel

### Error Handling

- [ ] Text analysis with no input shows error
- [ ] Live scan with no face detected shows message
- [ ] Network errors handled gracefully
- [ ] Scan timeout (8+ seconds) shows message

---

## 🔧 Backend API Verification

### Node Server (Port 3000)

- [ ] Server starts without errors
- [ ] Logs show "Node proxy server running on http://localhost:3000"
- [ ] Serves frontend files (CSS, JS, HTML)
- [ ] Routes properly forward to Python service

### Text Analysis Endpoint (`POST /analyze_text`)

- [ ] Request: `{ text: "user input" }`
- [ ] Response includes:
  - [ ] `emotion` (string)
  - [ ] `confidence` (number 0-1)
  - [ ] `happy` (percent 0-100)
  - [ ] `neutral` (percent 0-100)
  - [ ] `surprise` (percent 0-100)
- [ ] Handles errors gracefully

### Scan Endpoint (`POST /api/scan`)

- [ ] Accepts image upload via FormData
- [ ] Forwards to Python service
- [ ] Response includes:
  - [ ] `emotion` (string)
  - [ ] `confidence` (number 0-1)
  - [ ] `happy` (percent)
  - [ ] `neutral` (percent)
  - [ ] `surprise` (percent)
  - [ ] `bbox` (face bounding box or null)

### Save Text Endpoint (`POST /save_text_entry`)

- [ ] Accepts: `{ user_id, text, emotion, confidence }`
- [ ] Saves to database
- [ ] Returns saved entry with timestamp

### History Endpoint (`GET /api/history/:userId`)

- [ ] Returns:
  - [ ] `scans` array with emotion, confidence, timestamp
  - [ ] `texts` array with emotion, confidence, text, timestamp
  - [ ] `advices` array if available

---

## 🐍 Python Service Verification (Port 8000)

### Service Startup

- [ ] Python service starts without errors
- [ ] Logs show "Uvicorn running on http://0.0.0.0:8000"
- [ ] API docs available at http://localhost:8000/docs

### Text Analysis (`POST /analyze_text`)

- [ ] Positive text → "happy" emotion
- [ ] Negative text → "sad" emotion
- [ ] Neutral text → "neutral" emotion
- [ ] Returns confidence 0-1
- [ ] Returns Happy, Neutral, Surprise percentages

### Face Detection (`POST /predict`)

- [ ] Accepts image upload
- [ ] Detects face and analyzes emotion
- [ ] Returns emotion classification
- [ ] Returns all emotion percentages
- [ ] Returns face bounding box
- [ ] No face → error 422 with "no_face_detected"

### Database

- [ ] Database tables created automatically
- [ ] Text entries saved with user_id, text, emotion, timestamp
- [ ] Scan results saved with user_id, emotion, confidence, timestamp
- [ ] Can retrieve history without errors

---

## 📊 Local Storage Verification

### Settings Storage

- [ ] Open browser DevTools (F12)
- [ ] Go to Application → LocalStorage
- [ ] Should see key: `settings`
- [ ] Value contains: `{"autoScan": bool, "saveHistory": bool, "shareData": bool}`

### History Storage

- [ ] Key: `history_<email>`
- [ ] Contains array of:
  ```
  {
    "type": "Text" or "Scan",
    "label": "emotion",
    "confidence": 0-1,
    "text": "text if Text type",
    "t": timestamp
  }
  ```
- [ ] Updates after each analysis
- [ ] Clears when "Clear Local History" clicked

---

## 🎯 End-to-End Test Scenario

1. **User creates account**
   - Go to http://localhost:3000/index.html
   - Create new account with email/password
   - Login with credentials

2. **User analyzes text mood**
   - Type "I'm feeling amazing!"
   - Redirects to results
   - Shows "happy" with 😊 emoji
   - Shows personalized advice

3. **User does live scan**
   - Click "Start a live scan"
   - Center face in camera
   - Scan completes in ~2 seconds
   - Redirects to results with emotion

4. **User checks history**
   - Click "Your History"
   - See both text and scan entries
   - Shows timestamps

5. **User adjusts settings**
   - Click "Settings & Privacy"
   - Disable auto-scan
   - Save settings
   - Go to scan page - should NOT auto-start

6. **User clears history**
   - Click "Settings & Privacy"
   - Click "Clear Local History"
   - Go to History panel - should be empty

---

## ⚠️ Known Issues to Monitor

- [ ] Face detection may fail in low light
- [ ] Text analysis uses simple sentiment (not deep learning)
- [ ] Emotion percentages are estimated (not from model probabilities)
- [ ] Database requires Python service restart if manually modified

---

## ✨ Success Criteria

All of these must be TRUE for full implementation success:

✓ Text input redirects to results page (not staying on same page)
✓ Live scan completes in 2-3 seconds, not 8+ seconds
✓ Results page shows all emotion percentages
✓ Settings panel saves and persists
✓ History panel displays local and server history
✓ Clear history button works
✓ All error messages display correctly
✓ No JavaScript console errors
✓ No backend errors in server logs

---

Date Started: 2025-02-03
Status: ⏳ Testing in Progress
