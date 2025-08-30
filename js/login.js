import { auth } from '../firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = 'admin.html';
  }
});

loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value)
    .catch(() => { loginError.textContent = 'Błędny e-mail lub hasło.'; });
});

googleLoginBtn.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .catch(() => { loginError.textContent = 'Błąd logowania przez Google.'; });
});
