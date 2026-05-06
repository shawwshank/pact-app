import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

export const FIREBASE_API_KEY = "AIzaSyDFzHcJl9CwC0Ze_A4EZLdWqdHTMUbi594";

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "pact-app-b0d9e.firebaseapp.com",
  projectId: "pact-app-b0d9e",
  storageBucket: "pact-app-b0d9e.firebasestorage.app",
  messagingSenderId: "270099033756",
  appId: "1:270099033756:web:aaa688d1ba66466d580759",
};

let _db: Firestore | null = null;

export function db(): Firestore {
  if (!_db) {
    const app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
  }
  return _db;
}
