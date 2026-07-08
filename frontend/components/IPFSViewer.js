// frontend/components/IPFSViewer.js
import { useState } from 'react';

export default function IPFSViewer({ ipfsHash, metadataHash, seedHash }) {
  const [showViewer, setShowViewer] = useState(false);
  const [metadataContent, setMetadataContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

  const fetchMetadata = async () => {
    if (!metadataHash) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${IPFS_GATEWAY}${metadataHash}`);
      const data = await response.json();
      setMetadataContent(data);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (!ipfsHash) return null;

  return (
    <div style={{ 
      marginTop: '20px', 
      padding: '20px', 
      background: 'rgba(30, 30, 46, 0.6)', 
      borderRadius: '12px',
      border: '1px solid #2a2a3e'
    }}>
      <h3 style={{ 
        color: '#ff6b9d', 
        marginBottom: '15px',
        fontSize: '1.1rem',
        fontWeight: '600'
      }}>
        IPFS Storage
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <strong style={{ color: '#d0d0d0', fontSize: '0.9rem' }}>MIDI CID:</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
          <code style={{ 
            background: 'rgba(20, 20, 30, 0.5)', 
            padding: '10px 12px', 
            borderRadius: '8px', 
            color: '#ffa07a',
            fontSize: '13px',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'Courier New, monospace',
            border: '1px solid #2a2a3e'
          }}>
            {ipfsHash}
          </code>
          <button 
            onClick={() => copyToClipboard(ipfsHash)}
            style={{
              padding: '10px 18px',
              background: 'rgba(192, 108, 132, 0.6)',
              border: '1px solid rgba(192, 108, 132, 0.8)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(192, 108, 132, 0.8)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(192, 108, 132, 0.6)'}
          >
            Copy
          </button>
          <a 
            href={`${IPFS_GATEWAY}${ipfsHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 18px',
              background: 'rgba(255, 107, 157, 0.6)',
              border: '1px solid rgba(255, 107, 157, 0.8)',
              borderRadius: '8px',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 107, 157, 0.8)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 107, 157, 0.6)'}
          >
            View
          </a>
        </div>
      </div>

      {metadataHash && (
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#d0d0d0', fontSize: '0.9rem' }}>Metadata CID:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <code style={{ 
              background: 'rgba(20, 20, 30, 0.5)', 
              padding: '10px 12px', 
              borderRadius: '8px', 
              color: '#ffa07a',
              fontSize: '13px',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'Courier New, monospace',
              border: '1px solid #2a2a3e'
            }}>
              {metadataHash}
            </code>
            <button 
              onClick={() => copyToClipboard(metadataHash)}
              style={{
                padding: '10px 18px',
                background: 'rgba(192, 108, 132, 0.6)',
                border: '1px solid rgba(192, 108, 132, 0.8)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(192, 108, 132, 0.8)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(192, 108, 132, 0.6)'}
            >
              Copy
            </button>
            <button 
              onClick={() => {
                setShowViewer(!showViewer);
                if (!showViewer && !metadataContent) fetchMetadata();
              }}
              style={{
                padding: '10px 18px',
                background: 'rgba(255, 107, 157, 0.6)',
                border: '1px solid rgba(255, 107, 157, 0.8)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 107, 157, 0.8)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 107, 157, 0.6)'}
            >
              {showViewer ? 'Hide' : 'View'}
            </button>
          </div>
        </div>
      )}

      {showViewer && metadataContent && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          background: 'rgba(20, 20, 30, 0.5)', 
          borderRadius: '8px',
          maxHeight: '300px',
          overflow: 'auto',
          border: '1px solid #2a2a3e'
        }}>
          <h4 style={{ color: '#ff6b9d', marginBottom: '10px', fontSize: '1rem' }}>Metadata Preview</h4>
          <pre style={{ 
            color: '#d0d0d0', 
            fontSize: '12px', 
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            fontFamily: 'Courier New, monospace'
          }}>
            {JSON.stringify(metadataContent, null, 2)}
          </pre>
        </div>
      )}

      {showViewer && loading && (
        <div style={{ textAlign: 'center', color: '#d0d0d0', marginTop: '15px' }}>
          Loading metadata...
        </div>
      )}

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#a0a0a0' }}>
        <strong>Seed Hash:</strong> {seedHash}
      </div>
    </div>
  );
}
