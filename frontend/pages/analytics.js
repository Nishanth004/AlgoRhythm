// frontend/pages/analytics.js
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";
import styles from '../styles/Analytics.module.css';

const BACKEND_BASE_URL = 'http://localhost:5000';

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const particlesInit = useCallback(async (main) => {
    await loadFull(main);
  }, []);

  const particlesOptions = {
    background: { color: "#1a1a1a" },
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
      color: { value: "#ff4757" },
      links: {
        color: "#ff6b81",
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

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [summaryRes, historyRes] = await Promise.all([
        axios.get(`${BACKEND_BASE_URL}/api/analytics/summary`),
        axios.get(`${BACKEND_BASE_URL}/api/analytics/history?limit=50`)
      ]);

      setSummary(summaryRes.data);
      setHistory(historyRes.data.history || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Unable to connect to backend. Please ensure the backend server is running.');
      // Set empty defaults
      setSummary({
        total_seeds: 0,
        average_rating: 0,
        most_used_model: null,
        most_used_instrument: null
      });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Particles id="tsparticles" init={particlesInit} options={particlesOptions} />
        <div style={{ textAlign: 'center', paddingTop: '100px', color: '#e8e8e8', position: 'relative', zIndex: 1 }}>
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Particles id="tsparticles" init={particlesInit} options={particlesOptions} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className={styles.header}>
          <h1 className={styles.title}>Seed History & Analytics</h1>
          <Link href="/" className={styles.backLink}>
            Back to Generator
          </Link>
        </div>

        {error && (
          <div style={{
            padding: '20px',
            background: 'rgba(255, 69, 87, 0.2)',
            border: '1px solid rgba(255, 69, 87, 0.5)',
            borderRadius: '10px',
            marginBottom: '30px',
            textAlign: 'center',
            color: '#ff4757',
            maxWidth: '600px',
            margin: '0 auto 30px'
          }}>
            {error}
          </div>
        )}

        {summary && (
          <div className={styles.summaryGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.total_seeds || 0}</div>
              <div className={styles.statLabel}>Total Seeds</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statValue}>{summary.average_rating?.toFixed(1) || '0.0'}</div>
              <div className={styles.statLabel}>Average Rating</div>
            </div>          {summary.most_used_model && (
            <div className={styles.statCard}>
              <div className={styles.statValue} style={{ fontSize: '1.5rem' }}>
                {summary.most_used_model[0]}
              </div>
              <div className={styles.statLabel}>Most Used Model</div>
            </div>
          )}

          {summary.most_used_instrument && (
            <div className={styles.statCard}>
              <div className={styles.statValue} style={{ fontSize: '1.5rem' }}>
                {summary.most_used_instrument[0]}
              </div>
              <div className={styles.statLabel}>Favorite Instrument</div>
            </div>
          )}
        </div>
      )}

      <div className={styles.historySection}>
        <h2>Generation History</h2>

        {history.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No seeds generated yet.</p>
            <p>Start creating music to see your history here!</p>
          </div>
        ) : (
          <div className={styles.historyGrid}>
            {history.map((item, idx) => (
              <div key={idx} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <span className={styles.seedHash}>{item.seed_hash}</span>
                  <span className={styles.timestamp}>
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <p className={styles.prompt}>{item.prompt || 'No prompt provided'}</p>

                <div className={styles.details}>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Model</span>
                    <span className={styles.detailValue}>{item.model_used}</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Instrument</span>
                    <span className={styles.detailValue}>{item.instrument}</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Dynamics</span>
                    <span className={styles.detailValue}>{item.dynamics}</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Tempo</span>
                    <span className={styles.detailValue}>{item.tempo} BPM</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Key</span>
                    <span className={styles.detailValue}>{item.key_signature}</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.detailLabel}>Plays</span>
                    <span className={styles.detailValue}>{item.play_count}</span>
                  </div>
                </div>

                {item.rating_count > 0 && (
                  <div className={styles.rating}>
                    <span className={styles.stars}>
                      {renderStars(item.average_rating)}
                    </span>
                    <span className={styles.ratingCount}>
                      ({item.rating_count} rating{item.rating_count !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}

                {item.ipfs_hash && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${item.ipfs_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ipfsLink}
                  >
                    View on IPFS
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
