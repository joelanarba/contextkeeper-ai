"use client";

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';

export default function CapturePage() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitCapture = async (type: string, payload: any) => {
    setIsSubmitting(true);
    setStatus('idle');
    try {
      await apiFetch('/captures', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setText('');
      setStatus('success');
      setStatusMessage('Capture saved successfully!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage('Failed to save capture.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await submitCapture('TEXT', { type: 'TEXT', text });
  };

  const handleFileUpload = async (file: File) => {
    setIsSubmitting(true);
    setStatus('idle');
    setStatusMessage(`Uploading ${file.name}...`);
    try {
      // 1. Get presigned URL
      const presignRes = await apiFetch(`/captures/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);
      
      if (!presignRes.url || !presignRes.s3Key) {
        throw new Error('Invalid presign response');
      }

      // 2. Upload to S3
      const uploadRes = await fetch(presignRes.url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 upload failed: ${uploadRes.statusText}`);
      }

      // 3. Register Capture
      const captureType = file.type.startsWith('image/') ? 'IMAGE' : (file.type === 'application/pdf' ? 'PDF' : 'AUDIO');
      await submitCapture(captureType, { type: captureType, s3Key: presignRes.s3Key });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage('Failed to upload file.');
      setIsSubmitting(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileUpload(e.target.files[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Capture Context</h1>
        <p style={styles.subtitle}>Dump raw text, meeting notes, or drag and drop images/PDFs below.</p>
      </header>

      <div 
        className="glass-panel" 
        style={{...styles.panel, ...(isDragging ? styles.panelDragging : {})}}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <form onSubmit={handleTextSubmit} style={styles.form}>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind? Or drag and drop a screenshot/PDF here..."
            style={styles.textarea}
            disabled={isSubmitting}
          />

          <div style={styles.footer}>
            <div style={styles.statusArea}>
              {status === 'success' && <span style={styles.successText}>{statusMessage}</span>}
              {status === 'error' && <span style={styles.errorText}>{statusMessage}</span>}
              {isSubmitting && status === 'idle' && <span style={styles.loadingText}>{statusMessage || 'Saving...'}</span>}
            </div>
            <div style={styles.actions}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={onFileChange}
                accept="image/*,application/pdf"
              />
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                style={{ marginRight: '12px' }}
              >
                Upload File
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting || !text.trim()}
              >
                Capture Text
              </button>
            </div>
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
    transition: 'all 0.2s ease',
  },
  panelDragging: {
    border: '2px dashed var(--accent-primary)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  actions: {
    display: 'flex',
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
  },
  loadingText: {
    color: 'var(--text-secondary)',
  }
};
