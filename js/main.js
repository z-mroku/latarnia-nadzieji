// Plik: /js/main.js
// WERSJA PEŁNA - NAPRAWIONA ODPORNOŚĆ NA BŁĘDY MODUŁÓW

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, getDocs, query, orderBy, limit, doc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.app",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
  measurementId: "G-LNYWJD2YV7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ZMIENNE GLOBALNE ---
let sparksFromDB = [];
let player = null;
let playlist = [];
let currentIndex = 0;

// --- FUNKCJE POMOCNICZE ---
function escapeHtml(s = '') { 
  return String(s).replace(/[&<>"']/g, c => ({ 
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
  }[c])); 
}

function stripHtml(s = '') { 
  return String(s).replace(/<[^>]*>?/gm, ''); 
}

function getVideoId(url) { 
  if (!url) return null; 
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); 
  return m ? m[1] : null; 
}

// ==================== 1. MENU ====================
async function fetchAndRenderMenu(container) {
  try {
    const snap = await getDocs(query(collection(db, "menu"), orderBy("order", "asc")));
    
    if (snap.empty) {
        container.innerHTML = '<li><a class="index-nav-button">Brak elementów menu</a></li>';
        return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const data = doc.data();
      let finalUrl = escapeHtml(data.url);
      
      // Obsługa przekierowań do Sekcja.html z parametrem
      if (finalUrl.toLowerCase().includes('sekcja.html')) {
        finalUrl = `/Sekcja.html?nazwa=${encodeURIComponent(data.text)}`;
      }
      
      return `<li><a href="${finalUrl}" class="index-nav-button">${escapeHtml(data.text)}</a></li>`;
    }).join('');
  } catch (e) {
    console.error("Błąd wczytywania menu (próba awaryjna):", e);
    // Fallback: pobierz bez sortowania, jeśli index nie istnieje
    try {
        const snap = await getDocs(collection(db, "menu"));
        container.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            return `<li><a href="${escapeHtml(data.url)}" class="index-nav-button">${escapeHtml(data.text)}</a></li>`;
        }).join('');
    } catch(errCritical) {
        container.innerHTML = '<li><a class="index-nav-button" style="color:red">Błąd połączenia</a></li>';
    }
  }
}

