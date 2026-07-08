// frontend/components/WaveformVisualizer.js
import { useEffect, useRef, useState } from 'react';

export default function WaveformVisualizer({ midiUrl, audioBuffer }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [WaveSurfer, setWaveSurfer] = useState(null);

  useEffect(() => {
    // Dynamically import WaveSurfer only on client side
    import('wavesurfer.js').then((module) => {
      setWaveSurfer(() => module.default);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !WaveSurfer || !audioBuffer) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#c06c84',
      progressColor: '#ff6b9d',
      cursorColor: '#f67280',
      barWidth: 3,
      barRadius: 3,
      cursorWidth: 2,
      height: 80,
      barGap: 2,
      responsive: true,
      normalize: true,
    });

    wavesurferRef.current = wavesurfer;

    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));

    wavesurfer.loadBlob(audioBuffer);

    return () => {
      wavesurfer.destroy();
    };
  }, [audioBuffer, WaveSurfer]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!WaveSurfer) return null;

  return (
    <div style={{ 
      marginTop: '20px', 
      padding: '20px', 
      background: 'rgba(30, 30, 46, 0.6)', 
      borderRadius: '12px',
      border: '1px solid #2a2a3e'
    }}>
      <h3 style={{ marginBottom: '10px', color: '#ff6b9d', fontSize: '1.1rem', fontWeight: '600' }}>
        Waveform Visualization
      </h3>
      <div ref={containerRef} style={{ marginBottom: '15px' }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={handlePlayPause}
          style={{
            padding: '10px 30px',
            background: 'linear-gradient(135deg, #ff6b9d, #f67280)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(255, 107, 157, 0.3)'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span style={{ color: '#d0d0d0', fontSize: '0.9rem' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
