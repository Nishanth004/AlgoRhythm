// frontend/components/StoryMode.js
import { useState } from 'react';
import axios from 'axios';
import { Midi } from '@tonejs/midi';
import styles from '../styles/Home.module.css';

const BACKEND_BASE_URL = 'http://localhost:5000';
let audioContext = null;

export default function StoryMode({ onComplete }) {
  const [scenes, setScenes] = useState([
    { prompt: '', image: null, instrument: 'Piano', dynamics: 'mf', articulation: 'Staccato' }
  ]);
  const [loading, setLoading] = useState(false);
  const [suiteResults, setSuiteResults] = useState(null);
  const [playingScene, setPlayingScene] = useState(null);

  const playMidiFromUrl = async (url, sceneIndex) => {
    try {
      setPlayingScene(sceneIndex);
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const midi = new Midi(arrayBuffer);

      if (typeof window === "undefined") return;
      if (!audioContext || audioContext.state === "closed") {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.gain.value = 0.2;
      masterGain.connect(audioContext.destination);

      const now = audioContext.currentTime;

      midi.tracks.forEach((track) => {
        track.notes.forEach((note) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();

          const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
          osc.frequency.value = frequency;
          gain.gain.value = note.velocity || 0.8;

          osc.connect(gain);
          gain.connect(masterGain);

          const startTime = now + note.time;
          const duration = note.duration;

          osc.start(startTime);
          osc.stop(startTime + duration);
        });
      });

      // Reset playing state after the longest note finishes
      const longestNote = midi.tracks.reduce((max, track) => {
        const trackEnd = track.notes.reduce((maxTime, note) => 
          Math.max(maxTime, note.time + note.duration), 0);
        return Math.max(max, trackEnd);
      }, 0);

      setTimeout(() => setPlayingScene(null), longestNote * 1000);
    } catch (err) {
      console.error('Error playing MIDI:', err);
      setPlayingScene(null);
    }
  };

  const addScene = () => {
    setScenes([...scenes, { prompt: '', image: null, instrument: 'Piano', dynamics: 'mf', articulation: 'Staccato' }]);
  };

  const removeScene = (index) => {
    if (scenes.length > 1) {
      setScenes(scenes.filter((_, i) => i !== index));
    }
  };

  const updateScene = (index, field, value) => {
    const updated = [...scenes];
    updated[index][field] = value;
    setScenes(updated);
  };

  const generateSuite = async () => {
    if (scenes.some(s => !s.prompt.trim())) {
      alert('Please fill in all scene prompts');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Add scenes data
      const scenesData = scenes.map((scene, idx) => ({
        prompt: scene.prompt,
        instrument: scene.instrument,
        dynamics: scene.dynamics,
        articulation: scene.articulation,
        hasImage: !!scene.image
      }));
      
      formData.append('scenes', JSON.stringify(scenesData));
      
      // Add image files
      scenes.forEach((scene, idx) => {
        if (scene.image) {
          formData.append(`image_${idx}`, scene.image);
        }
      });
      
      const response = await axios.post(`${BACKEND_BASE_URL}/api/story-suite`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuiteResults(response.data.suite);
      if (onComplete) onComplete(response.data.suite);
    } catch (error) {
      console.error('Story suite generation error:', error);
      alert('Failed to generate story suite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '25px', 
      background: 'rgba(30, 30, 46, 0.8)', 
      borderRadius: '15px',
      marginTop: '20px',
      border: '2px solid rgba(255, 107, 157, 0.3)'
    }}>
      <h2 style={{ color: '#ff6b9d', marginBottom: '15px', fontSize: '1.5rem', fontWeight: '600' }}>
        Story-to-Suite Mode
      </h2>
      <p style={{ color: '#b0b0b0', marginBottom: '20px', fontSize: '0.95rem', lineHeight: '1.5' }}>
        Create a musical narrative by describing multiple scenes. Each scene will generate a connected piece.
      </p>

      {scenes.map((scene, idx) => (
        <div key={idx} style={{ 
          marginBottom: '20px', 
          padding: '20px', 
          background: 'rgba(40, 40, 56, 0.6)',
          borderRadius: '12px',
          border: '1px solid #2a2a3e'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ color: '#ffa07a', margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
              Scene {idx + 1}
            </h3>
            {scenes.length > 1 && (
              <button 
                onClick={() => removeScene(idx)}
                style={{
                  padding: '6px 16px',
                  background: 'rgba(255, 69, 87, 0.6)',
                  border: '1px solid rgba(255, 69, 87, 0.8)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 69, 87, 0.8)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 69, 87, 0.6)'}
              >
                Remove
              </button>
            )}
          </div>

          <textarea
            value={scene.prompt}
            onChange={(e) => updateScene(idx, 'prompt', e.target.value)}
            placeholder={`Describe scene ${idx + 1}... e.g., "A hero's journey begins with hope"`}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '14px',
              marginBottom: '15px',
              background: 'rgba(30, 30, 46, 0.8)',
              border: '1px solid #2a2a3e',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#ff6b9d';
              e.target.style.background = 'rgba(30, 30, 46, 0.95)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#2a2a3e';
              e.target.style.background = 'rgba(30, 30, 46, 0.8)';
            }}
          />

          <div style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              color: '#d0d0d0', 
              fontSize: '0.85rem',
              fontWeight: '500'
            }}>
              Optional Image (Mood / Artwork)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => updateScene(idx, 'image', e.target.files?.[0] || null)}
              className={styles.fileInput}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            {['instrument', 'dynamics', 'articulation'].map((field) => (
              <div key={field}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  color: '#d0d0d0', 
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  {field}
                </label>
                <select
                  value={scene[field]}
                  onChange={(e) => updateScene(idx, field, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(30, 30, 46, 0.8)',
                    border: '1px solid #2a2a3e',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {field === 'instrument' && (
                    <>
                      <option value="Piano">Piano</option>
                      <option value="Guitar">Guitar</option>
                      <option value="Violin">Violin</option>
                      <option value="Flute">Flute</option>
                      <option value="Drums">Drums</option>
                    </>
                  )}
                  {field === 'dynamics' && (
                    <>
                      <option value="pp">pp (very soft)</option>
                      <option value="p">p (soft)</option>
                      <option value="mp">mp (moderately soft)</option>
                      <option value="mf">mf (moderately loud)</option>
                      <option value="f">f (loud)</option>
                      <option value="ff">ff (very loud)</option>
                    </>
                  )}
                  {field === 'articulation' && (
                    <>
                      <option value="Staccato">Staccato</option>
                      <option value="Legato">Legato</option>
                      <option value="Tenuto">Tenuto</option>
                    </>
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
        <button
          onClick={addScene}
          style={{
            padding: '12px 30px',
            background: 'rgba(192, 108, 132, 0.6)',
            border: '1px solid rgba(192, 108, 132, 0.8)',
            borderRadius: '10px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(192, 108, 132, 0.8)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(192, 108, 132, 0.6)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          Add Scene
        </button>

        <button
          onClick={generateSuite}
          disabled={loading || scenes.length < 2}
          style={{
            padding: '12px 30px',
            background: loading ? 'rgba(70, 70, 90, 0.6)' : 'linear-gradient(135deg, #ff6b9d, #f67280)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            flex: 1,
            transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(255, 107, 157, 0.3)',
            opacity: loading ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 157, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(255, 107, 157, 0.3)';
            }
          }}
        >
          {loading ? 'Generating Suite...' : 'Generate Story Suite'}
        </button>
      </div>

      {suiteResults && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ color: '#ff6b9d', marginBottom: '15px', fontSize: '1.2rem' }}>Generated Suite</h3>
          {suiteResults.map((result, idx) => (
            <div key={idx} style={{ 
              marginBottom: '15px', 
              padding: '15px', 
              background: 'rgba(255, 107, 157, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 107, 157, 0.3)'
            }}>
              <h4 style={{ color: '#ffa07a', marginBottom: '8px', fontSize: '1rem' }}>Scene {idx + 1}</h4>
              <p style={{ color: '#d0d0d0', fontSize: '0.9rem', marginBottom: '12px' }}>{result.prompt}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a 
                  href={`${BACKEND_BASE_URL}${result.midi_url}`} 
                  download={`scene_${idx + 1}.mid`}
                  style={{
                    padding: '8px 20px',
                    background: 'linear-gradient(135deg, #ff6b9d, #f67280)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                    display: 'inline-block',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Download MIDI
                </a>
                <button
                  onClick={() => playMidiFromUrl(`${BACKEND_BASE_URL}${result.midi_url}`, idx)}
                  disabled={playingScene === idx}
                  style={{
                    padding: '8px 20px',
                    background: playingScene === idx ? 'rgba(100, 100, 120, 0.6)' : 'rgba(255, 107, 157, 0.2)',
                    border: '1px solid rgba(255, 107, 157, 0.5)',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: playingScene === idx ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {playingScene === idx ? '▶ Playing...' : '▶ Play'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
