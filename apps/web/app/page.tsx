"use client";

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function CapturePage() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    setStatus('idle');

    try {
      await apiFetch('/captures', {
        method: 'POST',
        body: JSON.stringify({ type: 'TEXT', text }),
      });
      setText('');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Capture Context</h1>
        <p style={styles.subtitle}>Dump raw text, meetings notes, or obligations below.</p>
      </header>

      <div className="glass-panel" style={styles.panel}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I need to send the Q3 report to Sarah by Friday..."
            style={styles.textarea}
            disabled={isSubmitting}
          />
          
          <div style={styles.footer}>
            <div style={styles.statusArea}>
              {status === 'success' && <span style={styles.successText}>Captured successfully. Processing in background.</span>}
              {status === 'error' && <span style={styles.errorText}>Failed to capture. Please try again.</span>}
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || !text.trim()}
              style={{ opacity: isSubmitting || !text.trim() ? 0.6 : 1 }}
            >
              {isSubmitting ? 'Capturing...' : 'Capture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    marginBottom: '8px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
  },
  panel: {
    padding: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  textarea: {
    width: '100%',
    minHeight: '200px',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusArea: {
    fontSize: '0.9rem',
  },
  successText: {
    color: 'var(--success-color)',
  },
  errorText: {
    color: 'var(--danger-color)',
  }
};