// ==================== 2. LATARNIA NADZIEI (OSTATNIE WPISY) ====================
async function fetchLatarniaNadziei(container) {
  try {
    const sectionsToExclude = ['Piciorys Chudego', 'Z punktu widzenia księżniczki', 'Pomoc', 'Galeria', 'Wsparcie'];
    
    // 1. Pobierz listę sekcji z Menu
    const menuSnap = await getDocs(collection(db, "menu"));
    const sectionsToQuery = menuSnap.docs
      .map(doc => doc.data().text)
      .filter(name => !sectionsToExclude.includes(name));

    // 2. Pobierz najnowsze wpisy z każdej sekcji (równolegle)
    const queries = sectionsToQuery.map(sectionName => 
      getDocs(query(collection(db, 'sekcje', sectionName, 'entries'), orderBy("createdAt", "desc"), limit(2)))
    );
    
    const results = await Promise.allSettled(queries);

    let allEntries = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        result.value.forEach(doc => {
          allEntries.push({ id: doc.id, section: sectionsToQuery[index], ...doc.data() });
        });
      }
    });

    // 3. Posortuj wszystko razem po dacie
    allEntries.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    if (!allEntries.length) {
      container.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>";
      return;
    }

    // 4. Wyświetl (limit 4 na głównej)
    container.innerHTML = allEntries.slice(0, 4).map(e => {
      const title = escapeHtml(e.title || 'Bez tytułu');
      const author = escapeHtml(e.author || 'Chudy');
      const date = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString('pl-PL') : 'Brak daty';
      const fullContent = e.text || '';
      const excerpt = fullContent ? stripHtml(fullContent).substring(0, 200) + '...' : '';

      return `
        <article class="story-item" data-section="${e.section}" data-id="${e.id}"
          style="background: rgba(15,20,30,0.7); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);">
          <h3 class="fancy-title entry-title" style="font-size: 1.5rem; margin-bottom: 10px;">
            <a href="/Sekcja.html?nazwa=${encodeURIComponent(e.section)}" class="entry-link" style="text-decoration:none; color:inherit;">${title}</a>
          </h3>
          <div class="entry-meta">
            <span><i class="fas fa-folder"></i> ${e.section}</span>
            <span><i class="fas fa-calendar-alt"></i> ${date}</span>
            <span><i class="fas fa-heart"></i> <span class="like-count">${e.likes || 0}</span></span>
            <span><i class="fas fa-eye"></i> <span class="view-count">${e.views || 0}</span></span>
          </div>
          <div class="entry-content">
            <p>${excerpt}</p>
            <div class="full-content" style="display: none;">${fullContent}</div>
          </div>
          <button class="action-button read-more-btn">Czytaj dalej</button>
          <button class="action-button like-btn">❤️ Polub</button>
        </article>`;
    }).join('');

    // Obsługa przycisków
    container.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
             const content = e.target.closest('.story-item').querySelector('.full-content');
             const excerpt = e.target.closest('.story-item').querySelector('p');
             if(content.style.display === 'none') {
                 content.style.display = 'block';
                 excerpt.style.display = 'none';
                 e.target.textContent = 'Zwiń';
                 // Zlicz wyświetlenie
                 const article = e.target.closest('.story-item');
                 incrementField(article, 'views', '.view-count');
             } else {
                 content.style.display = 'none';
                 excerpt.style.display = 'block';
                 e.target.textContent = 'Czytaj dalej';
             }
        });
    });

    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const article = e.target.closest('.story-item');
        if(btn.disabled) return;
        btn.disabled = true;
        await incrementField(article, 'likes', '.like-count');
        btn.innerHTML = '❤️ Polubiono';
      });
    });

  } catch (e) {
    console.error("Błąd wczytywania Latarnia Nadziei:", e);
    container.innerHTML = "<p style='text-align:center; color: red;'>Nie udało się załadować wpisów.</p>";
  }
}

async function incrementField(article, field, selector) {
  try {
    const section = article.getAttribute('data-section');
    const id = article.getAttribute('data-id');
    const ref = doc(db, 'sekcje', section, 'entries', id);
    await updateDoc(ref, { [field]: increment(1) });

    const el = article.querySelector(selector);
    if (el) el.textContent = parseInt(el.textContent) + 1;
  } catch (e) {
    console.error(`Błąd przy aktualizacji ${field}:`, e);
  }
}

// ==================== 3. ISKIERKI NADZIEI ====================
async function fetchSparks(textEl) {
  try {
    const snap = await getDocs(query(collection(db, "sparks"), orderBy("createdAt", "desc")));
    sparksFromDB = snap.docs.map(d => d.data().quote);
    if (sparksFromDB.length > 0) changeSpark(textEl);
    else textEl.innerText = "Brak iskierek w bazie.";
  } catch (e) {
    console.error("Błąd wczytywania iskierek:", e);
    // Fallback bez sortowania
    try {
        const snap = await getDocs(collection(db, "sparks"));
        sparksFromDB = snap.docs.map(d => d.data().quote);
        if (sparksFromDB.length > 0) changeSpark(textEl);
    } catch (err) {
        textEl.innerText = "Niech światło nadziei nigdy nie gaśnie.";
    }
  }
}

function changeSpark(textEl) {
  if (!sparksFromDB.length || !textEl) return;
  const newSpark = sparksFromDB[Math.floor(Math.random() * sparksFromDB.length)];
  textEl.style.opacity = 0;
  setTimeout(() => {
    textEl.innerText = `„${newSpark}”`;
    textEl.style.opacity = 1;
  }, 300);
}

