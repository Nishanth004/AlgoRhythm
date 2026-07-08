# backend/server.py

import os
import sys
import io
import json
import hashlib
import random
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
from PIL import Image
import torch
import requests

from Generator import LSTMModel, generate_sequence, decode_sequence, save_midi, DURATION
from Preprocess import SEQUENCE_LENGTH, MAPPING_PATH
from chatbot_handler import MusicChatbot
from analytics_handler import AnalyticsHandler
from explainability import ExplainabilityEngine
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from RL_Train import RLTrainer

# ---------------------------------------------------------------------
# Paths and config
# ---------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_CONFIG_PATH = os.path.join(MODELS_DIR, "model_config.json")
DEFAULT_MODEL_PATH = os.path.join(MODELS_DIR, "dutch_folk.pth")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
MAPPING_PATH = os.path.join(BASE_DIR, "mapping.json")
FEEDBACK_DB_PATH = os.path.join(BASE_DIR, "feedback.db")

os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# Load mappings
with open(MAPPING_PATH, "r") as fp:
    MAPPINGS = json.load(fp)

OUTPUT_UNITS = len(MAPPINGS)
NUM_UNITS = [256, 256]

# Load or create model config
if os.path.exists(MODEL_CONFIG_PATH):
    with open(MODEL_CONFIG_PATH, "r") as fp:
        MODEL_CONFIG = json.load(fp)
else:
    # Create default config if doesn't exist
    MODEL_CONFIG = {
        "models": [
            {
                "id": "dutch_folk",
                "name": "Dutch Folk Songs",
                "type": "lstm",
                "path": "models/dutch_folk.pth",
                "description": "Original Dutch folk song generator",
                "genres": ["folk", "traditional"],
                "status": "active"
            }
        ]
    }
    with open(MODEL_CONFIG_PATH, "w") as fp:
        json.dump(MODEL_CONFIG, fp, indent=2)

# Initialize services
chatbot = MusicChatbot()
analytics = AnalyticsHandler()
explainability = ExplainabilityEngine()
rl_trainer = RLTrainer()

# ---------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------
# Database setup (feedback)
# ---------------------------------------------------------------------
def init_feedback_db():
    conn = sqlite3.connect(FEEDBACK_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seed_hash TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_feedback_db()

# ---------------------------------------------------------------------
# Pinata IPFS functions
# ---------------------------------------------------------------------
PINATA_API_KEY = os.getenv("PINATA_API_KEY", "")
PINATA_SECRET_API_KEY = os.getenv("PINATA_SECRET_API_KEY", "")

def upload_to_pinata(file_path, filename):
    """Upload file to Pinata IPFS."""
    if not PINATA_API_KEY or not PINATA_SECRET_API_KEY:
        return None
        
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_API_KEY
    }
    with open(file_path, "rb") as fp:
        files = {"file": (filename, fp)}
        response = requests.post(url, files=files, headers=headers)
    if response.status_code == 200:
        return response.json().get("IpfsHash")
    else:
        print(f"Pinata upload failed: {response.text}")
        return None

