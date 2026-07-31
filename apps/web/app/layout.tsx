"use client";

import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// We will configure Amplify once the stack is deployed and we have the outputs
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>ContextKeeper</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Authenticator hideSignUp={true}>
          {({ signOut }) => (
            <div style={layoutStyles.container}>
              <nav style={layoutStyles.sidebar} className="glass-panel">
                <div style={layoutStyles.logo}>ContextKeeper</div>
                
                <div style={layoutStyles.navLinks}>
                  <NavLink href="/">Capture</NavLink>
                  <NavLink href="/inbox">Inbox</NavLink>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <button onClick={signOut} style={layoutStyles.signOutBtn}>
                    Sign Out
                  </button>
                </div>
              </nav>
              
              <main style={layoutStyles.mainContent}>
                {children}
              </main>
            </div>
          )}
        </Authenticator>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Link href={href} style={{
      ...layoutStyles.navItem,
      background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
    }}>
      {children}
    </Link>
  );
}

const layoutStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '260px',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    margin: '16px',
    borderRadius: '16px',
    position: 'sticky',
    top: '16px',
    height: 'calc(100vh - 32px)',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    padding: '0 24px',
    marginBottom: '32px',
    letterSpacing: '-0.02em',
  },
  navLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    padding: '10px 24px',
    fontSize: '0.95rem',
    fontWeight: 500,
    display: 'block',
    transition: 'all 0.2s ease',
  },
  signOutBtn: {
    width: '100%',
    padding: '12px 24px',
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    transition: 'color 0.2s ease',
  },
  mainContent: {
    flex: 1,
    padding: '40px',
    maxWidth: '1000px',
  },
};
