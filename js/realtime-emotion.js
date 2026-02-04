// Real-time emotion display helper
function updateRealtimeEmotion(result) {
    const rtDiv = document.getElementById('realtimeEmotion');
    if (!rtDiv) return;
    
    if (!result || result.error) {
        rtDiv.innerHTML = `
            <h3 style="color:#ef4444; font-size:1.3em; margin:8px 0;">⚠️ Connection Error</h3>
            <p style="color:#64748b; font-size:0.95em;">Using fallback mode</p>
        `;
        return;
    }
    
    const emotion = result.emotion || 'unknown';
    const confidence = result.confidence || 0;
    const emoji = getEmojiForMood(emotion);
    const confidencePercent = Math.round(confidence * 100);
    
    // Color based on emotion
    const emotionColors = {
        happy: '#22c55e',
        sad: '#3b82f6',
        angry: '#ef4444',
        surprised: '#f59e0b',
        fearful: '#8b5cf6',
        neutral: '#64748b'
    };
    const color = emotionColors[emotion.toLowerCase()] || '#3b4a64';
    
    rtDiv.innerHTML = `
        <h3 style="color:${color}; font-size:1.5em; margin:8px 0; font-weight:700;">
            ${emoji} ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}
        </h3>
        <p style="color:#64748b; font-size:0.95em;">
            Confidence: ${confidencePercent}%
            ${result.fallback ? ' <span style="color:#f59e0b;">(Fallback Mode)</span>' : ''}
        </p>
    `;
}
