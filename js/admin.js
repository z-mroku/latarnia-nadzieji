// /js/admin.js – Pełny "żywy admin" 🔥
// Kompatybilny z main.js

import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ------------------- LOGOWANIE -------------------

const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const adminPanel = document.getElementById('admin-panel');

onAuthStateChanged(auth, user => {
  if (user) {
    adminPanel.style.display = 'block';
    loginForm.style.display = 'none';
  } else {
    adminPanel.style.display = 'none';
    loginForm.style.display = 'block';
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm['email'].value;
    const pass = loginForm['password'].value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      console.log("✅ Zalogowano");
    } catch (err) {
      alert("❌ Błąd logowania: " + err.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
  });
}

// ------------------- MENU -------------------

const menuList = document.getElementById('menu-list');
const menuForm = document.getElementById('menu-form');

function renderMenu() {
  const qMenu = query(collection(db, 'menu'), orderBy('order', 'asc'));
  onSnapshot(qMenu, snapshot => {
    menuList.innerHTML = '';
    snapshot.forEach(docSnap => {
      const m = docSnap.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <b>${m.text}</b> → ${m.url}
        <button data-id="${docSnap.id}" class="edit-menu">✏️</button>
        <button data-id="${docSnap.id}" class="del-menu">🗑️</button>
      `;
      menuList.appendChild(li);
    });

    // obsługa przycisków
    menuList.querySelectorAll('.del-menu').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'menu', btn.dataset.id));
      });
    });

    menuList.querySelectorAll('.edit-menu').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docRef = doc(db, 'menu', btn.dataset.id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          menuForm['text'].value = data.text;
          menuForm['url'].value = data.url;
          menuForm['order'].value = data.order;
          menuForm.dataset.editId = btn.dataset.id;
        }
      });
    });
  });
}
renderMenu();

menuForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = menuForm['text'].value;
  const url = menuForm['url'].value;
  const order = parseInt(menuForm['order'].value);
  const id = menuForm.dataset.editId;

  if (id) {
    await updateDoc(doc(db, 'menu', id), { text, url, order });
    delete menuForm.dataset.editId;
  } else {
    await addDoc(collection(db, 'menu'), { text, url, order });
  }
  menuForm.reset();
});

// ------------------- WPISY -------------------

const entryList = document.getElementById('entry-list');
const entryForm = document.getElementById('entry-form');

function renderEntries() {
  const q = query(collection(db, 'entries'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    entryList.innerHTML = '';
    snapshot.forEach(docSnap => {
      const e = docSnap.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <b>${e.title}</b> (${e.section})
        <button data-id="${docSnap.id}" class="edit-entry">✏️</button>
        <button data-id="${docSnap.id}" class="del-entry">🗑️</button>
      `;
      entryList.appendChild(li);
    });

    entryList.querySelectorAll('.del-entry').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'entries', btn.dataset.id));
      });
    });

    entryList.querySelectorAll('.edit-entry').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snap = await getDoc(doc(db, 'entries', btn.dataset.id));
        if (snap.exists()) {
          const data = snap.data();
          entryForm['title'].value = data.title;
          entryForm['content'].value = data.content;
          entryForm['section'].value = data.section;
          entryForm.dataset.editId = btn.dataset.id;
        }
      });
    });
  });
}
renderEntries();

entryForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = entryForm['title'].value;
  const content = entryForm['content'].value;
  const section = entryForm['section'].value;
  const id = entryForm.dataset.editId;

  if (id) {
    await updateDoc(doc(db, 'entries', id), { title, content, section });
    delete entryForm.dataset.editId;
  } else {
    await addDoc(collection(db, 'entries'), {
      title, content, section, createdAt: serverTimestamp()
    });
  }
  entryForm.reset();
});

// ------------------- SPARKS -------------------

const sparkList = document.getElementById('spark-list');
const sparkForm = document.getElementById('spark-form');

function renderSparks() {
  const q = query(collection(db, 'sparks'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    sparkList.innerHTML = '';
    snapshot.forEach(docSnap => {
      const s = docSnap.data();
      const li = document.createElement('li');
      li.innerHTML = `
        "${s.quote}"
        <button data-id="${docSnap.id}" class="del-spark">🗑️</button>
      `;
      sparkList.appendChild(li);
    });

    sparkList.querySelectorAll('.del-spark').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'sparks', btn.dataset.id));
      });
    });
  });
}
renderSparks();

sparkForm.addEventListener('submit', async e => {
  e.preventDefault();
  const quote = sparkForm['quote'].value;
  await addDoc(collection(db, 'sparks'), { quote, createdAt: serverTimestamp() });
  sparkForm.reset();
});

// ------------------- PLAYLIST -------------------

const playlistList = document.getElementById('playlist-list');
const playlistForm = document.getElementById('playlist-form');

function renderPlaylist() {
  const q = query(collection(db, 'playlist'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    playlistList.innerHTML = '';
    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      const li = document.createElement('li');
      li.innerHTML = `
        🎵 ${p.title} → ${p.url}
        <button data-id="${docSnap.id}" class="del-play">🗑️</button>
      `;
      playlistList.appendChild(li);
    });

    playlistList.querySelectorAll('.del-play').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'playlist', btn.dataset.id));
      });
    });
  });
}
renderPlaylist();

playlistForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = playlistForm['title'].value;
  const url = playlistForm['url'].value;
  await addDoc(collection(db, 'playlist'), { title, url, createdAt: serverTimestamp() });
  playlistForm.reset();
});

// ------------------- GALERIA -------------------

const galleryList = document.getElementById('gallery-list');
const galleryForm = document.getElementById('gallery-form');

function renderGallery() {
  const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    galleryList.innerHTML = '';
    snapshot.forEach(docSnap => {
      const g = docSnap.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${g.url}" width="120">
        <button data-id="${docSnap.id}" data-path="${g.path}" class="del-img">🗑️</button>
      `;
      galleryList.appendChild(li);
    });

    galleryList.querySelectorAll('.del-img').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'gallery', btn.dataset.id));
        await deleteObject(ref(storage, btn.dataset.path));
      });
    });
  });
}
renderGallery();

galleryForm.addEventListener('submit', async e => {
  e.preventDefault();
  const file = galleryForm['file'].files[0];
  if (!file) return;
  const path = `gallery/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, 'gallery'), { url, path, createdAt: serverTimestamp() });
  galleryForm.reset();
});
