// frontend/components/ExplainabilityDashboard.js
import { useEffect, useRef, useState } from 'react';

export default function ExplainabilityDashboard({ explanation, sequenceAnalysis, instrumentExplanation }) {
  const canvasRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Only draw when dashboard is expanded and canvas exists
    if (!explanation || !isExpanded || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw mood space quadrants
    ctx.strokeStyle = '#3a3a4e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Happy/Excited', width / 2, 15);
    ctx.fillText('Sad/Calm', width / 2, height - 5);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Low Energy', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(width - 15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('High Energy', 0, 0);
    ctx.restore();

    // Plot current mood point
    const valence = explanation.valence || 0.5;
    const arousal = explanation.arousal || 0.5;
    const x = valence * width;
    const y = (1 - arousal) * height;

    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Your Mood', x, y - 15);
  }, [explanation, isExpanded]);

  if (!explanation) return null;

  return (
    <div style={{
      marginTop: '30px',
      padding: '20px',
      background: 'rgba(30, 30, 46, 0.6)',
      borderRadius: '15px',
      border: '2px solid rgba(255, 107, 157, 0.2)'
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          color: '#ff6b9d',
          fontSize: '1.3rem',
          fontWeight: '600',
          cursor: 'pointer',
          padding: '5px 10px',
          textAlign: 'left',
          marginBottom: '0'
        }}
      >
        <span>Music Explainability Dashboard</span>
        <span style={{ fontSize: '1rem', marginLeft: '15px' }}>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
        {/* Mood Analysis Card */}
        <div style={{
          background: 'rgba(40, 40, 56, 0.6)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #2a2a3e'
        }}>
          <h3 style={{ color: '#ffa07a', fontSize: '1.1rem', marginBottom: '15px', fontWeight: '600' }}>
            Mood Analysis
          </h3>
          <canvas ref={canvasRef} width={250} height={250} style={{
            display: 'block',
            margin: '15px auto',
            background: 'rgba(20, 20, 30, 0.5)',
            borderRadius: '8px',
            border: '1px solid #2a2a3e'
          }} />
          <div style={{ marginTop: '15px' }}>
            <p style={{ color: '#d0d0d0', fontSize: '0.9rem', marginBottom: '8px' }}>
              <strong style={{ color: '#ff6b9d' }}>Category:</strong> {explanation.mood_category}
            </p>
            <p style={{ color: '#b0b0b0', fontSize: '0.85rem', marginBottom: '8px', lineHeight: '1.5' }}>
              {explanation.mood_description}
            </p>
            <p style={{ color: '#d0d0d0', fontSize: '0.9rem', marginBottom: '5px' }}>
              <strong style={{ color: '#ff6b9d' }}>Valence:</strong> {(explanation.valence * 100).toFixed(0)}%
            </p>
            <p style={{ color: '#d0d0d0', fontSize: '0.9rem' }}>
              <strong style={{ color: '#ff6b9d' }}>Arousal:</strong> {(explanation.arousal * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Music Parameters Card */}
        <div style={{
          background: 'rgba(40, 40, 56, 0.6)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #2a2a3e'
        }}>
          <h3 style={{ color: '#ffa07a', fontSize: '1.1rem', marginBottom: '15px', fontWeight: '600' }}>
            Music Parameters
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              background: 'rgba(20, 20, 30, 0.5)',
              borderRadius: '8px',
              borderLeft: '3px solid #ff6b9d'
            }}>
              <strong style={{ color: '#ff6b9d', fontSize: '0.95rem' }}>Tempo:</strong>
              <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{explanation.tempo} BPM</span>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
                {explanation.tempo_explanation}
              </p>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(20, 20, 30, 0.5)',
              borderRadius: '8px',
              borderLeft: '3px solid #ff6b9d'
            }}>
              <strong style={{ color: '#ff6b9d', fontSize: '0.95rem' }}>Key:</strong>
              <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{explanation.key}</span>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
                {explanation.key_explanation}
              </p>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(20, 20, 30, 0.5)',
              borderRadius: '8px',
              borderLeft: '3px solid #ff6b9d'
            }}>
              <strong style={{ color: '#ff6b9d', fontSize: '0.95rem' }}>Creativity:</strong>
              <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{explanation.temperature.toFixed(2)}</span>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
                {explanation.temperature_explanation}
              </p>
            </div>
          </div>
        </div>

        {/* Instrument Choice Card */}
        {instrumentExplanation && (
          <div style={{
            background: 'rgba(40, 40, 56, 0.6)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #2a2a3e'
          }}>
            <h3 style={{ color: '#ffa07a', fontSize: '1.1rem', marginBottom: '15px', fontWeight: '600' }}>
              Instrument Choice
            </h3>
            <div style={{
              padding: '12px',
              background: 'rgba(20, 20, 30, 0.5)',
              borderRadius: '8px',
              borderLeft: '3px solid #ff6b9d',
              marginBottom: '12px'
            }}>
              <strong style={{ color: '#ff6b9d', fontSize: '0.95rem' }}>{instrumentExplanation.instrument}</strong>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
                {instrumentExplanation.characteristics}
              </p>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(20, 20, 30, 0.5)',
              borderRadius: '8px',
              borderLeft: '3px solid #ff6b9d'
            }}>
              <strong style={{ color: '#ff6b9d', fontSize: '0.95rem' }}>Dynamics: {instrumentExplanation.dynamics}</strong>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px', lineHeight: '1.4' }}>
                {instrumentExplanation.dynamics_explanation}
              </p>
            </div>
            <p style={{
              color: '#b0b0b0',
              fontSize: '0.85rem',
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255, 107, 157, 0.1)',
              borderRadius: '8px',
              lineHeight: '1.5'
            }}>
              {instrumentExplanation.fit_explanation}
            </p>
          </div>
        )}

        {/* Melodic Analysis Card */}
        {sequenceAnalysis && !sequenceAnalysis.error && (
          <div style={{
            background: 'rgba(40, 40, 56, 0.6)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #2a2a3e'
          }}>
            <h3 style={{ color: '#ffa07a', fontSize: '1.1rem', marginBottom: '15px', fontWeight: '600' }}>
              Melodic Analysis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#ff6b9d', fontSize: '0.9rem' }}>Note Count:</strong>
                <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{sequenceAnalysis.note_count}</span>
              </div>
              <div style={{
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#ff6b9d', fontSize: '0.9rem' }}>Range:</strong>
                <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{sequenceAnalysis.note_range} semitones</span>
              </div>
              <div style={{
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#ff6b9d', fontSize: '0.9rem' }}>Character:</strong>
                <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px' }}>
                  {sequenceAnalysis.melodic_character}
                </p>
              </div>
              <div style={{
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#ff6b9d', fontSize: '0.9rem' }}>Register:</strong>
                <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px' }}>
                  {sequenceAnalysis.register}
                </p>
              </div>
              <div style={{
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.5)',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#ff6b9d', fontSize: '0.9rem' }}>Contour:</strong>
                <span style={{ color: '#d0d0d0', marginLeft: '8px' }}>{sequenceAnalysis.melodic_contour}</span>
                <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginTop: '5px' }}>
                  ↑ {sequenceAnalysis.contour_stats?.ascending || 0} · 
                  ↓ {sequenceAnalysis.contour_stats?.descending || 0} · 
                  = {sequenceAnalysis.contour_stats?.repeated || 0}
                </p>
              </div>
            </div>
            <p style={{
              color: '#b0b0b0',
              fontSize: '0.85rem',
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255, 107, 157, 0.1)',
              borderRadius: '8px',
              lineHeight: '1.5'
            }}>
              {sequenceAnalysis.summary}
            </p>
          </div>
        )}

        {/* Summary Card */}
        <div style={{
          gridColumn: '1 / -1',
          background: 'linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(192, 108, 132, 0.1))',
          padding: '20px',
          borderRadius: '12px',
          border: '2px solid rgba(255, 107, 157, 0.3)'
        }}>
          <h3 style={{
            color: '#ff6b9d',
            fontSize: '1.1rem',
            marginBottom: '12px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            Overall Summary
          </h3>
          <p style={{
            color: '#d0d0d0',
            fontSize: '0.95rem',
            lineHeight: '1.8',
            textAlign: 'center'
          }}>
            {explanation.summary}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
