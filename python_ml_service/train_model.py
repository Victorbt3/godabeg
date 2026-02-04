"""Train a tiny demo model quickly and save it to disk.
This is intended to create a small Keras model for demo purposes so the service can return predictions end-to-end.
"""
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
import os

MODEL_PATH = os.environ.get('MODEL_PATH', os.path.join(os.path.dirname(__file__), 'model.h5'))

def build_model():
    model = models.Sequential([
        layers.Input(shape=(48,48,3)),
        layers.Conv2D(16,3,activation='relu'),
        layers.MaxPool2D(),
        layers.Conv2D(32,3,activation='relu'),
        layers.GlobalAveragePooling2D(),
        layers.Dense(32, activation='relu'),
        layers.Dense(6, activation='softmax')
    ])
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return model

if __name__ == '__main__':
    print('Training small demo model (will be quick)...')
    # generate tiny synthetic dataset (not real emotions) for shape/flow only
    x = np.random.rand(200,48,48,3).astype('float32')
    y = np.random.randint(0,6,size=(200,))
    model = build_model()
    model.fit(x,y, epochs=3, batch_size=32, verbose=2)
    model.save(MODEL_PATH)
    print('Saved demo model to', MODEL_PATH)
