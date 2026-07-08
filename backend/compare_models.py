# backend/compare_models.py
"""
Objective comparison script for Base Model vs RL Model.
Generates music with both models using the same inputs and analyzes differences.
Creates visualizations and statistical comparisons.
"""

import requests
import json
import os
import time
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
from mido import MidiFile
import seaborn as sns

BACKEND_URL = "http://localhost:5000"
OUTPUT_DIR = "comparison_results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Test prompts representing different moods and styles
TEST_PROMPTS = [
    {
        "prompt": "a cheerful morning with birds singing",
        "instrument": "Piano",
        "dynamics": "mf",
        "articulation": "Staccato",
        "expected_mood": "happy"
    },
    {
        "prompt": "a melancholic rainy evening",
        "instrument": "Piano",
        "dynamics": "p",
        "articulation": "Legato",
        "expected_mood": "sad"
    },
    {
        "prompt": "an energetic dance celebration",
        "instrument": "Piano",
        "dynamics": "ff",
        "articulation": "Staccato",
        "expected_mood": "energetic"
    },
    {
        "prompt": "peaceful meditation by the ocean",
        "instrument": "Piano",
        "dynamics": "pp",
        "articulation": "Legato",
        "expected_mood": "calm"
    },
    {
        "prompt": "dramatic storm approaching",
        "instrument": "Piano",
        "dynamics": "f",
        "articulation": "Tenuto",
        "expected_mood": "dramatic"
    }
]

def analyze_midi_file(midi_path):
    """Extract musical features from MIDI file for objective comparison."""
    try:
        midi = MidiFile(midi_path)
        
        notes = []
        velocities = []
        durations = []
        intervals = []
        
        current_time = 0
        last_note = None
        
        for track in midi.tracks:
            for msg in track:
                current_time += msg.time
                if msg.type == 'note_on' and msg.velocity > 0:
                    notes.append(msg.note)
                    velocities.append(msg.velocity)
                    
                    if last_note is not None:
                        intervals.append(abs(msg.note - last_note))
                    last_note = msg.note
                    
                elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                    if len(durations) < len(notes):
                        durations.append(current_time)
        
        # Ensure durations match notes
        while len(durations) < len(notes):
            durations.append(0)
        
        # Calculate metrics
        metrics = {
            "total_notes": len(notes),
            "avg_pitch": np.mean(notes) if notes else 0,
            "pitch_std": np.std(notes) if notes else 0,
            "pitch_range": max(notes) - min(notes) if notes else 0,
            "avg_velocity": np.mean(velocities) if velocities else 0,
            "velocity_std": np.std(velocities) if velocities else 0,
            "avg_interval": np.mean(intervals) if intervals else 0,
            "interval_std": np.std(intervals) if intervals else 0,
            "unique_pitches": len(set(notes)) if notes else 0,
            "pitch_diversity": len(set(notes)) / len(notes) if notes else 0,
        }
        
        return metrics, notes, velocities, intervals
    except Exception as e:
        print(f"Error analyzing MIDI: {e}")
        return None, [], [], []

