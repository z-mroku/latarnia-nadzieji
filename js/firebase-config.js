// Plik: /js/firebase-config.js (WERSJA OSTATECZNA, BEZPIECZNA)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Konfiguracja Firebase wczytywana ze zmiennych środowiskowych Vercel
// UWAGA: Ta wersja będzie działać poprawnie TYLKO po wdrożeniu na Vercel,
// gdzie zdefiniujemy zmienne VITE_FIREBASE_...
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);

// Eksportowanie usług dla reszty aplikacji.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