// ==================== 4. ODTWARZACZ YT ====================
function initYTPlayer() {
  if (!document.getElementById('youtube-player') || window.YT) return;
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript.parentNode.insertBefore(tag, firstScript);

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtube-player', {
      height: '0', width: '0',
      playerVars: { 'playsinline': 1, 'origin': window.location.origin },
      events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
    });
  };
}

async function onPlayerReady() {
  const songTitle = document.getElementById("current-song-title");
  try {
    const snap = await getDocs(query(collection(db, "playlist"), orderBy("createdAt", "asc")));
    playlist = snap.docs.map(d => ({ title: d.data().title, videoId: getVideoId(d.data().link) })).filter(s => s.videoId);
    if (playlist.length > 0) loadCurrentSong(false);
    else if (songTitle) songTitle.innerText = "Brak utworów w playliście.";
  } catch (e) {
    console.error("Błąd playlisty:", e);
    if(songTitle) songTitle.innerText = "Playlista niedostępna.";
  }
}

function onPlayerStateChange(e) {
  const icon = document.querySelector('#play-pause-btn i');
  if (icon) icon.className = (e.data === YT.PlayerState.PLAYING) ? 'fas fa-pause' : 'fas fa-play';
  if (e.data === YT.PlayerState.ENDED) nextSong();
}

function togglePlayPause() {
  if (!player || !playlist.length) return;
  // Sprawdzenie czy player jest gotowy
  if (typeof player.getPlayerState !== 'function') return;
  
  (player.getPlayerState() === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
}

function loadCurrentSong(autoplay = true) {
  if (!playlist.length || !player) return;
  const songTitleEl = document.getElementById("current-song-title");
  if (songTitleEl) {
    songTitleEl.innerText = playlist[currentIndex].title;
  }
  if (autoplay) player.loadVideoById(playlist[currentIndex].videoId);
  else player.cueVideoById(playlist[currentIndex].videoId);
}

function nextSong() { if (!playlist.length) return; currentIndex = (currentIndex + 1) % playlist.length; loadCurrentSong(true); }
function prevSong() { if (!playlist.length) return; currentIndex = (currentIndex - 1 + playlist.length) % playlist.length; loadCurrentSong(true); }

// ==================== 5. DISQUS (Opcjonalny) ====================
function initializeDisqus() {
  const disqusThread = document.getElementById('disqus_thread');
  if (!disqusThread) return;
  window.disqus_config = function () {
    this.page.url = window.location.href;
    this.page.identifier = 'strona-glowna-od-dna-do-swiatla';
  };
  const d = document, s = d.createElement('script');
  s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js';
  s.setAttribute('data-timestamp', +new Date());
  (d.head || d.body).appendChild(s);
}

// ==================== 6. START APLIKACJI ====================
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  let rawSection = urlParams.get('nazwa');
  
  // Elementy DOM
  const menuContainer = document.getElementById('main-menu');
  const entriesContainer = document.getElementById('entries-container');
  const sparkText = document.getElementById('sparkText');
  const sparkButton = document.getElementById('sparkButton');

  // Uruchomienie głównych funkcji
  if (menuContainer) fetchAndRenderMenu(menuContainer);
  if (entriesContainer) fetchLatarniaNadziei(entriesContainer);
  if (sparkText) fetchSparks(sparkText);
  
  if (sparkButton && sparkText) {
    sparkButton.addEventListener('click', () => changeSpark(sparkText));
  }
  
  // Inicjalizacja Playera
  initYTPlayer();
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
  if (document.getElementById('next-btn')) document.getElementById('next-btn').addEventListener('click', nextSong);
  if (document.getElementById('prev-btn')) document.getElementById('prev-btn').addEventListener('click', prevSong);
  
  if (document.getElementById('disqus_thread')) initializeDisqus();

  // NAPRAWIONE: Dynamiczne ładowanie ModalModule (aby błąd nie blokował reszty)
  import('/js/modules.js')
    .then((module) => {
        if (module.ModalModule && module.ModalModule.init) {
            module.ModalModule.init();
        }
    })
    .catch((err) => {
        console.warn("ModalModule nie załadowany (opcjonalny):", err);
    });
});
