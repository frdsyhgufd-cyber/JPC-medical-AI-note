
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQxmjD05eh0wTJ6PQIKoqzXPgtK0VcLOg",
  authDomain: "medical-note-system.firebaseapp.com",
  projectId: "medical-note-system",
  storageBucket: "medical-note-system.firebasestorage.app",
  messagingSenderId: "510234753468",
  appId: "1:510234753468:web:805f1b08557f9cf05dd3b9",
  measurementId: "G-CDSYRE2EHE"
};

const app = initializeApp(firebaseConfig);

// Use initializeFirestore to enable experimentalForceLongPolling,
// which helps with "code=unavailable" errors in certain network environments.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
