// Plik: /js/login.js (WERSJA OSTATECZNA, ZSYNCHRONIZOWANA)

// --- Konfiguracja i Inicjalizacja Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Główna Logika Strony Logowania ---
document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const loginError = document.getElementById('loginError');

    // Sprawdzamy, czy użytkownik jest już zalogowany. Jeśli tak, od razu go przenosimy.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = 'admin.html';
        }
    });

    const displayError = (message) => {
        if (loginError) loginError.textContent = message;
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            loginBtn.disabled = true;
            googleLoginBtn.disabled = true;
            loginBtn.textContent = 'Logowanie...';
        } else {
            loginBtn.disabled = false;
            googleLoginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Zaloguj się';
        }
    };

    // Logowanie za pomocą e-maila i hasła (zmodernizowana logika async/await)
    const handleLogin = async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return displayError('Proszę wypełnić oba pola.');
        
        displayError('');
        setLoadingState(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Sukces - `onAuthStateChanged` zajmie się przekierowaniem
        } catch (error) {
            console.error("Błąd logowania:", error.code);
            if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
                displayError('Nieprawidłowy e-mail lub hasło.');
            } else {
                displayError('Wystąpił nieoczekiwany błąd.');
            }
            setLoadingState(false);
        }
    };

    // Logowanie za pomocą Google (zmodernizowana logika async/await)
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        displayError('');
        setLoadingState(true);
        googleLoginBtn.textContent = 'Otwieram okno Google...';

        try {
            await signInWithPopup(auth, provider);
            // Sukces - `onAuthStateChanged` zajmie się przekierowaniem
        } catch (error) {
            console.error("Błąd logowania Google:", error.code);
            if (error.code !== 'auth/popup-closed-by-user') {
                displayError('Wystąpił błąd logowania przez Google.');
            }
            setLoadingState(false);
            googleLoginBtn.innerHTML = '<i class="fa-brands fa-google"></i> Zaloguj przez Google';
        }
    };

    // Podpięcie eventów
    loginBtn?.addEventListener('click', handleLogin);
    passwordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    googleLoginBtn?.addEventListener('click', handleGoogleLogin);
});
