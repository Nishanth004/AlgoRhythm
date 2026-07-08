# backend/analytics_handler.py

import sqlite3
import json
from datetime import datetime
import os

class AnalyticsHandler:
    def __init__(self, db_path="analytics.db"):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """Initialize analytics database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Seed history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS seed_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seed_hash TEXT UNIQUE NOT NULL,
                prompt TEXT,
                image_used BOOLEAN,
                model_used TEXT,
                instrument TEXT,
                dynamics TEXT,
                articulation TEXT,
                mood_valence REAL,
                mood_arousal REAL,
                tempo INTEGER,
                key_signature TEXT,
                temperature REAL,
                ipfs_hash TEXT,
                nft_token_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                play_count INTEGER DEFAULT 0,
                average_rating REAL DEFAULT 0.0,
                rating_count INTEGER DEFAULT 0
            )
        """)
        
        # User interactions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seed_hash TEXT,
                action_type TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (seed_hash) REFERENCES seed_history(seed_hash)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def log_seed(self, seed_data):
        """Log a new seed generation."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO seed_history (
                    seed_hash, prompt, image_used, model_used, instrument,
                    dynamics, articulation, mood_valence, mood_arousal,
                    tempo, key_signature, temperature, ipfs_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                seed_data.get("seed_hash"),
                seed_data.get("prompt"),
                seed_data.get("image_used", False),
                seed_data.get("model", "dutch_folk"),
                seed_data.get("instrument"),
                seed_data.get("dynamics"),
                seed_data.get("articulation"),
                seed_data.get("mood", {}).get("valence", 0.5),
                seed_data.get("mood", {}).get("arousal", 0.5),
                seed_data.get("tempo", 120),
                seed_data.get("key", "C"),
                seed_data.get("temperature", 1.0),
                seed_data.get("ipfs_hash")
            ))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            # Seed already exists, update play count
            cursor.execute("""
                UPDATE seed_history SET play_count = play_count + 1
                WHERE seed_hash = ?
            """, (seed_data.get("seed_hash"),))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error logging seed: {e}")
            return False
        finally:
            conn.close()
    
    def update_seed_rating(self, seed_hash, rating):
        """Update seed rating from feedback."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get current rating stats
            cursor.execute("""
                SELECT average_rating, rating_count FROM seed_history
                WHERE seed_hash = ?
            """, (seed_hash,))
            result = cursor.fetchone()
            
            if result:
                current_avg, count = result
                new_count = count + 1
                new_avg = ((current_avg * count) + rating) / new_count
                
                cursor.execute("""
                    UPDATE seed_history
                    SET average_rating = ?, rating_count = ?
                    WHERE seed_hash = ?
                """, (new_avg, new_count, seed_hash))
                conn.commit()
                return True
            return False
        except Exception as e:
            print(f"Error updating rating: {e}")
            return False
        finally:
            conn.close()
    
    def log_interaction(self, seed_hash, action_type, metadata=None):
        """Log user interaction."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO interactions (seed_hash, action_type, metadata)
                VALUES (?, ?, ?)
            """, (seed_hash, action_type, json.dumps(metadata) if metadata else None))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error logging interaction: {e}")
            return False
        finally:
            conn.close()
    
    def get_user_history(self, limit=50):
        """Retrieve user's seed generation history."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                seed_hash, prompt, model_used, instrument, dynamics,
                articulation, tempo, key_signature, mood_valence,
                mood_arousal, ipfs_hash, created_at, play_count,
                average_rating, rating_count
            FROM seed_history
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        
        columns = [desc[0] for desc in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        
        return results
    
    def get_analytics_summary(self):
        """Get analytics summary statistics."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Total seeds
        cursor.execute("SELECT COUNT(*) FROM seed_history")
        total_seeds = cursor.fetchone()[0]
        
        # Average rating
        cursor.execute("SELECT AVG(average_rating) FROM seed_history WHERE rating_count > 0")
        avg_rating = cursor.fetchone()[0] or 0.0
        
        # Most used model
        cursor.execute("""
            SELECT model_used, COUNT(*) as count
            FROM seed_history
            GROUP BY model_used
            ORDER BY count DESC
            LIMIT 1
        """)
        most_used_model = cursor.fetchone()
        
        # Most used instrument
        cursor.execute("""
            SELECT instrument, COUNT(*) as count
            FROM seed_history
            GROUP BY instrument
            ORDER BY count DESC
            LIMIT 1
        """)
        most_used_instrument = cursor.fetchone()
        
        # Top rated seeds
        cursor.execute("""
            SELECT seed_hash, prompt, average_rating, rating_count
            FROM seed_history
            WHERE rating_count > 0
            ORDER BY average_rating DESC, rating_count DESC
            LIMIT 5
        """)
        top_seeds = cursor.fetchall()
        
        # Mood distribution
        cursor.execute("""
            SELECT 
                ROUND(mood_valence, 1) as valence_bucket,
                ROUND(mood_arousal, 1) as arousal_bucket,
                COUNT(*) as count
            FROM seed_history
            GROUP BY valence_bucket, arousal_bucket
            ORDER BY count DESC
            LIMIT 10
        """)
        mood_distribution = cursor.fetchall()
        
        conn.close()
        
        return {
            "total_seeds": total_seeds,
            "average_rating": round(avg_rating, 2),
            "most_used_model": most_used_model,
            "most_used_instrument": most_used_instrument,
            "top_seeds": top_seeds,
            "mood_distribution": mood_distribution
        }
