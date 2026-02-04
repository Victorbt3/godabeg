from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from textblob import TextBlob
import uvicorn
import base64
import io
from PIL import Image
import random

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextAnalysisRequest(BaseModel):
    text: str

class ImagePredictRequest(BaseModel):
    image: str

def analyze_sentiment(text):
    """Analyze text sentiment using TextBlob"""
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    
    # Map polarity to emotions
    if polarity >= 0.5:
        return "happy", 0.85 + (polarity - 0.5) * 0.3
    elif polarity >= 0.1:
        return "neutral", 0.70 + polarity * 0.2
    elif polarity >= -0.3:
        return "sad", 0.75 + abs(polarity) * 0.15
    else:
        return "angry", 0.80 + abs(polarity) * 0.2

@app.post("/analyze_text")
async def analyze_text(request: TextAnalysisRequest):
    """Analyze text sentiment"""
    try:
        if not request.text or len(request.text.strip()) < 2:
            raise HTTPException(status_code=400, detail="Text too short")
        
        emotion, confidence = analyze_sentiment(request.text)
        
        return {
            "emotion": emotion,
            "confidence": min(confidence, 0.99),
            "text": request.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict_image(request: ImagePredictRequest):
    """Predict emotion from image (simplified version)"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image.split(',')[1] if ',' in request.image else request.image)
        image = Image.open(io.BytesIO(image_data))
        
        # For now, return a random emotion (replace with actual model later)
        emotions = ["happy", "sad", "neutral", "angry", "surprised", "fearful"]
        emotion = random.choice(emotions)
        confidence = random.uniform(0.70, 0.95)
        
        return {
            "label": emotion,
            "confidence": confidence
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")

@app.get("/")
async def root():
    return {"status": "ML Service Running (Simple Mode)", "version": "1.0"}

if __name__ == "__main__":
    print("🚀 Starting Simple ML Service on http://localhost:8000")
    print("📝 Text analysis using TextBlob")
    print("📸 Image analysis using placeholder (no TensorFlow)")
    uvicorn.run(app, host="0.0.0.0", port=8000)