def generate_with_model(prompt_data, use_rl=False):
    """Generate music using specified model."""
    try:
        data = {
            "textPrompt": prompt_data["prompt"],
            "prompt": prompt_data["prompt"],
            "instrument": prompt_data["instrument"],
            "dynamics": prompt_data["dynamics"],
            "articulation": prompt_data["articulation"],
            "useRL": "true" if use_rl else "false"
        }
        
        response = requests.post(f"{BACKEND_URL}/api/generate", data=data, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error generating music: {e}")
        return None

def download_midi(midi_url, save_path):
    """Download MIDI file from backend."""
    try:
        full_url = f"{BACKEND_URL}{midi_url}"
        response = requests.get(full_url)
        
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
        return False
    except Exception as e:
        print(f"Error downloading MIDI: {e}")
        return False

def compare_models():
    """Run comparison between base and RL models."""
    print("=" * 70)
    print("OBJECTIVE MODEL COMPARISON: Base Model vs RL Model")
    print("=" * 70)
    
    # Check if RL model exists
    rl_stats = requests.get(f"{BACKEND_URL}/api/rl/stats").json()
    if not rl_stats.get("rl_model_exists"):
        print("\n❌ RL model not found! Please train it first using:")
        print("   python RL_Train.py")
        return
    
    print(f"\n✅ RL Model Status:")
    print(f"   Total Feedback: {rl_stats['total_feedback']}")
    print(f"   Positive Feedback: {rl_stats['positive_feedback']}")
    print(f"   Average Rating: {rl_stats['avg_rating']}")
    print()
    
    results = []
    
    for i, prompt_data in enumerate(TEST_PROMPTS, 1):
        print(f"\n{'=' * 70}")
        print(f"Test {i}/{len(TEST_PROMPTS)}: {prompt_data['prompt']}")
        print(f"Expected Mood: {prompt_data['expected_mood']}")
        print(f"{'=' * 70}")
        
        # Generate with Base Model
        print("\n🔵 Generating with Base Model...")
        base_result = generate_with_model(prompt_data, use_rl=False)
        time.sleep(1)
        
        # Generate with RL Model
        print("🟢 Generating with RL Model...")
        rl_result = generate_with_model(prompt_data, use_rl=True)
        time.sleep(1)
        
        if not base_result or not rl_result:
            print("❌ Failed to generate music. Skipping...")
            continue
        
        # Download MIDI files
        base_midi_path = os.path.join(OUTPUT_DIR, f"test{i}_base.mid")
        rl_midi_path = os.path.join(OUTPUT_DIR, f"test{i}_rl.mid")
        
        download_midi(base_result['midi_url'], base_midi_path)
        download_midi(rl_result['midi_url'], rl_midi_path)
        
        # Analyze both
        base_metrics, base_notes, base_vel, base_int = analyze_midi_file(base_midi_path)
        rl_metrics, rl_notes, rl_vel, rl_int = analyze_midi_file(rl_midi_path)
        
        if base_metrics and rl_metrics:
            comparison = {
                "test_id": i,
                "prompt": prompt_data["prompt"],
                "expected_mood": prompt_data["expected_mood"],
                "base_model": base_metrics,
                "rl_model": rl_metrics,
                "base_mood": base_result.get("mood", {}),
                "rl_mood": rl_result.get("mood", {}),
                "base_notes": base_notes,
                "rl_notes": rl_notes,
                "base_velocities": base_vel,
                "rl_velocities": rl_vel,
            }
            results.append(comparison)
            
            # Print comparison
            print("\n📊 Metrics Comparison:")
            print(f"{'Metric':<25} {'Base Model':<15} {'RL Model':<15} {'Difference'}")
            print("-" * 70)
            for key in base_metrics:
                base_val = base_metrics[key]
                rl_val = rl_metrics[key]
                diff = rl_val - base_val
                diff_pct = (diff / base_val * 100) if base_val != 0 else 0
                print(f"{key:<25} {base_val:<15.2f} {rl_val:<15.2f} {diff:+.2f} ({diff_pct:+.1f}%)")
            
            print(f"\n🎭 Mood Analysis:")
            print(f"   Base - Valence: {base_result['mood']['valence']:.2f}, Arousal: {base_result['mood']['arousal']:.2f}")
            print(f"   RL   - Valence: {rl_result['mood']['valence']:.2f}, Arousal: {rl_result['mood']['arousal']:.2f}")
    
    # Save results
    results_file = os.path.join(OUTPUT_DIR, "comparison_results.json")
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n✅ Results saved to: {results_file}")
    
    # Generate visualizations
    print("\n📈 Generating visualizations...")
    create_visualizations(results)
    
    # Generate report
    generate_report(results, rl_stats)
    
    print(f"\n✅ All comparison files saved to: {OUTPUT_DIR}/")
    print("\nFiles created:")
    print(f"  - comparison_results.json (raw data)")
    print(f"  - comparison_report.txt (detailed analysis)")
    print(f"  - metrics_comparison.png (bar charts)")
    print(f"  - pitch_distributions.png (pitch analysis)")
    print(f"  - mood_comparison.png (mood space)")

def create_visualizations(results):
    """Create comprehensive visualizations."""
    if not results:
        return
    
    sns.set_style("darkgrid")
    
    # 1. Metrics Comparison Bar Chart
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Base Model vs RL Model - Musical Metrics Comparison', fontsize=16, fontweight='bold')
    
    metrics_to_plot = [
        'total_notes', 'avg_pitch', 'pitch_range',
        'avg_velocity', 'pitch_diversity', 'avg_interval'
    ]
    
    for idx, metric in enumerate(metrics_to_plot):
        ax = axes[idx // 3, idx % 3]
        
        test_ids = [r['test_id'] for r in results]
        base_values = [r['base_model'][metric] for r in results]
        rl_values = [r['rl_model'][metric] for r in results]
        
        x = np.arange(len(test_ids))
        width = 0.35
        
        ax.bar(x - width/2, base_values, width, label='Base Model', color='#4A90E2', alpha=0.8)
        ax.bar(x + width/2, rl_values, width, label='RL Model', color='#52b788', alpha=0.8)
        
        ax.set_xlabel('Test Case', fontweight='bold')
        ax.set_ylabel(metric.replace('_', ' ').title(), fontweight='bold')
        ax.set_title(metric.replace('_', ' ').title())
        ax.set_xticks(x)
        ax.set_xticklabels([f"T{tid}" for tid in test_ids])
        ax.legend()
        ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'metrics_comparison.png'), dpi=300, bbox_inches='tight')
    plt.close()
    
    # 2. Pitch Distribution Comparison
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Pitch Distribution Comparison', fontsize=16, fontweight='bold')
    
    for idx, result in enumerate(results[:6]):  # First 6 tests
        if idx >= len(axes.flat):
            break
        ax = axes.flat[idx]
        
        if result['base_notes'] and result['rl_notes']:
            ax.hist(result['base_notes'], bins=20, alpha=0.5, label='Base', color='#4A90E2', edgecolor='black')
            ax.hist(result['rl_notes'], bins=20, alpha=0.5, label='RL', color='#52b788', edgecolor='black')
            ax.set_xlabel('MIDI Note Number', fontweight='bold')
            ax.set_ylabel('Frequency', fontweight='bold')
            ax.set_title(f"Test {result['test_id']}: {result['expected_mood']}")
            ax.legend()
            ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'pitch_distributions.png'), dpi=300, bbox_inches='tight')
    plt.close()
    
    # 3. Mood Space Comparison
    fig, ax = plt.subplots(figsize=(12, 10))
    
    for result in results:
        base_mood = result['base_mood']
        rl_mood = result['rl_mood']
        
        # Base model point
        ax.scatter(base_mood['valence'], base_mood['arousal'], 
                  s=200, alpha=0.6, color='#4A90E2', marker='o', 
                  edgecolors='black', linewidth=2, label='Base' if result == results[0] else '')
        
        # RL model point
        ax.scatter(rl_mood['valence'], rl_mood['arousal'], 
                  s=200, alpha=0.6, color='#52b788', marker='s', 
                  edgecolors='black', linewidth=2, label='RL' if result == results[0] else '')
        
        # Connection line
        ax.plot([base_mood['valence'], rl_mood['valence']], 
               [base_mood['arousal'], rl_mood['arousal']], 
               'k--', alpha=0.3, linewidth=1)
        
        # Label
        ax.text(base_mood['valence'], base_mood['arousal'], 
               f" T{result['test_id']}", fontsize=9, fontweight='bold')
    
    # Quadrant lines
    ax.axhline(y=0.5, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    ax.axvline(x=0.5, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    
    # Labels
    ax.text(0.5, 0.98, 'High Energy', ha='center', va='top', fontsize=12, fontweight='bold', color='gray')
    ax.text(0.5, 0.02, 'Low Energy', ha='center', va='bottom', fontsize=12, fontweight='bold', color='gray')
    ax.text(0.02, 0.5, 'Negative', ha='left', va='center', fontsize=12, fontweight='bold', color='gray', rotation=90)
    ax.text(0.98, 0.5, 'Positive', ha='right', va='center', fontsize=12, fontweight='bold', color='gray', rotation=90)
    
    ax.set_xlabel('Valence (Negative ← → Positive)', fontsize=14, fontweight='bold')
    ax.set_ylabel('Arousal (Low Energy ← → High Energy)', fontsize=14, fontweight='bold')
    ax.set_title('Mood Space: Base Model vs RL Model', fontsize=16, fontweight='bold')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.legend(loc='upper right', fontsize=12)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'mood_comparison.png'), dpi=300, bbox_inches='tight')
    plt.close()

