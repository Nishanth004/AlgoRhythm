# backend/chatbot_handler.py

import os
from groq import Groq


class MusicChatbot:
    def __init__(self):
        # Initialize Groq client - set API key via environment variable
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            print("WARNING: GROQ_API_KEY not set. Chatbot will not function.")
            self.client = None
            return

        try:
            self.client = Groq(api_key=api_key)
        except Exception as e:
            print("ERROR: Failed to initialize Groq client:", e)
            self.client = None

        # Use a current Groq model ID (check your Groq console if needed)
        # Common general-purpose model:
        self.model = "llama-3.3-70b-versatile"

        self.system_prompt = """You are an AI assistant for Intonare (AlgoRhythm), a multimodal adaptive generative music system with blockchain provenance.

Key Features:
- Generates MIDI music from text prompts and images using LSTM/Transformer models
- Supports multiple models: Dutch Folk, Classical Transformer, MusicGen, MusicVAE (conceptually)
- Customizable instruments (Piano, Guitar, Violin, Flute, Drums), dynamics (pp to ff), articulation (Staccato, Legato, Tenuto)
- Mood analysis from text sentiment and image color analysis
- IPFS storage via Pinata for decentralized music storage
- NFT minting on Polygon Amoy testnet using smart contracts
- User feedback and ratings for RLHF
- Story-to-Suite mode for multi-scene narrative music generation
- Explainability dashboard showing mood-to-music mappings

Help users understand how to:
1. Create effective text prompts for music generation
2. Choose the right model for their desired genre
3. Adjust instrument, dynamics, and articulation settings
4. Understand mood analysis and music parameter mappings
5. Use Story-to-Suite mode for narrative compositions
6. Interpret the explainability dashboard
7. Mint NFTs and view them on IPFS
8. Provide feedback to improve the system

Be concise, friendly, and technically accurate. Focus on practical guidance."""

    def chat(self, user_message, conversation_history=None, context=None):
        """
        Process a chat message and return AI response.
        Context can include the currently generated music's details.
        """
        if not self.client:
            return {
                "response": None,
                "error": "Chatbot is not configured. Please set GROQ_API_KEY environment variable."
            }

        try:
            # Build context-aware system prompt
            system_prompt = self.system_prompt
            
            # If user has generated music, add context to help provide specific guidance
            if context and context.get("hasGeneration") and context.get("result"):
                result = context.get("result", {})
                mood = context.get("mood", {})
                explanation = result.get("explanation", {})
                
                # Extract key information
                valence = mood.get("valence", 0.5)
                arousal = mood.get("arousal", 0.5)
                tempo = mood.get("tempo_bpm", 0)
                key_mode = mood.get("key_mode", "Unknown")
                
                # Determine mood description
                if valence > 0.6:
                    valence_desc = "positive/happy"
                elif valence < 0.4:
                    valence_desc = "negative/sad"
                else:
                    valence_desc = "neutral"
                
                if arousal > 0.6:
                    arousal_desc = "high energy/excited"
                elif arousal < 0.4:
                    arousal_desc = "low energy/calm"
                else:
                    arousal_desc = "moderate energy"
                
                context_info = f"""

CURRENT GENERATION CONTEXT:
The user just generated music with the following characteristics:
- Original Prompt: "{context.get('prompt', 'N/A')}"
- Instrument: {context.get('instrument', 'N/A')}
- Dynamics: {context.get('dynamics', 'N/A')}
- Articulation: {context.get('articulation', 'N/A')}
- Mood Analysis:
  * Valence: {valence:.2f} ({valence_desc})
  * Arousal: {arousal:.2f} ({arousal_desc})
- Music Parameters:
  * Tempo: {tempo} BPM
  * Key: {key_mode}
  * Temperature: {explanation.get('temperature', 'N/A')}

When the user asks for modifications (e.g., "make it happier", "more energetic", "slower"), provide specific suggestions to adjust their prompt, instrument, dynamics, or other parameters to achieve the desired emotional effect.

For example:
- To make it happier: Increase valence by using brighter words (joy, sunshine, celebration), choose major keys, increase tempo
- To make it sadder: Use melancholic words (lonely, rain, farewell), choose minor keys, slower tempo
- To make it more energetic: Use action words (running, dancing, powerful), increase tempo, use ff dynamics
- To make it calmer: Use peaceful words (gentle, floating, serene), decrease tempo, use pp/p dynamics"""
                
                system_prompt = self.system_prompt + context_info

            messages = [{"role": "system", "content": system_prompt}]

            if conversation_history:
                # Ensure roles are valid for Groq: 'user' or 'assistant'
                for m in conversation_history:
                    if m.get("role") not in ("user", "assistant", "system"):
                        m["role"] = "user"
                messages.extend(conversation_history)

            messages.append({"role": "user", "content": user_message})

            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=0.7,
                max_tokens=500,
                top_p=1,
                stream=False,
            )

            response = chat_completion.choices[0].message.content
            return {"response": response, "error": None}

        except Exception as e:
            # Log full error on backend for debugging
            print("Groq chat error:", repr(e))
            return {"response": None, "error": str(e)}

    def get_prompt_suggestions(self, genre=None):
        """Generate prompt suggestions based on genre."""
        suggestions = {
            "folk": [
                "A cheerful village celebration with dancing",
                "Melancholic evening by the countryside",
                "Festive harvest season melody",
            ],
            "classical": [
                "Dramatic piano sonata with intense emotions",
                "Peaceful nocturne under moonlight",
                "Triumphant symphony finale",
            ],
            "general": [
                "Uplifting morning sunrise with birds chirping",
                "Mysterious dark forest atmosphere",
                "Energetic celebration with joy and laughter",
                "Calm meditation by the ocean waves",
            ],
        }
        return suggestions.get(genre, suggestions["general"])
