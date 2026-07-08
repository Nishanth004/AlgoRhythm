// frontend/components/Chatbot.js
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import styles from '../styles/Chatbot.module.css';

const BACKEND_BASE_URL = 'http://localhost:5000';

export default function Chatbot({ isOpen, onClose, currentContext }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AlgoRhythm music assistant. Ask me anything about generating music, choosing models, or understanding your results!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/api/chatbot`, {
        message: input,
        history: messages.slice(-10),
        context: currentContext
      });

      const assistantMessage = { role: 'assistant', content: response.data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure the GROQ_API_KEY is configured.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const speakMessage = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const getSuggestions = async () => {
    try {
      const response = await axios.get(`${BACKEND_BASE_URL}/api/chatbot/suggestions?genre=general`);
      const suggestions = response.data.suggestions;
      const suggestionText = 'Here are some prompt ideas: ' + suggestions.join(', ');
      setMessages(prev => [...prev, { role: 'assistant', content: suggestionText }]);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.chatbotOverlay}>
      <div className={styles.chatbotContainer}>
        <div className={styles.chatbotHeader}>
          <div className={styles.chatbotAvatar} style={{
            animation: isSpeaking ? 'pulse 1s infinite' : 'none'
          }}>
            <span style={{ fontSize: '1.8rem' }}>🎵</span>
          </div>
          <h3 style={{ flex: 1 }}>AlgoRhythm Assistant</h3>
          {currentContext?.hasGeneration && (
            <span style={{
              fontSize: '0.75rem',
              color: '#52b788',
              marginRight: '10px',
              background: 'rgba(20, 50, 35, 0.6)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(82, 183, 136, 0.5)'
            }}>
              🎼 Context Aware
            </span>
          )}
          {isSpeaking && (
            <span style={{
              fontSize: '0.8rem',
              color: '#ff6b9d',
              marginRight: '10px',
              animation: 'pulse 1s infinite'
            }}>🔊 Speaking...</span>
          )}
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.messagesContainer}>
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
              <div className={styles.messageContent}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'assistant' && (
                <button 
                  className={styles.speakButton}
                  onClick={() => isSpeaking ? stopSpeaking() : speakMessage(msg.content)}
                  title={isSpeaking ? 'Stop speaking' : 'Speak message'}
                >
                  {isSpeaking ? '🔇' : '🔊'}
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className={styles.assistantMessage}>
              <div className={styles.messageContent}>
                <span className={styles.typingIndicator}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.quickActions}>
          {currentContext?.hasGeneration ? (
            <>
              <button onClick={() => setInput('How can I make it happier?')} className={styles.quickActionBtn}>
                Make Happier
              </button>
              <button onClick={() => setInput('How can I make it more energetic?')} className={styles.quickActionBtn}>
                More Energetic
              </button>
              <button onClick={() => setInput('How can I make it calmer?')} className={styles.quickActionBtn}>
                Make Calmer
              </button>
            </>
          ) : (
            <>
              <button onClick={getSuggestions} className={styles.quickActionBtn}>
                Get Prompt Ideas
              </button>
              <button onClick={() => setInput('How do I choose the right instrument?')} className={styles.quickActionBtn}>
                Instrument Guide
              </button>
              <button onClick={() => setInput('Explain mood analysis')} className={styles.quickActionBtn}>
                Mood Analysis
              </button>
            </>
          )}
        </div>

        <div className={styles.inputContainer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about music generation..."
            className={styles.chatInput}
            rows={2}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className={styles.sendButton}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
