"""
VisionTalk — Flask ASL Inference Server
Loads model1.p (Random Forest on MediaPipe hand landmarks) and serves predictions.
"""

import pickle
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import deque
import os
import time

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─── Load Model ────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'model1.p')

try:
    with open(MODEL_PATH, 'rb') as f:
        model_data = pickle.load(f)
    model = model_data['model']
    # Try to get labels if they exist in the pickle
    labels_dict = model_data.get('labels_dict', None)
    print(f"[SUCCESS] Model loaded successfully from {MODEL_PATH}")
    print(f"[SUCCESS] Model type: {type(model).__name__}")
    if labels_dict:
        print(f"[SUCCESS] Labels: {labels_dict}")
except Exception as e:
    print(f"[ERROR] Failed to load model: {e}")
    model = None
    labels_dict = None

# ─── Prediction Buffer (Smoothing) ─────────────────────────────
prediction_buffer = deque(maxlen=7)
last_prediction_time = 0
DEBOUNCE_MS = 150  # minimum ms between predictions


def get_smoothed_prediction(new_pred, new_conf):
    """Majority-vote over recent predictions for stability."""
    prediction_buffer.append(new_pred)
    
    if len(prediction_buffer) < 3:
        return new_pred, new_conf
    
    # Count occurrences
    counts = {}
    for p in prediction_buffer:
        counts[p] = counts.get(p, 0) + 1
    
    # Return most common
    best = max(counts, key=counts.get)
    ratio = counts[best] / len(prediction_buffer)
    
    return best, round(ratio * new_conf, 4)


# ─── Sentence Assembly State ───────────────────────────────────
current_sentence = []
last_char = None
last_char_time = 0
CHAR_HOLD_TIME = 1.0      # seconds to hold a char before it's added
SPACE_TIMEOUT = 2.5        # seconds of no detection to insert space
sentence_finalized = False


@app.route('/predict', methods=['POST'])
def predict():
    """Accept hand landmarks and return ASL prediction."""
    global last_prediction_time
    
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    data = request.get_json()
    if not data or 'landmarks' not in data:
        return jsonify({'error': 'Missing landmarks data'}), 400
    
    landmarks = data['landmarks']
    
    # Debounce
    now = time.time() * 1000
    if now - last_prediction_time < DEBOUNCE_MS:
        return jsonify({'prediction': None, 'debounced': True}), 200
    last_prediction_time = now
    
    try:
        # ─── Preprocessing ───
        # Hand signs are typically trained on coordinates relative to the hand's bounding box
        # Input 'landmarks' is [x0, y0, x1, y1, ... x20, y20]
        x_coords = landmarks[0::2]
        y_coords = landmarks[1::2]
        
        min_x = min(x_coords)
        min_y = min(y_coords)
        
        processed_landmarks = []
        for i in range(len(x_coords)):
            processed_landmarks.append(x_coords[i] - min_x)
            processed_landmarks.append(y_coords[i] - min_y)
            
        features = np.array(processed_landmarks).reshape(1, -1)
        raw_prediction = model.predict(features)[0]
        
        # Get confidence if available
        confidence = 1.0
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(features)[0]
            confidence = round(float(max(proba)), 4)
        
        # Map through labels_dict if available
        if labels_dict is not None:
            prediction = labels_dict.get(int(raw_prediction), str(raw_prediction))
        else:
            prediction = str(raw_prediction)
        
        # Log for debugging
        print(f"[INFERENCE] Predicted: {prediction} | Confidence: {confidence} | Raw class: {raw_prediction}")

        # Smooth prediction
        smoothed_pred, smoothed_conf = get_smoothed_prediction(prediction, confidence)
        
        return jsonify({
            'prediction': smoothed_pred,
            'confidence': smoothed_conf,
            'raw_prediction': prediction,
            'raw_confidence': confidence
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/assemble', methods=['POST'])
def assemble():
    """Assemble detected characters into words/sentences."""
    global current_sentence, last_char, last_char_time, sentence_finalized
    
    data = request.get_json()
    char = data.get('char', None)
    action = data.get('action', 'add')  # 'add', 'space', 'clear', 'backspace'
    
    if action == 'clear':
        current_sentence = []
        last_char = None
        sentence_finalized = False
        return jsonify({'sentence': ''})
    
    if action == 'backspace':
        if current_sentence:
            current_sentence.pop()
        return jsonify({'sentence': ''.join(current_sentence)})
    
    if action == 'space':
        current_sentence.append(' ')
        last_char = None
        return jsonify({'sentence': ''.join(current_sentence)})
    
    if char and char != last_char:
        current_sentence.append(char.upper())
        last_char = char
        last_char_time = time.time()
    
    return jsonify({'sentence': ''.join(current_sentence)})


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'model_type': type(model).__name__ if model else None,
    })


if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("  VisionTalk ASL Inference Server")
    print("=" * 50)
    print(f"  Model: {MODEL_PATH}")
    print(f"  Port:  5000")
    print("=" * 50 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