def upload_json_to_pinata(data, name="metadata.json"):
    """Upload JSON metadata to Pinata."""
    if not PINATA_API_KEY or not PINATA_SECRET_API_KEY:
        return None
        
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "Content-Type": "application/json",
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_API_KEY
    }
    payload = {
        "pinataContent": data,
        "pinataMetadata": {"name": name}
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json().get("IpfsHash")
    else:
        print(f"Pinata JSON upload failed: {response.text}")
        return None

# ---------------------------------------------------------------------
# Mood analysis functions
# ---------------------------------------------------------------------
# Initialize VADER sentiment analyzer
sentiment_analyzer = SentimentIntensityAnalyzer()

def analyze_text_mood(text):
    """Analyze sentiment from text using VADER."""
    # Get VADER scores: neg, neu, pos, compound (ranges -1 to 1)
    scores = sentiment_analyzer.polarity_scores(text)
    
    # Map compound score (-1 to 1) to valence (0 to 1)
    # compound > 0.05 = positive, < -0.05 = negative, else neutral
    valence = (scores['compound'] + 1) / 2  # Convert -1~1 to 0~1
    
    # Calculate arousal from intensity of sentiment
    # Higher absolute compound = higher arousal (emotional intensity)
    arousal_base = abs(scores['compound'])  # 0 to 1
    
    # Adjust arousal using positive vs negative intensity
    # Strong emotions (very positive or very negative) = high arousal
    pos_intensity = scores['pos']
    neg_intensity = scores['neg']
    max_intensity = max(pos_intensity, neg_intensity)
    
    # Arousal: combine absolute sentiment with max emotional intensity
    arousal = (arousal_base * 0.6) + (max_intensity * 0.4)
    arousal = max(0.0, min(1.0, arousal))
    
    return {"valence": valence, "arousal": arousal}

def analyze_image_mood(image_bytes):
    """Analyze mood from image colors."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize((100, 100))
        pixels = np.array(img)
        avg_color = pixels.mean(axis=(0, 1))
        r, g, b = avg_color

        brightness = (r + g + b) / 3 / 255.0
        valence = brightness
        saturation = (max(r, g, b) - min(r, g, b)) / 255.0 if max(r, g, b) > 0 else 0.0
        arousal = saturation

        return {"valence": valence, "arousal": arousal}
    except Exception as e:
        print(f"Image mood analysis error: {e}")
        return {"valence": 0.5, "arousal": 0.5}

def mood_to_music_params(mood):
    """Convert mood to music generation parameters."""
    valence = mood.get("valence", 0.5)
    arousal = mood.get("arousal", 0.5)

    tempo = int(60 + arousal * 100)
    
    if valence > 0.5:
        key = random.choice(["C", "G", "D", "A", "F"])
    else:
        key = random.choice(["Am", "Em", "Dm", "Bm", "Gm"])
    
    temperature = 0.5 + arousal * 0.7

    return {
        "tempo": tempo,
        "key": key,
        "temperature": temperature,
        "num_steps": int(200 + arousal * 100)
    }

# ---------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------
def load_model():
    """Load the Dutch Folk LSTM model."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    if not os.path.exists(DEFAULT_MODEL_PATH):
        return None, f"Model file not found: {DEFAULT_MODEL_PATH}"
    
    model = LSTMModel(OUTPUT_UNITS, NUM_UNITS)
    model.load_state_dict(torch.load(DEFAULT_MODEL_PATH, map_location=device))
    model.to(device)
    model.eval()
    return model, None

# ---------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------

@app.route("/api/models", methods=["GET"])
def get_models():
    """Return available models - only show active ones."""
    active_models = {
        "models": [m for m in MODEL_CONFIG.get("models", []) if m.get("status") != "optional" or os.path.exists(os.path.join(BASE_DIR, m.get("path", "")))]
    }
    return jsonify(active_models)

@app.route("/api/generate", methods=["POST"])
def generate_music():
    """Generate music from multimodal inputs - compatible with original frontend."""
    data = request.form
    
    # Support both old and new parameter names
    text_prompt = data.get("prompt", data.get("textPrompt", ""))
    instrument = data.get("instrument", "Piano")
    dynamics = data.get("dynamics", "mf")
    articulation = data.get("articulation", "Staccato")
    
    image_file = request.files.get("image")
    image_mood = {"valence": 0.5, "arousal": 0.5}
    
    if image_file:
        image_bytes = image_file.read()
        image_mood = analyze_image_mood(image_bytes)
    
    text_mood = analyze_text_mood(text_prompt)
    
    combined_mood = {
        "valence": (text_mood["valence"] + image_mood["valence"]) / 2,
        "arousal": (text_mood["arousal"] + image_mood["arousal"]) / 2
    }
    
    music_params = mood_to_music_params(combined_mood)
    
    # Check if RL mode is enabled
    use_rl = data.get("useRL", "false").lower() == "true"
    
    # Load model (RL or base)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    if use_rl and os.path.exists(rl_trainer.rl_model_path):
        model = LSTMModel(OUTPUT_UNITS, NUM_UNITS)
        model.load_state_dict(torch.load(rl_trainer.rl_model_path, map_location=device))
        model.to(device)
        model.eval()
        model_used = "RL Model (Feedback-Trained)"
    else:
        model, error = load_model()
        if error:
            print(f"Error loading model: {error}")
            return jsonify({"error": error}), 400
        model_used = "Base Model (Original)"
    
    # Generate music
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    seed_str = f"{text_prompt}_{instrument}_{dynamics}_{timestamp}"
    seed_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
    
    midi_filename = f"music_{seed_hash}.mid"
    midi_path = os.path.join(OUTPUTS_DIR, midi_filename)
    
    # Use seed_hash to generate deterministic seed_input
    random.seed(int(seed_hash, 16))  # Convert hex to int for seeding
    np.random.seed(int(seed_hash[:8], 16) % (2**31))  # NumPy seed
    seed_input = [random.randint(0, OUTPUT_UNITS - 1) for _ in range(SEQUENCE_LENGTH)]
    
    generated_sequence = generate_sequence(
        model, seed_input, music_params["num_steps"], OUTPUT_UNITS,
        device, music_params["temperature"]
    )
    
    decoded = decode_sequence(generated_sequence, MAPPINGS)
    save_midi(decoded, midi_path, DURATION, instrument, dynamics, articulation)
    
    # Upload to IPFS (optional)
    ipfs_hash = None
    metadata_hash = None
    token_uri = ""
    
    if PINATA_API_KEY and PINATA_SECRET_API_KEY:
        ipfs_hash = upload_to_pinata(midi_path, midi_filename)
        
        if ipfs_hash:
            metadata = {
                "name": f"AlgoRhythm Seed #{seed_hash}",
                "description": text_prompt,
                "image": f"ipfs://{ipfs_hash}",
                "attributes": [
                    {"trait_type": "Instrument", "value": instrument},
                    {"trait_type": "Dynamics", "value": dynamics},
                    {"trait_type": "Articulation", "value": articulation},
                    {"trait_type": "Mood Valence", "value": round(combined_mood["valence"], 2)},
                    {"trait_type": "Mood Arousal", "value": round(combined_mood["arousal"], 2)},
                    {"trait_type": "Tempo", "value": music_params["tempo"]},
                    {"trait_type": "Key", "value": music_params["key"]}
                ],
                "seed_hash": seed_hash,
                "midi_cid": ipfs_hash
            }
            
            metadata_hash = upload_json_to_pinata(metadata, f"metadata_{seed_hash}.json")
            if metadata_hash:
                token_uri = f"ipfs://{metadata_hash}"
    
    # Log to analytics
    analytics.log_seed({
        "seed_hash": seed_hash,
        "prompt": text_prompt,
        "image_used": image_file is not None,
        "instrument": instrument,
        "dynamics": dynamics,
        "articulation": articulation,
        "mood": combined_mood,
        "tempo": music_params["tempo"],
        "key": music_params["key"],
        "temperature": music_params["temperature"],
        "ipfs_hash": ipfs_hash
    })
    
    # Get explainability
    explanation = explainability.explain_mood_mapping(
        combined_mood, music_params["tempo"],
        music_params["key"], music_params["temperature"]
    )
    
    sequence_analysis = explainability.analyze_sequence_patterns(generated_sequence, MAPPINGS)
    instrument_explanation = explainability.explain_instrument_choice(instrument, combined_mood, dynamics)
    
    # Return in format compatible with original frontend
    return jsonify({
        "success": True,
        "midiUrl": f"/api/outputs/{midi_filename}",  # Original frontend expects midiUrl
        "midi_url": f"/api/outputs/{midi_filename}",  # New frontend expects midi_url
        "seedHash": seed_hash,  # Original format
        "seed_hash": seed_hash,  # New format
        "tokenUri": token_uri,  # Original format
        "model_used": model_used,  # Which model was used
        "mood": {
            "valence": combined_mood["valence"],
            "arousal": combined_mood["arousal"],
            "tempo_bpm": music_params["tempo"],
            "key_mode": music_params["key"]
        },
        "music_params": music_params,
        "ipfs_hash": ipfs_hash,
        "metadata_hash": metadata_hash,
        "explanation": explanation,
        "sequence_analysis": sequence_analysis,
        "instrument_explanation": instrument_explanation
    })

@app.route("/api/outputs/<filename>", methods=["GET"])
def serve_output(filename):
    """Serve generated MIDI files."""
    return send_from_directory(OUTPUTS_DIR, filename)

@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    """Submit user feedback - compatible with original frontend."""
    data = request.json
    seed_hash = data.get("seed_hash", data.get("seedHash"))  # Support both formats
    rating = data.get("rating")
    comment = data.get("comment", "")
    
    if not seed_hash or not rating:
        return jsonify({"error": "Missing seed_hash or rating"}), 400
    
    # Store in feedback DB
    conn = sqlite3.connect(FEEDBACK_DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO feedback (seed_hash, rating, comment) VALUES (?, ?, ?)",
        (seed_hash, rating, comment)
    )
    conn.commit()
    conn.close()
    
    # Update analytics
    analytics.update_seed_rating(seed_hash, rating)
    
    return jsonify({"success": True})

@app.route("/api/regenerate", methods=["POST"])
def regenerate_music():
    """Regenerate music from a seed hash with stored parameters."""
    data = request.json
    
    seed_hash = data.get("seed_hash")
    if not seed_hash:
        return jsonify({"error": "Missing seed_hash"}), 400
    
    # Extract parameters from metadata
    instrument = data.get("instrument", "Piano")
    dynamics = data.get("dynamics", "mf")
    articulation = data.get("articulation", "Staccato")
    mood_valence = data.get("mood_valence", 0.5)
    mood_arousal = data.get("mood_arousal", 0.5)
    tempo = data.get("tempo", 120)
    key = data.get("key", "C")
    description = data.get("description", "")
    
    # Reconstruct mood and music params
    combined_mood = {
        "valence": mood_valence,
        "arousal": mood_arousal
    }
    
    music_params = {
        "tempo": tempo,
        "key": key,
        "num_steps": 500,
        "temperature": 1.0
    }
    
    # Load model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, error = load_model()
    if error:
        return jsonify({"error": error}), 400
    
    midi_filename = f"music_{seed_hash}.mid"
    midi_path = os.path.join(OUTPUTS_DIR, midi_filename)
    
    # Use seed_hash to generate deterministic seed_input
    random.seed(int(seed_hash, 16))  # Convert hex to int for seeding
    np.random.seed(int(seed_hash[:8], 16) % (2**31))  # NumPy seed
    seed_input = [random.randint(0, OUTPUT_UNITS - 1) for _ in range(SEQUENCE_LENGTH)]
    
    # Generate sequence
    generated_sequence = generate_sequence(
        model, seed_input, music_params["num_steps"], OUTPUT_UNITS,
        device, music_params["temperature"]
    )
    
    decoded = decode_sequence(generated_sequence, MAPPINGS)
    save_midi(decoded, midi_path, DURATION, instrument, dynamics, articulation)
    
    return jsonify({
        "success": True,
        "midi_url": f"/api/outputs/{midi_filename}",
        "seed_hash": seed_hash,
        "message": f"Regenerated music from seed {seed_hash}"
    })

@app.route("/api/chatbot", methods=["POST"])
def chatbot_endpoint():
    """Chatbot interaction endpoint with context awareness."""
    data = request.json
    user_message = data.get("message", "")
    conversation_history = data.get("history", [])
    context = data.get("context", None)
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    
    result = chatbot.chat(user_message, conversation_history, context)
    
    if result["error"]:
        return jsonify({"error": result["error"]}), 500
    
    return jsonify({"response": result["response"]})

@app.route("/api/chatbot/suggestions", methods=["GET"])
def chatbot_suggestions():
    """Get prompt suggestions."""
    genre = request.args.get("genre", "general")
    suggestions = chatbot.get_prompt_suggestions(genre)
    return jsonify({"suggestions": suggestions})

@app.route("/api/analytics/history", methods=["GET"])
def get_analytics_history():
    """Get user's seed history."""
    limit = int(request.args.get("limit", 50))
    history = analytics.get_user_history(limit)
    return jsonify({"history": history})

@app.route("/api/analytics/summary", methods=["GET"])
def get_analytics_summary():
    """Get analytics summary."""
    summary = analytics.get_analytics_summary()
    return jsonify(summary)

@app.route("/api/story-suite", methods=["POST"])
def generate_story_suite():
    """Generate a multi-scene story suite with optional image support."""
    # Parse scenes data from form
    scenes_json = request.form.get("scenes")
    
    if scenes_json:
        # New format with multipart/form-data
        scenes = json.loads(scenes_json)
    else:
        # Fallback to old JSON format for backward compatibility
        data = request.json
        scenes = data.get("scenes", [])
    
    if not scenes or len(scenes) < 2:
        return jsonify({"error": "At least 2 scenes required"}), 400
    
    suite_results = []
    
    for idx, scene in enumerate(scenes):
        scene_prompt = scene.get("prompt", "")
        
        # Check if there's an image for this scene
        image_key = f"image_{idx}"
        has_image = scene.get("hasImage", False)
        scene_mood = None
        
        if has_image and image_key in request.files:
            # Analyze mood from image
            image_file = request.files[image_key]
            image_bytes = image_file.read()
            image_mood = analyze_image_mood(image_bytes)
            text_mood = analyze_text_mood(scene_prompt)
            
            # Combine image and text mood (60% image, 40% text)
            scene_mood = {
                "valence": image_mood["valence"] * 0.6 + text_mood["valence"] * 0.4,
                "arousal": image_mood["arousal"] * 0.6 + text_mood["arousal"] * 0.4
            }
        else:
            # Use text-only mood analysis
            scene_mood = analyze_text_mood(scene_prompt)
        
        if idx == 0:
            music_params = mood_to_music_params(scene_mood)
        elif idx == len(scenes) - 1:
            music_params = mood_to_music_params(scene_mood)
            music_params["tempo"] = int(music_params["tempo"] * 0.9)
        else:
            music_params = mood_to_music_params(scene_mood)
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model, error = load_model()
        
        if error:
            return jsonify({"error": error}), 400
        
        seed_input = [random.randint(0, OUTPUT_UNITS - 1) for _ in range(SEQUENCE_LENGTH)]
        generated_sequence = generate_sequence(
            model, seed_input, music_params["num_steps"], OUTPUT_UNITS,
            device, music_params["temperature"]
        )
        
        decoded = decode_sequence(generated_sequence, MAPPINGS)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        seed_str = f"story_{idx}_{scene_prompt}_{timestamp}"
        seed_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
        
        midi_filename = f"scene_{idx}_{seed_hash}.mid"
        midi_path = os.path.join(OUTPUTS_DIR, midi_filename)
        
        save_midi(
            decoded, midi_path, DURATION,
            scene.get("instrument", "Piano"),
            scene.get("dynamics", "mf"),
            scene.get("articulation", "Staccato")
        )
        
        suite_results.append({
            "scene_index": idx,
            "prompt": scene_prompt,
            "midi_url": f"/api/outputs/{midi_filename}",
            "seed_hash": seed_hash,
            "mood": scene_mood,
            "tempo": music_params["tempo"]
        })
    
    return jsonify({"success": True, "suite": suite_results})

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "groq_configured": chatbot.client is not None,
        "pinata_configured": bool(PINATA_API_KEY and PINATA_SECRET_API_KEY)
    })

