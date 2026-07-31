"use client";

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
type ItemType = 'TASK' | 'IDEA' | 'NOTE' | 'FOLLOW_UP' | 'PROJECT';

interface Item {
  id: string;
  type: ItemType;
  title: string;
  person?: string;
  dueDate?: string;
  project?: string;
  priority: Priority;
  status: 'OPEN' | 'COMPLETE';
}

export default function InboxPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadItems() {
      try {
        const data = await apiFetch('/items');
        setItems(data.items || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load items');
      } finally {
        setIsLoading(false);
      }
    }
    loadItems();
  }, []);

  const groupedItems = {
    tasks: items.filter(i => i.type === 'TASK'),
    followUps: items.filter(i => i.type === 'FOLLOW_UP'),
    ideas: items.filter(i => i.type === 'IDEA' || i.type === 'NOTE'),
  };

  if (isLoading) return <div style={styles.container}>Loading your obligations...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Inbox</h1>
        <p style={styles.subtitle}>Structured extractions from your captures.</p>
      </header>

      <div style={styles.content}>
        <Section title="Tasks" items={groupedItems.tasks} />
        <Section title="Follow Ups" items={groupedItems.followUps} />
        <Section title="Ideas & Notes" items={groupedItems.ideas} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.grid}>
        {items.map(item => <ItemCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="glass-panel" style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.badges}>
          <span className={`badge badge-${item.priority.toLowerCase()}`}>{item.priority}</span>
          {item.project && <span className="badge" style={styles.badgeProject}>{item.project}</span>}
        </div>
      </div>
      <h3 style={styles.cardTitle}>{item.title}</h3>
      <div style={styles.cardMeta}>
        {item.person && <span>Person: {item.person}</span>}
        {item.dueDate && <span style={{ color: 'var(--accent-color)' }}>Due: {item.dueDate}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '40px',
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  section: {},
  sectionTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--surface-border)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    display: 'flex',
    gap: '8px',
  },
  badgeProject: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--text-secondary)',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  cardMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: 'auto',
    paddingTop: '8px',
  }
};
