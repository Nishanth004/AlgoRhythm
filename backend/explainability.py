# backend/explainability.py

import numpy as np
from scipy import stats

class ExplainabilityEngine:
    """Provides explanations for music generation decisions."""
    
    @staticmethod
    def explain_mood_mapping(mood, tempo, key, temperature):
        """
        Explain how mood was mapped to music parameters.
        
        Returns a detailed explanation dict.
        """
        valence = mood.get("valence", 0.5)
        arousal = mood.get("arousal", 0.5)
        
        # Determine mood quadrant
        if valence > 0.5 and arousal > 0.5:
            mood_category = "Excited/Happy"
            mood_desc = "high energy and positive emotion"
        elif valence > 0.5 and arousal <= 0.5:
            mood_category = "Calm/Peaceful"
            mood_desc = "low energy and positive emotion"
        elif valence <= 0.5 and arousal > 0.5:
            mood_category = "Tense/Angry"
            mood_desc = "high energy and negative emotion"
        else:
            mood_category = "Sad/Melancholic"
            mood_desc = "low energy and negative emotion"
        
        # Tempo explanation
        if tempo < 80:
            tempo_desc = "slow tempo for contemplative feel"
        elif tempo < 120:
            tempo_desc = "moderate tempo for balanced pacing"
        else:
            tempo_desc = "fast tempo for energetic feel"
        
        # Key explanation
        if key in ["C", "G", "D", "A", "E", "F"]:
            key_desc = f"major key ({key}) for brighter, uplifting sound"
        else:
            key_desc = f"minor key ({key}) for darker, introspective sound"
        
        # Temperature explanation
        if temperature < 0.8:
            temp_desc = "low randomness for predictable, structured patterns"
        elif temperature < 1.2:
            temp_desc = "moderate randomness for balanced creativity"
        else:
            temp_desc = "high randomness for experimental, varied patterns"
        
        explanation = {
            "mood_category": mood_category,
            "mood_description": mood_desc,
            "valence": valence,
            "arousal": arousal,
            "tempo": tempo,
            "tempo_explanation": tempo_desc,
            "key": key,
            "key_explanation": key_desc,
            "temperature": temperature,
            "temperature_explanation": temp_desc,
            "summary": f"This music expresses {mood_desc}, achieved through a {tempo_desc}, {key_desc}, and {temp_desc}."
        }
        
        return explanation
    
    @staticmethod
    def explain_instrument_choice(instrument, mood, dynamics):
        """Explain why an instrument fits the mood."""
        instrument_characteristics = {
            "Piano": "versatile, expressive, suitable for all moods",
            "Guitar": "warm, intimate, great for emotional expression",
            "Violin": "lyrical, expressive, ideal for dramatic or romantic pieces",
            "Flute": "light, airy, perfect for peaceful or playful moods",
            "Drums": "rhythmic, powerful, adds energy and drive"
        }
        
        dynamics_desc = {
            "pp": "very soft for delicate, intimate expression",
            "p": "soft for gentle, subdued character",
            "mp": "moderately soft for balanced expressiveness",
            "mf": "moderately loud for clear, comfortable presence",
            "f": "loud for bold, confident statements",
            "ff": "very loud for powerful, dramatic impact"
        }
        
        return {
            "instrument": instrument,
            "characteristics": instrument_characteristics.get(instrument, "unique timbre"),
            "dynamics": dynamics,
            "dynamics_explanation": dynamics_desc.get(dynamics, "moderate volume"),
            "fit_explanation": f"{instrument} with {dynamics} dynamics complements the mood by providing {instrument_characteristics.get(instrument, 'a distinct voice')} and {dynamics_desc.get(dynamics, 'appropriate volume')}."
        }
    
    @staticmethod
    def analyze_sequence_patterns(sequence, mappings):
        """Analyze generated MIDI sequence for patterns."""
        if not sequence:
            return {}
        
        # Convert sequence to note numbers
        reverse_mappings = {v: k for k, v in mappings.items()}
        notes = []
        for idx in sequence:
            symbol = reverse_mappings.get(idx, "_")
            if symbol != "_" and symbol != "r" and symbol != "/":
                try:
                    notes.append(int(symbol))
                except ValueError:
                    pass
        
        if not notes:
            return {"error": "No valid notes in sequence"}
        
        # Basic statistics
        note_range = max(notes) - min(notes)
        avg_note = np.mean(notes)
        std_note = np.std(notes)
        
        # Interval analysis
        intervals = [notes[i+1] - notes[i] for i in range(len(notes)-1)]
        avg_interval = np.mean(np.abs(intervals)) if intervals else 0
        
        # Contour analysis
        ascending = sum(1 for i in intervals if i > 0)
        descending = sum(1 for i in intervals if i < 0)
        repeated = sum(1 for i in intervals if i == 0)
        
        total_moves = len(intervals)
        contour = "ascending" if ascending > descending else "descending" if descending > ascending else "balanced"
        
        # Determine melodic character
        if avg_interval < 2:
            melodic_char = "stepwise, smooth melodic motion"
        elif avg_interval < 4:
            melodic_char = "moderate leaps, balanced motion"
        else:
            melodic_char = "wide leaps, dramatic motion"
        
        # Register analysis
        if avg_note < 60:
            register = "low register (deeper, darker tones)"
        elif avg_note < 72:
            register = "middle register (comfortable, balanced range)"
        else:
            register = "high register (brighter, more brilliant tones)"
        
        return {
            "note_count": len(notes),
            "note_range": note_range,
            "average_pitch": round(avg_note, 2),
            "pitch_variety": round(std_note, 2),
            "average_interval": round(avg_interval, 2),
            "melodic_contour": contour,
            "contour_stats": {
                "ascending": ascending,
                "descending": descending,
                "repeated": repeated
            },
            "melodic_character": melodic_char,
            "register": register,
            "summary": f"This melody features {melodic_char} in the {register}, with a {contour} contour."
        }
    
    @staticmethod
    def compare_seeds(seed1_params, seed2_params):
        """Compare two seeds and explain differences."""
        differences = []
        
        if seed1_params.get("tempo") != seed2_params.get("tempo"):
            tempo_diff = seed1_params.get("tempo", 120) - seed2_params.get("tempo", 120)
            differences.append(f"Tempo differs by {abs(tempo_diff)} BPM ({'faster' if tempo_diff > 0 else 'slower'})")
        
        if seed1_params.get("key") != seed2_params.get("key"):
            differences.append(f"Different key signatures: {seed1_params.get('key')} vs {seed2_params.get('key')}")
        
        if seed1_params.get("temperature") != seed2_params.get("temperature"):
            temp_diff = seed1_params.get("temperature", 1.0) - seed2_params.get("temperature", 1.0)
            differences.append(f"Temperature differs by {abs(temp_diff):.2f} ({'more random' if temp_diff > 0 else 'more predictable'})")
        
        mood1 = seed1_params.get("mood", {})
        mood2 = seed2_params.get("mood", {})
        valence_diff = abs(mood1.get("valence", 0.5) - mood2.get("valence", 0.5))
        arousal_diff = abs(mood1.get("arousal", 0.5) - mood2.get("arousal", 0.5))
        
        if valence_diff > 0.2:
            differences.append(f"Significantly different emotional valence (positive vs negative)")
        if arousal_diff > 0.2:
            differences.append(f"Significantly different energy levels (calm vs energetic)")
        
        return {
            "differences": differences if differences else ["Seeds are very similar"],
            "similarity_score": 1.0 - (len(differences) * 0.15)
        }
