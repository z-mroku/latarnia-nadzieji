// js/firebase-config.js (WERSJA 10 - POPRAWIONA)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Konfiguracja dla WŁAŚCIWEGO projektu "projekt-latarnia"
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app", // ✅ POPRAWIONY ADRES
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
  measurementId: "G-LNYWJD2YV7"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);

// Eksportowanie usług dla reszty aplikacji.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

