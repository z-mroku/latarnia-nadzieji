// /js/admin.js - POPRAWIONY PEŁNY ADMIN vFINAL
// Zostawione wszystkie funkcje z Twojego pliku, poprawione błędy i importy

import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, getDocs,
  where, limit, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject, listAll
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// -------------------- AUTH -------------------- //
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const adminPanel = document.getElementById('admin-panel');
const galleryForm = document.getElementById('gallery-form');
const galleryList = document.getElementById('gallery-list');

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Zalogowano jako:", user.email);
    if (loginForm) loginForm.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";
  } else {
    console.log("Brak zalogowanego użytkownika");
    if (loginForm) loginForm.style.display = "block";
    if (adminPanel) adminPanel.style.display = "none";
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Zalogowano");
    } catch (err) {
      console.error("❌ Błąd logowania:", err.message);
      alert("Błąd logowania: " + err.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      console.log("👋 Wylogowano");
    } catch (err) {
      console.error("❌ Błąd wylogowania:", err.message);
    }
  });
}

// -------------------- GALERIA - UPLOAD -------------------- //
if (galleryForm) {
  galleryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('gallery-file');
    const file = fileInput.files[0];
    if (!file) return alert("❌ Wybierz plik!");

    const storageRef = ref(storage, 'gallery/' + Date.now() + "_" + file.name);

    try {
      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);

      await addDoc(collection(db, 'gallery'), {
        url,
        name: file.name,
        createdAt: serverTimestamp()
      });

      console.log("✅ Zdjęcie dodane:", url);
      fileInput.value = "";
    } catch (err) {
      console.error("❌ Błąd uploadu:", err.message);
      alert("Błąd uploadu: " + err.message);
    }
  });
}
// -------------------- GALERIA - LISTA -------------------- //
async function loadGallery() {
  try {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (galleryList) {
      galleryList.innerHTML = "";
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const li = document.createElement('li');
        li.innerHTML = `
          <img src="${data.url}" alt="${data.name}" width="120">
          <p>${data.name}</p>
          <button data-id="${docSnap.id}" class="delete-btn">❌ Usuń</button>
        `;
        galleryList.appendChild(li);
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await deleteImage(id);
        });
      });
    }
  } catch (err) {
    console.error("❌ Błąd ładowania galerii:", err.message);
  }
}

async function deleteImage(id) {
  try {
    const docRef = doc(db, 'gallery', id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.url) {
        const storageRef = ref(storage, data.url);
        try {
          await deleteObject(storageRef);
        } catch (err) {
          console.warn("⚠️ Nie udało się usunąć pliku ze storage:", err.message);
        }
      }
      await deleteDoc(docRef);
      console.log("✅ Usunięto zdjęcie:", id);
      loadGallery();
    }
  } catch (err) {
    console.error("❌ Błąd usuwania zdjęcia:", err.message);
  }
}

// Automatyczne odświeżanie galerii na żywo
if (galleryList) {
  onSnapshot(collection(db, 'gallery'), () => {
    loadGallery();
  });
}
// -------------------- DODATKOWE LOGI I OBSŁUGA -------------------- //
window.addEventListener('error', function (event) {
  console.error("❌ Globalny błąd:", event.message, "w", event.filename, "linia", event.lineno);
});

window.addEventListener('unhandledrejection', function (event) {
  console.error("❌ Nieobsłużona obietnica:", event.reason);
});

// -------------------- INICJALIZACJA -------------------- //
document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ Admin.js załadowany");

  // Jeżeli użytkownik zalogowany → załaduj galerie
  if (auth && galleryList) {
    onAuthStateChanged(auth, user => {
      if (user) {
        console.log("👤 Zalogowany:", user.email);
        loadGallery();
      } else {
        console.warn("⚠️ Brak użytkownika – zaloguj się aby korzystać z panelu admina");
      }
    });
  }
});
