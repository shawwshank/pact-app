import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_API_KEY } from './firebase';

type User = { uid: string; email: string; displayName: string; idToken: string; refreshToken: string };
type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  signIn: async () => {}, signUp: async () => {}, signOut: async () => {},
});

const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('pact_user').then((stored) => {
      if (stored) setUser(JSON.parse(stored));
      setLoading(false);
    });
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    const res = await fetch(`${AUTH_URL}:signUp?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const u: User = { uid: data.localId, email: data.email, displayName, idToken: data.idToken, refreshToken: data.refreshToken };
    setUser(u);
    await AsyncStorage.setItem('pact_user', JSON.stringify(u));
    // Store display name in Firestore
    const { setDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    await setDoc(doc(db(), 'users', data.localId), { displayName, email: data.email, createdAt: new Date() });
  }

  async function signIn(email: string, password: string) {
    const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const u: User = { uid: data.localId, email: data.email, displayName: data.displayName || data.email.split('@')[0], idToken: data.idToken, refreshToken: data.refreshToken };
    setUser(u);
    await AsyncStorage.setItem('pact_user', JSON.stringify(u));
  }

  async function signOut() {
    setUser(null);
    await AsyncStorage.removeItem('pact_user');
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
