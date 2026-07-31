"use client";

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

export default function RecallPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsSubmitting(true);
    setError('');
    setAnswer('');

    try {
      const data = await apiFetch('/recall', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      setAnswer(data.answer);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to ask ContextKeeper');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Recall</h1>
        <p style={styles.subtitle}>Ask a question about anything you have captured.</p>
      </header>

      <div className="glass-panel" style={styles.panel}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What do I owe Dr. Gyamfua?"
            style={styles.input}
            disabled={isSubmitting}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting || !question.trim()}
          >
            {isSubmitting ? 'Searching...' : 'Ask ContextKeeper'}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ ...styles.panel, marginTop: '24px', color: 'var(--danger-color)' }}>
          {error}
        </div>
      )}

      {answer && (
        <div className="glass-panel" style={{ ...styles.panel, marginTop: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--accent-primary)' }}>Answer</h2>
          <div style={styles.answerText}>
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '48px 24px',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 600,
    marginBottom: '8px',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
  },
  panel: {
    padding: '24px',
  },
  form: {
    display: 'flex',
    gap: '12px',
  },
  input: {
    flex: 1,
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  answerText: {
    lineHeight: '1.6',
    color: 'var(--text-primary)',
    fontSize: '1.05rem',
  }
};
