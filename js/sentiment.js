// Client-side sentiment analysis using Sentiment.js
// This replaces the Python TextBlob backend for Vercel deployment

function analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    
    // Define emotion keywords with weights
    const emotions = {
        happy: {
            words: ['happy', 'joy', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'good', 'excited', 'glad', 'cheerful', 'delighted', 'pleased', 'awesome'],
            score: 0
        },
        sad: {
            words: ['sad', 'unhappy', 'depressed', 'down', 'miserable', 'gloomy', 'upset', 'hurt', 'crying', 'tears', 'lonely', 'heartbroken', 'devastated'],
            score: 0
        },
        angry: {
            words: ['angry', 'mad', 'furious', 'rage', 'hate', 'annoyed', 'irritated', 'frustrated', 'pissed', 'outraged', 'enraged'],
            score: 0
        },
        fearful: {
            words: ['scared', 'afraid', 'fear', 'terrified', 'worried', 'anxious', 'nervous', 'frightened', 'panic', 'dread'],
            score: 0
        },
        surprised: {
            words: ['surprised', 'shocked', 'amazed', 'astonished', 'wow', 'unexpected', 'stunned'],
            score: 0
        },
        neutral: {
            words: ['okay', 'fine', 'alright', 'normal', 'decent', 'average'],
            score: 0
        }
    };
    
    // Count emotion word occurrences
    const words = lowerText.split(/\W+/);
    words.forEach(word => {
        Object.keys(emotions).forEach(emotion => {
            if (emotions[emotion].words.includes(word)) {
                emotions[emotion].score += 1;
            }
        });
    });
    
    // Find dominant emotion
    let maxScore = 0;
    let dominantEmotion = 'neutral';
    
    Object.keys(emotions).forEach(emotion => {
        if (emotions[emotion].score > maxScore) {
            maxScore = emotions[emotion].score;
            dominantEmotion = emotion;
        }
    });
    
    // If no emotion words found, analyze basic sentiment
    if (maxScore === 0) {
        const positiveWords = ['good', 'nice', 'well', 'better', 'best'];
        const negativeWords = ['bad', 'terrible', 'worst', 'awful', 'horrible', 'not'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });
        
        if (positiveCount > negativeCount) dominantEmotion = 'happy';
        else if (negativeCount > positiveCount) dominantEmotion = 'sad';
        else dominantEmotion = 'neutral';
        
        maxScore = Math.max(positiveCount, negativeCount, 1);
    }
    
    // Calculate confidence (0.6 to 0.95)
    const wordCount = words.filter(w => w.length > 0).length;
    const confidence = Math.min(0.95, 0.6 + (maxScore / Math.max(wordCount, 1)) * 0.35);
    
    return {
        emotion: dominantEmotion,
        confidence: confidence
    };
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.analyzeSentiment = analyzeSentiment;
}