@app.route("/api/rl/stats", methods=["GET"])
def get_rl_stats():
    """Get RL training statistics."""
    stats = rl_trainer.get_training_stats()
    return jsonify(stats)

@app.route("/api/rl/train", methods=["POST"])
def train_rl_model():
    """Train RL model from user feedback."""
    epochs = request.json.get("epochs", 5) if request.json else 5
    result = rl_trainer.train_from_feedback(epochs=epochs)
    return jsonify(result)

@app.route("/api/rl/compare", methods=["POST"])
def compare_models():
    """Generate music with both base and RL models for comparison."""
    data = request.form
    
    text_prompt = data.get("prompt", data.get("textPrompt", ""))
    instrument = data.get("instrument", "Piano")
    dynamics = data.get("dynamics", "mf")
    articulation = data.get("articulation", "Staccato")
    
    image_file = request.files.get("image")
    image_mood = {"valence": 0.5, "arousal": 0.5}
    
    if image_file:
        image_bytes = image_file.read()
        image_mood = analyze_image_mood(image_bytes)
    
    text_mood = analyze_text_mood(text_prompt)
    
    combined_mood = {
        "valence": (text_mood["valence"] + image_mood["valence"]) / 2,
        "arousal": (text_mood["arousal"] + image_mood["arousal"]) / 2
    }
    
    music_params = mood_to_music_params(combined_mood)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Generate with base model
    base_model, error = load_model()
    if error:
        return jsonify({"error": error}), 400
    
    seed_input = [random.randint(0, OUTPUT_UNITS - 1) for _ in range(SEQUENCE_LENGTH)]
    
    base_sequence = generate_sequence(
        base_model, seed_input.copy(), music_params["num_steps"], 
        OUTPUT_UNITS, device, music_params["temperature"]
    )
    base_decoded = decode_sequence(base_sequence, MAPPINGS)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    seed_str = f"{text_prompt}_{timestamp}"
    seed_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
    
    base_filename = f"base_{seed_hash}.mid"
    base_path = os.path.join(OUTPUTS_DIR, base_filename)
    save_midi(base_decoded, base_path, DURATION, instrument, dynamics, articulation)
    
    # Generate with RL model if it exists
    rl_filename = None
    rl_model_exists = os.path.exists(rl_trainer.rl_model_path)
    
    if rl_model_exists:
        rl_model = LSTMModel(OUTPUT_UNITS, NUM_UNITS)
        rl_model.load_state_dict(torch.load(rl_trainer.rl_model_path, map_location=device))
        rl_model.to(device)
        rl_model.eval()
        
        rl_sequence = generate_sequence(
            rl_model, seed_input.copy(), music_params["num_steps"],
            OUTPUT_UNITS, device, music_params["temperature"]
        )
        rl_decoded = decode_sequence(rl_sequence, MAPPINGS)
        
        rl_filename = f"rl_{seed_hash}.mid"
        rl_path = os.path.join(OUTPUTS_DIR, rl_filename)
        save_midi(rl_decoded, rl_path, DURATION, instrument, dynamics, articulation)
    
    return jsonify({
        "success": True,
        "base_model": {
            "midi_url": f"/api/outputs/{base_filename}",
            "model_name": "Base Model (Original)"
        },
        "rl_model": {
            "midi_url": f"/api/outputs/{rl_filename}" if rl_filename else None,
            "model_name": "RL Model (Feedback-Trained)",
            "exists": rl_model_exists
        },
        "mood": combined_mood,
        "seed_hash": seed_hash
    })

# ---------------------------------------------------------------------
# Run server
# ---------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("Starting AlgoRhythm backend server...")
    print(f"Outputs directory: {OUTPUTS_DIR}")
    print(f"Models directory: {MODELS_DIR}")
    print(f"Default model: {DEFAULT_MODEL_PATH}")
    print(f"Pinata configured: {bool(PINATA_API_KEY and PINATA_SECRET_API_KEY)}")
    print(f"Groq configured: {chatbot.client is not None}")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=5000)
