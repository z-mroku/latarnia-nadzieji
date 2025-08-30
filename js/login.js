// Importy Firebase
import { auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Elementy z DOM
const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginEmail = document.getElementById('email');
const loginPassword = document.getElementById('password');
const loginError = document.getElementById('loginError');

// Sprawdzanie czy użytkownik jest już zalogowany
onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = 'admin.html';
  }
});

// Logowanie email + hasło
loginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (!email || !password) {
    loginError.textContent = 'Wpisz e-mail i hasło.';
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      // Przekierowanie po sukcesie
      window.location.href = 'admin.html';
    })
    .catch(err => {
      console.error(err);
      loginError.textContent = 'Błędny e-mail lub hasło.';
    });
});

// Logowanie przez Google
googleLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then(() => {
      window.location.href = 'admin.html';
    })
    .catch(err => {
      console.error(err);
      loginError.textContent = 'Błąd logowania przez Google.';
    });
});
