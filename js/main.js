// Plik: /js/main.js (WERSJA DO REPO - KULOODPORNA NA MOBILNE PRZEGLĄDARKI)

// --- Importy Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, getDocs, query, orderBy, limit, doc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ZMIANA: Pełna ścieżka bezwzględna dla pewności ładowania
import { ModalModule } from '/js/modules.js';

// --- Firebase config ---
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

// --- Zmienne Globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- Funkcje Pomocnicze ---
function escapeHtml(s = '') { 
  return String(s).replace(/[&<>"']/g, c => ({ 
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
  }[c])); 
}
function stripHtml(s = '') { return String(s).replace(/<[^>]*>?/gm, ''); }
function getVideoId(url) { 
  if (!url) return null; 
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); 
  return m ? m[1] : null; 
}

// ==================== MENU ====================
async function fetchAndRenderMenu(container) {
  try {
    const snap = await getDocs(query(collection(db, "menu"), orderBy("order", "asc")));
    container.innerHTML = snap.docs.map(doc => {
      const data = doc.data();
      let finalUrl = escapeHtml(data.url);
      if (finalUrl.toLowerCase() === 'sekcja.html') {
        finalUrl = `sekcja.html?nazwa=${encodeURIComponent(data.text)}`;
      }
      return `<li><a href="${finalUrl}" class="index-nav-button">${escapeHtml(data.text)}</a></li>`;
    }).join('') || '<li><a class="index-nav-button">Brak menu</a></li>';
  } catch (e) {
    console.error("Błąd wczytywania menu:", e);
    container.innerHTML = '<li><a class="index-nav-button">Błąd</a></li>';
  }
}

// ==================== LatarniA NADZIEI ====================
async function fetchLatarniaNadziei(container) {
  try {
    const sectionsToExclude = ['Piciorys Chudego', 'Z punktu widzenia księżniczki', 'Pomoc', 'Galeria'];
    const menuSnap = await getDocs(query(collection(db, "menu")));
    const sectionsToQuery = menuSnap.docs
      .map(doc => doc.data().text)
      .filter(name => !sectionsToExclude.includes(name));

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
    allEntries.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    if (!allEntries.length) {
      container.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>";
      return;
    }

    container.innerHTML = allEntries.slice(0, 4).map(e => {
      const title = escapeHtml(e.title || 'Bez tytułu');
      const author = escapeHtml(e.author || 'Chudy');
      const date = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString('pl-PL') : 'Brak daty';
      const excerpt = stripHtml(e.text || '').substring(0, 200) + '...';

      return `
        <article class="story-item" data-section="${e.section}" data-id="${e.id}"
          style="background: rgba(15,20,30,0.7); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 class="fancy-title entry-title" style="font-size: 1.5rem; margin-bottom: 10px;">
            <a href="#" class="entry-link" style="text-decoration:none; color:inherit;">${title}</a>
          </h3>
          <div class="entry-meta">
            <span><i class="fas fa-user-edit"></i> Autor: ${author}</span>
            <span><i class="fas fa-calendar-alt"></i> ${date}</span>
            <span><i class="fas fa-heart"></i> Polubienia: <span class="like-count">${e.likes || 0}</span></span>
            <span><i class="fas fa-eye"></i> Wyświetlenia: <span class="view-count">${e.views || 0}</span></span>
          </div>
          <div class="entry-content">
            <p>${escapeHtml(excerpt)}</p>
            <div class="full-content" style="display: none;">${e.text || ''}</div>
          </div>
          <button class="action-button read-more-btn">Czytaj dalej</button>
          <button class="action-button like-btn">❤️ Polub</button>
        </article>`;
    }).join('');

    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const article = e.target.closest('.story-item');
        await incrementField(article, 'likes', '.like-count');
      });
    });

  } catch (e) {
    console.error("Błąd wczytywania Latarnia Nadziei:", e);
    container.innerHTML = "<p style='text-align:center; color: red;'>Błąd ładowania wpisów.</p>";
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

// ==================== ISKIERKI NADZIEI ====================
async function fetchSparks(textEl) {
  try {
    const snap = await getDocs(query(collection(db, "sparks"), orderBy("createdAt", "desc")));
    sparksFromDB = snap.docs.map(d => d.data().quote);
    if (sparksFromDB.length > 0) changeSpark(textEl);
    else textEl.innerText = "Brak iskierek w bazie.";
  } catch (e) {
    console.error("Błąd wczytywania iskierek:", e);
    textEl.innerText = "Błąd ładowania";
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

// ==================== ODTWARZACZ YT ====================
function initYTPlayer() {
  if (!document.getElementById('youtube-player') || window.YT) return;
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
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
    else if (songTitle) songTitle.innerText = "Brak utworów.";
  } catch (e) {
    console.error("Błąd playlisty:", e);
  }
}
function onPlayerStateChange(e) {
  const icon = document.querySelector('#play-pause-btn i');
  if (icon) icon.className = (e.data === YT.PlayerState.PLAYING) ? 'fas fa-pause' : 'fas fa-play';
  if (e.data === YT.PlayerState.ENDED) nextSong();
}
function togglePlayPause() {
  if (!player || !playlist.length) return;
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

// ==================== DISQUS ====================
function initializeDisqus() {
  const disqusThread = document.getElementById('disqus_thread');
  if (!disqusThread) return;
  window.disqus_config = function () {
    this.page.url = window.location.href;
    this.page.identifier = 'strona-glowna-latarnia';
  };
  const d = document, s = d.createElement('script');
  s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js';
  s.setAttribute('data-timestamp', +new Date());
  (d.head || d.body).appendChild(s);
}

// ==================== START APP ====================
document.addEventListener("DOMContentLoaded", () => {
  const preloader = document.getElementById('preloader');
  const appWrapper = document.getElementById('app-wrapper');
  
  // 1. REVEAL NA START (Gwarancja zniknięcia czarnej zasłony)
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(() => { preloader.style.display = 'none'; }, 500);
  }
  if (appWrapper) { appWrapper.style.opacity = '1'; }

  // 2. Obsługa parametrów URL (Naprawa polskich znaków z FB)
  const urlParams = new URLSearchParams(window.location.search);
  let rawSection = urlParams.get('nazwa');
  const sectionName = rawSection ? decodeURIComponent(rawSection) : null;

  // 3. ŁADOWANIE DANYCH z opóźnieniem dla stabilności mobilnej
  setTimeout(() => {
    const menuContainer = document.getElementById('main-menu');
    const entriesContainer = document.getElementById('entries-container');
    const sparkText = document.getElementById('sparkText');
    const sparkButton = document.getElementById('sparkButton');

    if (menuContainer) fetchAndRenderMenu(menuContainer);
    if (entriesContainer) fetchLatarniaNadziei(entriesContainer);
    if (sparkText) fetchSparks(sparkText);
    
    if (sparkButton && sparkText) {
      sparkButton.addEventListener('click', () => changeSpark(sparkText));
    }
    
    initYTPlayer();
    
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (document.getElementById('next-btn')) document.getElementById('next-btn').addEventListener('click', nextSong);
    if (document.getElementById('prev-btn')) document.getElementById('prev-btn').addEventListener('click', prevSong);
    
    if (document.getElementById('disqus_thread')) initializeDisqus();

    // Inicjalizacja modala z zabezpieczeniem
    if (typeof ModalModule !== 'undefined' && ModalModule.init) {
      ModalModule.init();
    }
  }, 100);
});
