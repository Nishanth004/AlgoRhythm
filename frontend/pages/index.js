// frontend/pages/index.js
import { useCallback, useState, useEffect } from "react";
import axios from "axios";
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";
import styles from "../styles/Home.module.css";
import { Midi } from "@tonejs/midi";
import { ethers } from "ethers";
import Link from "next/link";

import Chatbot from "../components/Chatbot";
import WaveformVisualizer from "../components/WaveformVisualizer";
import IPFSViewer from "../components/IPFSViewer";
import StoryMode from "../components/StoryMode";
import ExplainabilityDashboard from "../components/ExplainabilityDashboard";

let audioContext = null;

const BACKEND_BASE_URL = "http://localhost:5000";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const CONTRACT_ABI = [
  "function mintSeedNFT(address to, string seedHash, string tokenURI) external returns (uint256)",
  "function totalMinted() external view returns (uint256)"
];

export default function Home() {
  const [textPrompt, setTextPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [instrument, setInstrument] = useState("Piano");
  const [dynamics, setDynamics] = useState("mf");
  const [articulation, setArticulation] = useState("Staccato");
  const [selectedModel, setSelectedModel] = useState("dutch_folk");
  const [theme, setTheme] = useState("default");
  
  const [loading, setLoading] = useState(false);
  const [midiUrl, setMidiUrl] = useState("");
  const [seedHash, setSeedHash] = useState("");
  const [tokenUri, setTokenUri] = useState("");
  const [mood, setMood] = useState(null);
  const [result, setResult] = useState(null);
  
  const [rating, setRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [audioBuffer, setAudioBuffer] = useState(null);
  
  // New feature states
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [storyMode, setStoryMode] = useState(false);
  const [showExplainability, setShowExplainability] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  
  // RL and theme states
  const [useRL, setUseRL] = useState(false);
  const [rlStats, setRlStats] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    checkBackendConnection();
    fetchRLStats();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const response = await axios.get(`${BACKEND_BASE_URL}/api/health`, { timeout: 3000 });
      setBackendConnected(true);
      console.log("Backend connected:", response.data);
    } catch (error) {
      setBackendConnected(false);
      console.error("Backend not connected. Please start the backend server.");
    }
  };

  const fetchRLStats = async () => {
    try {
      const response = await axios.get(`${BACKEND_BASE_URL}/api/rl/stats`);
      setRlStats(response.data);
    } catch (error) {
      console.error("Error fetching RL stats:", error);
    }
  };

  const themes = {
    default: {
      bg: "#1a1a1a",
      primary: "#ff4757",
      secondary: "#ff6b81",
      accent: "#ff6b9d"
    },
    ocean: {
      bg: "#0a1929",
      primary: "#00d4ff",
      secondary: "#4dabf7",
      accent: "#00b4d8"
    },
    forest: {
      bg: "#1a2f1a",
      primary: "#52b788",
      secondary: "#74c69d",
      accent: "#40916c"
    },
    sunset: {
      bg: "#2d1b2e",
      primary: "#ff6b35",
      secondary: "#f7931e",
      accent: "#fbb13c"
    }
  };

  const currentTheme = themes[theme];

  const particlesInit = useCallback(async (main) => {
    await loadFull(main);
  }, []);

  const particlesOptions = {
    background: { color: currentTheme.bg },
    fpsLimit: 60,
    interactivity: {
      events: {
        onClick: { enable: true, mode: "push" },
        onHover: { enable: true, mode: "repulse" },
        resize: true
      },
      modes: {
        push: { quantity: 4 },
        repulse: { distance: 200, duration: 0.4 }
      }
    },
    particles: {
      color: { value: currentTheme.primary },
      links: {
        color: currentTheme.secondary,
        distance: 150,
        enable: true,
        opacity: 0.5,
        width: 1
      },
      collisions: { enable: true },
      move: {
        direction: "none",
        enable: true,
        outModes: "bounce",
        random: false,
        speed: 2,
        straight: false
      },
      number: {
        density: { enable: true, area: 800 },
        value: 80
      },
      opacity: { value: 0.7 },
      shape: { type: "circle" },
      size: { random: true, value: 5 }
    },
    detectRetina: true
  };

  const playMidiFromUrl = async (url) => {
    try {
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
          osc.stop(startTime + duration + 0.05);
        });
      });
    } catch (err) {
      console.error("Error playing MIDI:", err);
      setStatusMsg("Error playing MIDI. Check console for details.");
    }
  };

  const handleGenerate = async () => {
    if (!textPrompt.trim()) {
      setStatusMsg("Please enter a text prompt first.");
      return;
    }

    if (!backendConnected) {
      setStatusMsg("Backend server not connected. Please start the backend server.");
      return;
    }

    setLoading(true);
    setStatusMsg("");
    setMidiUrl("");
    setSeedHash("");
    setTokenUri("");
    setMood(null);
    setResult(null);
    setRating(0);
    setAudioBuffer(null);
    setShowExplainability(false);

    try {
      const formData = new FormData();
      formData.append("textPrompt", textPrompt);
      formData.append("prompt", textPrompt);
      formData.append("instrument", instrument);
      formData.append("dynamics", dynamics);
      formData.append("articulation", articulation);
      formData.append("useRL", useRL ? "true" : "false");

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await axios.post(
        `${BACKEND_BASE_URL}/api/generate`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const data = response.data;
      const absoluteMidiUrl = data.midiUrl?.startsWith('http') 
        ? data.midiUrl 
        : `${BACKEND_BASE_URL}${data.midiUrl || data.midi_url}`;

      setMidiUrl(absoluteMidiUrl);
      setSeedHash(data.seedHash || data.seed_hash);
      setTokenUri(data.tokenUri || "");
      setMood(data.mood || null);
      setResult(data);

      // Load audio for waveform
      const audioRes = await fetch(absoluteMidiUrl);
      const audioBlob = await audioRes.blob();
      setAudioBuffer(audioBlob);

      await playMidiFromUrl(absoluteMidiUrl);
      setStatusMsg("Generation complete. Playing now!");
      
      if (data.explanation) {
        setShowExplainability(true);
      }
    } catch (err) {
      console.error("Error generating music:", err);
      setStatusMsg("Error generating music. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (value) => {
    if (!seedHash) {
      return;
    }
    setRatingSubmitting(true);

    try {
      await axios.post(`${BACKEND_BASE_URL}/api/feedback`, {
        seedHash,
        seed_hash: seedHash,
        rating: value
      });
      setRating(value);
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleMint = async () => {
    if (!seedHash || !midiUrl) {
      setStatusMsg("Generate a piece before minting.");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setStatusMsg("Contract address not set. Define NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.");
      return;
    }

    try {
      setMinting(true);
      setStatusMsg("Connecting wallet...");

      if (typeof window === "undefined" || !window.ethereum) {
        setStatusMsg("MetaMask is required to mint the NFT.");
        setMinting(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      let finalTokenUri = tokenUri;
      if (!finalTokenUri && result?.metadata_hash) {
        finalTokenUri = `ipfs://${result.metadata_hash}`;
      }
      if (!finalTokenUri) {
        const localMetadata = {
          name: "AlgoRhythm Seed (Local)",
          description: "Multimodal LSTM-generated music seed from AlgoRhythm (no IPFS).",
          seedHash,
          mood,
          prompt: textPrompt,
          createdAt: new Date().toISOString()
        };
        finalTokenUri = JSON.stringify(localMetadata);
      }

      setStatusMsg("Sending mint transaction...");
      const tx = await contract.mintSeedNFT(account, seedHash, finalTokenUri);
      const receipt = await tx.wait();

      setStatusMsg(`Minted! Tx hash: ${receipt.hash}`);
    } catch (err) {
      console.error("Error minting seed NFT:", err);
      setStatusMsg("Error during mint. Ensure you're on the correct Polygon testnet with enough test MATIC.");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Particles id="tsparticles" init={particlesInit} options={particlesOptions} />

      {/* Theme and RL Controls */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        {/* RL Toggle */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '8px 12px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ 
            fontSize: '0.85rem', 
            color: '#fff',
            fontWeight: '500'
          }}>
            RL Mode
          </span>
          <button
            onClick={() => {
              if (!rlStats?.rl_model_exists) {
                alert('RL model not trained yet. Please submit ratings first!');
                return;
              }
              setUseRL(!useRL);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: useRL ? 'linear-gradient(135deg, #52b788, #40916c)' : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            title={rlStats?.rl_model_exists ? 'Toggle RL Model' : 'RL model not available'}
          >
            {useRL ? 'ON' : 'OFF'}
          </button>
          {rlStats && (
            <span style={{
              fontSize: '0.7rem',
              color: rlStats.rl_model_exists ? '#52b788' : '#ffa07a',
              fontStyle: 'italic'
            }}>
              {rlStats.total_feedback} ratings
            </span>
          )}
        </div>

        {/* Theme Palette */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '8px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.secondary})`,
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            <span>🎨</span>
            <span>Theme</span>
            <span style={{ fontSize: '0.7rem' }}>{themeMenuOpen ? '▲' : '▼'}</span>
          </button>
          
          {themeMenuOpen && (
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '4px'
            }}>
              {Object.keys(themes).map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => {
                    setTheme(themeName);
                    setThemeMenuOpen(false);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: theme === themeName ? `3px solid ${themes[themeName].primary}` : '2px solid rgba(255,255,255,0.2)',
                    background: `linear-gradient(135deg, ${themes[themeName].primary}, ${themes[themeName].secondary})`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: theme === themeName ? `0 0 15px ${themes[themeName].primary}` : 'none'
                  }}
                  title={themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={styles.title}>AlgoRhythm</h1>
        <p className={styles.subtitle}>
          Multimodal, adaptive generative music with blockchain provenance.
        </p>

        {!backendConnected && (
          <div style={{
            padding: '15px',
            background: 'rgba(255, 69, 87, 0.2)',
            border: '1px solid rgba(255, 69, 87, 0.5)',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center',
            color: '#ff4757'
          }}>
            Backend server not connected. Please start the backend server on port 5000.
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'center', 
          marginBottom: '20px', 
          flexWrap: 'wrap',
          position: 'relative',
          zIndex: 1
        }}>
          <button 
            onClick={() => setChatbotOpen(true)} 
            className={styles.secondaryButton}
            disabled={!backendConnected}
          >
            AI Assistant
          </button>
          <Link href="/analytics" style={{ textDecoration: 'none' }}>
            <button className={styles.secondaryButton}>
              Analytics
            </button>
          </Link>
          <button 
            onClick={() => setStoryMode(!storyMode)} 
            className={styles.secondaryButton}
            style={{ 
              background: storyMode ? `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.primary})` : `rgba(255, 107, 157, 0.1)`,
              borderColor: storyMode ? currentTheme.accent : 'rgba(255, 107, 157, 0.5)'
            }}
          >
            {storyMode ? 'Story Mode ON' : 'Story Mode'}
          </button>
        </div>

        {!storyMode ? (
          <>
            <div className={styles.formGroup} style={{ marginBottom: '25px' }}>
              <label className={styles.label} style={{ marginBottom: '10px', display: 'block' }}>🎵 Music Generation Model</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)} 
                className={styles.select}
                style={{ fontWeight: '600', marginTop: '8px' }}
              >
                <option value="dutch_folk">Dutch Folk Songs (LSTM)</option>
              </select>
              <p style={{ 
                fontSize: '0.85rem', 
                color: '#b0b0b0', 
                marginTop: '10px',
                marginBottom: '0',
                lineHeight: '1.4'
              }}>
                Original Dutch folk song generator using LSTM neural network
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Text prompt / mood description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="e.g., a lonely walk in a rainy city"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Optional image (mood / artwork)</label>
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Instrument</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className={styles.select}
              >
                <option value="Piano">Piano</option>
                <option value="Violin">Violin</option>
                <option value="Flute">Flute</option>
                <option value="Guitar">Guitar</option>
                <option value="Drums">Drums</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Dynamics</label>
              <select
                value={dynamics}
                onChange={(e) => setDynamics(e.target.value)}
                className={styles.select}
              >
                <option value="pp">pp (very soft)</option>
                <option value="p">p (soft)</option>
                <option value="mp">mp (moderately soft)</option>
                <option value="mf">mf (moderately loud)</option>
                <option value="f">f (loud)</option>
                <option value="ff">ff (very loud)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Articulation</label>
              <select
                value={articulation}
                onChange={(e) => setArticulation(e.target.value)}
                className={styles.select}
              >
                <option value="Staccato">Staccato</option>
                <option value="Tenuto">Tenuto</option>
                <option value="Accent">Accent</option>
                <option value="Legato">Legato</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !backendConnected}
              className={`${styles.button} ${loading ? styles.loading : ""}`}
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </>
        ) : (
          <StoryMode onComplete={(suite) => {
            console.log('Suite generated:', suite);
            setStatusMsg("Story suite generated successfully!");
          }} />
        )}

        {midiUrl && !storyMode && (
          <>
            <div className={styles.downloadLink}>
              <a href={midiUrl} download="generated_song.mid">
                Download MIDI
              </a>
              <button
                type="button"
                onClick={() => playMidiFromUrl(midiUrl)}
                className={styles.secondaryButton}
              >
                Play Again
              </button>
            </div>

            {mood && (
              <div className={styles.infoBlock}>
                <div className={styles.infoText}>
                  <div className="stat">
                    <strong>Valence:</strong> {mood.valence?.toFixed(2) || 'N/A'}
                  </div>
                  <div className="stat">
                    <strong>Arousal:</strong> {mood.arousal?.toFixed(2) || 'N/A'}
                  </div>
                  <div className="stat">
                    <strong>Tempo:</strong> {mood.tempo_bpm || 'N/A'} BPM
                  </div>
                  <div className="stat">
                    <strong>Mode:</strong> {mood.key_mode || 'N/A'}
                  </div>
                  {result?.model_used && (
                    <div className="stat" style={{ 
                      borderTop: '1px solid rgba(255, 107, 157, 0.3)', 
                      paddingTop: '8px',
                      marginTop: '8px'
                    }}>
                      <strong>Model:</strong> 
                      <span style={{ 
                        color: result.model_used.includes('RL') ? '#52b788' : '#ffa07a',
                        marginLeft: '5px',
                        fontSize: '0.9rem'
                      }}>
                        {result.model_used}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result && result.ipfs_hash && (
              <IPFSViewer 
                ipfsHash={result.ipfs_hash} 
                metadataHash={result.metadata_hash}
                seedHash={seedHash}
              />
            )}

            {seedHash && (
              <div className={styles.infoBlock}>
                <p className={styles.seedHash}>
                  Seed hash: <span>{seedHash}</span>
                </p>

                <div className={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      className={
                        value <= rating ? styles.ratingStarActive : styles.ratingStar
                      }
                      disabled={ratingSubmitting}
                      onClick={() => handleSubmitRating(value)}
                    >
                      {value}★
                    </button>
                  ))}
                </div>

                {rating > 0 && (
                  <p style={{
                    marginTop: '12px',
                    fontSize: '0.9rem',
                    color: '#4ade80',
                    textAlign: 'center',
                    padding: '8px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}>
                    Thanks for your feedback!
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleMint}
                  disabled={minting}
                  className={styles.secondaryButton}
                  style={{ marginTop: '16px' }}
                >
                  {minting ? "Minting..." : "Mint Seed NFT"}
                </button>
              </div>
            )}

            {showExplainability && result?.explanation && (
              <ExplainabilityDashboard
                explanation={result.explanation}
                sequenceAnalysis={result.sequence_analysis}
                instrumentExplanation={result.instrument_explanation}
              />
            )}
          </>
        )}

        {statusMsg && <p className={styles.status}>{statusMsg}</p>}
      </div>

      {backendConnected && (
        <Chatbot 
          isOpen={chatbotOpen} 
          onClose={() => setChatbotOpen(false)}
          currentContext={{
            prompt: textPrompt,
            instrument,
            dynamics,
            articulation,
            mood,
            result,
            hasGeneration: !!result
          }}
        />
      )}
    </div>
  );
}
