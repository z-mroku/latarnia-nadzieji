// Plik: /js/firebase-config.js
// Wersja testowa – klucze wpisane na sztywno, działa lokalnie i na Vercel

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Konfiguracja Firebase (klucze na sztywno)
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.appspot.com",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
  measurementId: "G-LNYWJD2YV7"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);

// Eksport usług dla reszty aplikacji
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
