# GodaBeg - Emotion Detection App

A mood and emotion detection application with text analysis and live facial scan capabilities.

## Features

- 📝 **Text Analysis**: Analyzes your text input to detect emotional sentiment
- 📸 **Live Scan**: Uses your camera for real-time facial emotion detection
- 📊 **History**: Tracks all your scans and analyses with personalized advice
- ⚙️ **Settings**: Customize notifications, themes, and data preferences
- 💾 **Export**: Download your history data as JSON

## Technology Stack

- **Frontend**: Pure HTML, CSS, JavaScript
- **ML Models**: TensorFlow.js (BlazeFace for face detection)
- **Sentiment Analysis**: Custom JavaScript-based emotion detection
- **Deployment**: Vercel (serverless, no backend required)

## Local Development

Simply open `index.html` in a modern web browser. No build step or server required!

```bash
# Or use a simple HTTP server
python -m http.server 8080
# Then visit http://localhost:8080
```

## Deployment to Vercel

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Deploy:

```bash
vercel
```

3. Follow the prompts to deploy your project

## Usage

1. **Login**: Enter any username to start
2. **Text Analysis**: Type how you're feeling and get instant mood detection
3. **Live Scan**: Click "Start Scan" to detect emotions from your facial expressions
4. **View History**: Check past analyses and advice given
5. **Adjust Settings**: Customize your experience with themes and notifications

## Browser Requirements

- Modern browser with ES6+ support
- Webcam access for live scan feature
- LocalStorage enabled for history and settings

## License

MIT License - Feel free to use and modify!