def generate_report(results, rl_stats):
    """Generate detailed text report."""
    report_path = os.path.join(OUTPUT_DIR, 'comparison_report.txt')
    
    with open(report_path, 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("OBJECTIVE COMPARISON REPORT: Base Model vs RL Model\n")
        f.write("=" * 80 + "\n")
        f.write(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"\n{'=' * 80}\n")
        f.write("RL MODEL TRAINING INFORMATION\n")
        f.write(f"{'=' * 80}\n")
        f.write(f"Total User Feedback: {rl_stats['total_feedback']}\n")
        f.write(f"Positive Feedback (4-5 stars): {rl_stats['positive_feedback']}\n")
        f.write(f"Negative Feedback (1-2 stars): {rl_stats['negative_feedback']}\n")
        f.write(f"Average Rating: {rl_stats['avg_rating']}\n")
        
        f.write(f"\n{'=' * 80}\n")
        f.write("STATISTICAL SUMMARY\n")
        f.write(f"{'=' * 80}\n")
        
        # Aggregate statistics
        metrics = ['total_notes', 'avg_pitch', 'pitch_range', 'avg_velocity', 'pitch_diversity', 'avg_interval']
        
        f.write(f"\n{'Metric':<25} {'Base Avg':<15} {'RL Avg':<15} {'Difference':<15}\n")
        f.write("-" * 80 + "\n")
        
        for metric in metrics:
            base_avg = np.mean([r['base_model'][metric] for r in results])
            rl_avg = np.mean([r['rl_model'][metric] for r in results])
            diff = rl_avg - base_avg
            diff_pct = (diff / base_avg * 100) if base_avg != 0 else 0
            
            f.write(f"{metric:<25} {base_avg:<15.2f} {rl_avg:<15.2f} {diff:+.2f} ({diff_pct:+.1f}%)\n")
        
        f.write(f"\n{'=' * 80}\n")
        f.write("DETAILED TEST RESULTS\n")
        f.write(f"{'=' * 80}\n")
        
        for result in results:
            f.write(f"\n{'-' * 80}\n")
            f.write(f"Test {result['test_id']}: {result['prompt']}\n")
            f.write(f"Expected Mood: {result['expected_mood']}\n")
            f.write(f"{'-' * 80}\n")
            
            f.write(f"\nMood Analysis:\n")
            f.write(f"  Base Model - Valence: {result['base_mood']['valence']:.3f}, Arousal: {result['base_mood']['arousal']:.3f}\n")
            f.write(f"  RL Model   - Valence: {result['rl_mood']['valence']:.3f}, Arousal: {result['rl_mood']['arousal']:.3f}\n")
            
            f.write(f"\nMusical Characteristics:\n")
            f.write(f"  {'Metric':<25} {'Base':<12} {'RL':<12} {'Diff'}\n")
            f.write(f"  {'-' * 60}\n")
            
            for metric in result['base_model']:
                base_val = result['base_model'][metric]
                rl_val = result['rl_model'][metric]
                diff = rl_val - base_val
                f.write(f"  {metric:<25} {base_val:<12.2f} {rl_val:<12.2f} {diff:+.2f}\n")
        
        f.write(f"\n{'=' * 80}\n")
        f.write("KEY FINDINGS\n")
        f.write(f"{'=' * 80}\n")
        
        # Calculate overall differences
        avg_pitch_diff = np.mean([r['rl_model']['avg_pitch'] - r['base_model']['avg_pitch'] for r in results])
        avg_diversity_diff = np.mean([r['rl_model']['pitch_diversity'] - r['base_model']['pitch_diversity'] for r in results])
        avg_velocity_diff = np.mean([r['rl_model']['avg_velocity'] - r['base_model']['avg_velocity'] for r in results])
        
        f.write(f"\n1. Pitch Characteristics:\n")
        f.write(f"   - Average pitch difference: {avg_pitch_diff:+.2f} MIDI notes\n")
        f.write(f"   - RL model {'higher' if avg_pitch_diff > 0 else 'lower'} than base model\n")
        
        f.write(f"\n2. Musical Diversity:\n")
        f.write(f"   - Pitch diversity difference: {avg_diversity_diff:+.3f}\n")
        f.write(f"   - RL model is {'more' if avg_diversity_diff > 0 else 'less'} diverse\n")
        
        f.write(f"\n3. Dynamics:\n")
        f.write(f"   - Average velocity difference: {avg_velocity_diff:+.2f}\n")
        f.write(f"   - RL model is {'louder' if avg_velocity_diff > 0 else 'quieter'} on average\n")
        
        f.write(f"\n{'=' * 80}\n")
        f.write("CONCLUSION\n")
        f.write(f"{'=' * 80}\n")
        f.write(f"\nThe RL model, trained on {rl_stats['total_feedback']} user ratings ")
        f.write(f"(avg: {rl_stats['avg_rating']:.2f}/5.0), shows measurable differences from the base model.\n")
        f.write(f"\nThese differences indicate that the RL model has adapted to user preferences\n")
        f.write(f"reflected in the training feedback, resulting in distinct musical characteristics.\n")

if __name__ == "__main__":
    print("\n🎵 Starting Model Comparison Analysis...")
    print("\nMake sure the backend server is running on http://localhost:5000")
    
    try:
        # Test backend connection
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend connection successful\n")
            compare_models()
        else:
            print("❌ Backend not responding correctly")
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        print("\nPlease start the backend server first:")
        print("   cd backend")
        print("   python server.py")
