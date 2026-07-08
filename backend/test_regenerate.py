import requests
import json

metadata = {
    "seed_hash": "3e80825462213fe7",
    "description": "sunny morning with birds chirping.",
    "instrument": "Piano",
    "dynamics": "mf",
    "articulation": "Staccato",
    "mood_valence": 0.72,
    "mood_arousal": 0.36,
    "tempo": 96,
    "key": "F"
}

url = "http://localhost:5000/api/regenerate"

response = requests.post(url, json=metadata)

if response.status_code == 200:
    result = response.json()
    print("✓ Success!")
    print(f"MIDI URL: {result['midi_url']}")
    print(f"Seed Hash: {result['seed_hash']}")
    print(f"Message: {result['message']}")
else:
    print(f"✗ Error: {response.status_code}")
    print(response.text)
