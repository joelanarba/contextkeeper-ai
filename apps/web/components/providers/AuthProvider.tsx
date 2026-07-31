"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

interface AuthContextType {
  token: string | null;
  userId: string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  userId: null,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Ensure Amplify is configured exactly as in the original layout.tsx
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    },
  },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Keep local storage sync for backward compatibility if needed, though AWS Amplify handles its own session.
    const saved = localStorage.getItem('ck_token');
    const savedUserId = localStorage.getItem('ck_userId');
    if (saved && savedUserId) {
      setToken(saved);
      setUserId(savedUserId);
    }
  }, []);

  return (
    <Authenticator>
      {({ signOut, user }) => {
        // user.userId is available in newer Amplify UI
        const currentUserId = user?.userId || userId;
        return (
          <AuthContext.Provider value={{ token, userId: currentUserId, signOut: signOut as () => void }}>
            {children}
          </AuthContext.Provider>
        );
      }}
    </Authenticator>
  );
}
