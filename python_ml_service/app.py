from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io, os
import cv2
import asyncio
from .db import init_db, SessionLocal, User, Scan, TextEntry, Advice
from .utils import hash_password
from textblob import TextBlob

try:
    import tensorflow as tf
    from tensorflow.keras.models import load_model
except Exception:
    tf = None

app = FastAPI(title='ML Service')

LABELS = ['happy','sad','angry','neutral','surprised','fearful']
# model location: prefer model.h5 in project root; fallback to model_data/model.h5
MODEL_PATH = os.environ.get('MODEL_PATH', os.path.join(os.path.dirname(__file__), 'model.h5'))
ALTERNATE_MODEL = os.path.join(os.path.dirname(__file__), 'model_data', 'model.h5')
_model = None

# attempt to load existing model (or alternate path)
def try_load_model(path):
    global _model
    if tf and os.path.exists(path):
        try:
            _model = load_model(path)
            print('Loaded model from', path)
            return True
        except Exception as e:
            print('Failed to load model from', path, e)
    return False

if try_load_model(MODEL_PATH) is False:
    try_load_model(ALTERNATE_MODEL)


def load_image_bytes(data: bytes):
    img = Image.open(io.BytesIO(data)).convert('RGB')
    return np.array(img)


@app.post('/predict')
async def predict(image: UploadFile = File(...)):
    if not image:
        raise HTTPException(status_code=400, detail='no_file')
    data = await image.read()
    try:
        img = load_image_bytes(data)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid_image')

    # face detection using OpenCV Haar cascade
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    casc_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(casc_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        return JSONResponse(status_code=422, content={'error': 'no_face_detected'})

    # choose largest face
    faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
    x, y, w, h = map(int, faces[0])

    face = img[y:y + h, x:x + w]
    # preprocess: resize to 48x48 (common for emotion datasets)
    target_size = (48, 48)
    face_resized = cv2.resize(face, target_size)
    norm = face_resized.astype('float32') / 255.0
    input_arr = np.expand_dims(norm, axis=0)

    # prepare default response values
    emotion = 'unknown'
    confidence = 0.0
    happy = 0
    neutral = 0
    surprise = 0
    
    if _model is not None:
        preds = _model.predict(input_arr)[0]
        idx = int(np.argmax(preds))
        emotion = LABELS[idx] if idx < len(LABELS) else 'unknown'
        confidence = float(preds[idx])
        
        # Return all emotion percentages
        emotion_dict = {LABELS[i]: int(preds[i] * 100) for i in range(len(LABELS))}
        happy = emotion_dict.get('happy', 0)
        neutral = emotion_dict.get('neutral', 0)
        surprise = emotion_dict.get('surprised', 0)
    else:
        # heuristic fallback: brightness-based
        avg = float(np.mean(cv2.cvtColor(face_resized, cv2.COLOR_RGB2GRAY)))
        if avg > 150:
            emotion, confidence = 'happy', 0.72
            happy = 72
            neutral = 20
            surprise = 8
        else:
            emotion, confidence = 'neutral', 0.60
            happy = 20
            neutral = 60
            surprise = 20

    # send result back
    return {
        'emotion': emotion,
        'confidence': float(confidence),
        'happy': happy,
        'neutral': neutral,
        'surprise': surprise,
        'bbox': [int(x), int(y), int(w), int(h)]
    }


# If model is missing, create a small demo model on startup (runs in background to avoid blocking)
import threading
from train_model import build_model

def create_demo_model_if_missing():
    global _model
    try:
        if _model is None and not os.path.exists(MODEL_PATH) and not os.path.exists(ALTERNATE_MODEL):
            print('No model found, creating demo model...')
            m = build_model()
            # quick synthetic train
            import numpy as _np
            x = _np.random.rand(200,48,48,3).astype('float32')
            y = _np.random.randint(0,6,size=(200,))
            m.fit(x,y, epochs=2, batch_size=32, verbose=0)
            m.save(MODEL_PATH)
            print('Demo model saved to', MODEL_PATH)
            try_load_model(MODEL_PATH)
    except Exception as e:
        print('Demo model creation failed', e)

# run on startup in background
@app.on_event('startup')
async def startup_event():
    t = threading.Thread(target=create_demo_model_if_missing, daemon=True)
    t.start()

# --- DB Integration ---
@app.on_event('startup')
async def on_startup():
    await init_db()

@app.post('/register')
async def register(data: dict = Body(...)):
    async with SessionLocal() as session:
        user = User(email=data['email'], password=data['password'], name=data.get('name'))
        session.add(user)
        try:
            await session.commit()
            await session.refresh(user)
            return {"id": user.id, "email": user.email, "name": user.name}
        except Exception as e:
            await session.rollback()
            return JSONResponse(status_code=409, content={"error": "email_exists"})

@app.post('/login')
async def login(data: dict = Body(...)):
    async with SessionLocal() as session:
        q = await session.execute(
            User.__table__.select().where(User.email == data['email'], User.password == data['password'])
        )
        user = q.fetchone()
        if not user:
            return JSONResponse(status_code=401, content={"error": "invalid_credentials"})
        u = user[0]
        return {"id": u.id, "email": u.email, "name": u.name}

@app.post('/analyze_text')
async def analyze_text(data: dict = Body(...)):
    text = data.get('text')
    if not text:
        return JSONResponse(status_code=400, content={"error": "no_text"})
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    # Map polarity to emotion
    if polarity > 0.3:
        emotion = 'happy'
    elif polarity < -0.3:
        emotion = 'sad'
    elif abs(polarity) < 0.1:
        emotion = 'neutral'
    else:
        emotion = 'unknown'
    confidence = abs(polarity)
    score = int(max(0, min(100, round(confidence * 100))))
    # Simple percentage mapping for UI
    if emotion == 'happy':
        happy = max(60, score)
        neutral = max(100 - happy - 5, 5)
        surprise = 5
    elif emotion == 'sad':
        happy = 5
        neutral = max(40, 100 - score - 10)
        surprise = 10
    elif emotion == 'neutral':
        neutral = max(60, score)
        happy = max(100 - neutral - 5, 5)
        surprise = 5
    else:
        happy = 20
        neutral = 60
        surprise = 20

    return {
        "emotion": emotion,
        "confidence": confidence,
        "polarity": polarity,
        "happy": int(happy),
        "neutral": int(neutral),
        "surprise": int(surprise)
    }

@app.post('/save_text_entry')
async def save_text_entry(data: dict = Body(...)):
    async with SessionLocal() as session:
        entry = TextEntry(user_id=data['user_id'], text=data['text'], emotion=data.get('emotion'), confidence=data.get('confidence'))
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return {"id": entry.id, "text": entry.text, "emotion": entry.emotion, "confidence": entry.confidence, "created_at": str(entry.created_at)}

@app.post('/save_advice')
async def save_advice(data: dict = Body(...)):
    async with SessionLocal() as session:
        advice = Advice(user_id=data['user_id'], scan_id=data.get('scan_id'), text_entry_id=data.get('text_entry_id'), advice=data['advice'])
        session.add(advice)
        await session.commit()
        await session.refresh(advice)
        return {"id": advice.id, "advice": advice.advice, "created_at": str(advice.created_at)}

@app.get('/user_text_entries/{user_id}')
async def user_text_entries(user_id: int):
    async with SessionLocal() as session:
        q = await session.execute(TextEntry.__table__.select().where(TextEntry.user_id == user_id).order_by(TextEntry.created_at.desc()))
        entries = [dict(row) for row in q.fetchall()]
        return entries

@app.get('/user_advices/{user_id}')
async def user_advices(user_id: int):
    async with SessionLocal() as session:
        q = await session.execute(Advice.__table__.select().where(Advice.user_id == user_id).order_by(Advice.created_at.desc()))
        advices = [dict(row) for row in q.fetchall()]
        return advices
