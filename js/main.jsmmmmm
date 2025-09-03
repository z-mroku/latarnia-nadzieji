
// Plik: /js/main.js

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Zmienne Globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- FUNKCJE RENDERUJĄCE ---
async function fetchAndRenderMenu(container) {
    try {
        const snapshot = await getDocs(query(collection(db, "menu"), orderBy("order", "asc")));
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `<li><a href="${data.url}">${data.text}</a></li>`;
        }).join('') || '<li><a>Brak menu</a></li>';
    } catch (err) {
        console.error("Błąd wczytywania menu: ", err);
        container.innerHTML = '<li><a>Błąd wczytywania menu</a></li>';
    }
}

async function fetchLatarniaNadziei(container) {
    try {
        const entriesQuery = query(collectionGroup(db, "entries"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(entriesQuery);
        const specialSections = ['Piciorys Chudego', 'Z punktu widzenia księżniczki', 'Pomoc', 'Galeria', 'Latarnia z Mroku'];
        const entries = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data(), section: doc.ref.parent.parent.id }))
            .filter(e => !specialSections.includes(e.section));

        if (!entries.length) {
            container.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>";
            return;
        }

        container.innerHTML = entries.slice(0, 3).map(e => {
            const skrot = e.text.replace(/<[^>]*>?/gm, '').substring(0, 300);
            const url = `wpis.html?section=${encodeURIComponent(e.section)}&id=${e.id}`;
            return `
            <article class="story-item">
                <h3 class="fancy-title"><a href="${url}" style="text-decoration:none; color:inherit;">${e.title || 'Bez tytułu'}</a></h3>
                <div class="entry-item-meta"><strong>W sekcji: ${e.section}</strong> • ${e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : ''}</div>
                <div class="wpis-skrot"><p>${skrot}...</p></div>
                <a href="${url}" class="speak-button" style="text-decoration: none; margin: 15px auto 0; display: table;">Czytaj dalej</a>
            </article>`;
        }).join('');
    } catch (err) {
        console.error("Błąd wczytywania Ostatniej Latarni Nadziei:", err);
        container.innerHTML = "<p style='text-align:center;'>Błąd wczytywania wpisów.</p>";
    }
}

async function fetchSparks(textElement) {
    try {
        const q = query(collection(db, "sparks"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        sparksFromDB = snapshot.docs.map(doc => doc.data().quote);
        if (sparksFromDB.length > 0) changeSpark(textElement);
        else textElement.innerText = "Brak iskierek w bazie.";
    } catch (err) {
        console.error("Błąd wczytywania iskierek:", err);
        textElement.innerText = "Błąd ładowania iskierek.";
    }
}

function changeSpark(textElement) {
    if (!sparksFromDB.length) return;
    const newSpark = sparksFromDB[Math.floor(Math.random() * sparksFromDB.length)];
    textElement.style.opacity = 0;
    setTimeout(() => { textElement.innerText = newSpark; textElement.style.opacity = 1; }, 300);
}

// --- YOUTUBE PLAYER ---
function getVideoId(url) {
    if (!url) return null;
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
}

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: { 'playsinline': 1, 'origin': window.location.origin },
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
    });
};

async function onPlayerReady() {
    const songTitle = document.getElementById("current-song-title");
    try {
        const q = query(collection(db, "playlist"), orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);
        playlist = snapshot.docs.map(doc => ({
            title: doc.data().title,
            videoId: getVideoId(doc.data().link)
        })).filter(song => song.videoId);

        if (playlist.length > 0) loadCurrentSong(false);
        else if (songTitle) songTitle.innerText = "Brak utworów w playliście.";
    } catch (err) {
        console.error("Błąd wczytywania playlisty:", err);
        if (songTitle) songTitle.innerText = "Błąd ładowania playlisty.";
    }
}

function onPlayerStateChange(event) {
    const btn = document.getElementById('play-pause-btn');
    const icon = btn ? btn.querySelector('i') : null;
    if (icon) icon.className = (event.data === YT.PlayerState.PLAYING) ? 'fas fa-pause' : 'fas fa-play';
    if (event.data === YT.PlayerState.ENDED) nextSong();
}

function togglePlayPause() {
    if (!player || !playlist.length) return;
    const playerState = player.getPlayerState();
    (playerState === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
}

function loadCurrentSong(autoplay = true) {
    const sTitle = document.getElementById("current-song-title");
    if (!playlist.length || !player || !sTitle) return;
    const song = playlist[currentIndex];
    sTitle.style.opacity = 0;
    setTimeout(() => { sTitle.innerText = song.title; sTitle.style.opacity = 1; }, 300);
    if (autoplay) player.loadVideoById(song.videoId);
    else player.cueVideoById(song.videoId);
}

function nextSong() {
    if (!playlist.length) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    loadCurrentSong(true);
}

function prevSong() {
    if (!playlist.length) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadCurrentSong(true);
}

// --- DISQUS ---
function initializeDisqus() {
    (function () {
        var d = document, s = d.createElement('script');
        s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js';
        s.setAttribute('data-timestamp', +new Date());
        (d.head || d.body).appendChild(s);
    })();
}

// ===================================================================
// LOGIKA DYNAMICZNEGO KONTENTU
// ===================================================================

// zatrzymuje i resetuje wideo w tle
function stopBackgroundVideo() {
    const video = document.getElementById("background-video");
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
}

async function loadLatarniaContent() {
    const mainContent = document.getElementById('main-content');
    const dynamicContainer = document.getElementById('dynamic-content-container');

    if (!mainContent || !dynamicContainer) {
        console.error("Brak kontenerów ('main-content' lub 'dynamic-content-container') w index.html!");
        return;
    }

    try {
        const response = await fetch('latarnia-template.html');
        if (!response.ok) throw new Error('Nie udało się załadować szablonu latarnia-template.html.');
        const contentHTML = await response.text();

        mainContent.style.display = 'none';
        dynamicContainer.innerHTML = contentHTML;
        dynamicContainer.style.display = 'flex';

        const backBtn = document.getElementById('back-to-main-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                stopBackgroundVideo(); // 🔥 tu resetujemy wideo
                dynamicContainer.style.display = 'none';
                mainContent.style.display = 'block';
                dynamicContainer.innerHTML = '';
            });
        }
    } catch (err) {
        console.error("Błąd ładowania dynamicznej treści:", err);
        mainContent.style.display = 'block';
    }
}

// --- GŁÓWNY START ---
document.addEventListener("DOMContentLoaded", () => {
    const menuContainer = document.getElementById('main-menu');
    const entriesContainer = document.getElementById("entries-container");
    const sparkTextElement = document.getElementById("sparkText");
    const sparkButton = document.getElementById("sparkButton");
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const loadLatarniaButton = document.getElementById('load-latarnia-btn');

    if (menuContainer) fetchAndRenderMenu(menuContainer);
    if (entriesContainer) fetchLatarniaNadziei(entriesContainer);
    if (sparkTextElement) fetchSparks(sparkTextElement);
    if (document.getElementById('disqus_thread')) initializeDisqus();

    if (sparkButton) sparkButton.addEventListener("click", () => changeSpark(sparkTextElement));
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (nextBtn) nextBtn.addEventListener("click", nextSong);
    if (prevBtn) prevBtn.addEventListener("click", prevSong);
    if (loadLatarniaButton) loadLatarniaButton.addEventListener('click', loadLatarniaContent);
});
I ten 
Z GitHuba 
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Wczytywanie...</title>
  <link rel="stylesheet" href="/css/style.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <style>
    .back-to-home-button { position: fixed; top: 15px; right: 15px; z-index: 1001; font-size: 1em; padding: 12px 25px; }
    .story-container { max-width: 960px; margin: 0 auto; padding: 20px; }
    .story-item { background-color: rgba(10,10,10,0.85); margin-bottom: 20px; padding: 20px; border-radius: 12px; color: #f0f0f0; box-shadow: 0 10px 30px rgba(0,0,0,.35);}
    .story-item h2 { margin: 0 0 8px; }
    .entry-item-meta{ opacity:.8; font-size:.9em; margin-bottom:10px;}
    .wpis-skrot p{ margin:0;}
    .wpis-calosc{ margin-top:12px; }
    .speak-button, .czytaj-dalej-btn{
      display:inline-flex; align-items:center; gap:.5rem; margin-top:12px;
      background:#6c757d; color:#fff; border:none; padding:10px 16px; border-radius:10px; cursor:pointer
    }
    .czytaj-dalej-btn{ background:#3b3f46; }
    .speak-button[disabled]{ opacity:.5; cursor:not-allowed }
    header.page-header{ padding:80px 20px 20px; text-align:center }
    header.page-header h1{ margin:0; }
    /* Pomoc */
    .filter-bar { margin: 10px 0 20px; text-align:center }
    .accordion { background-color: #222; color: #fff; cursor: pointer; padding: 12px 16px; width: 100%; text-align: left; border: none; outline: none; transition: .25s; border-radius: 10px; margin: 10px 0; }
    .accordion.active { background-color: #3a3a3a; }
    .panel { max-height: 0; overflow: hidden; transition: max-height .3s ease; padding: 0 12px; background: rgba(0,0,0,0.55); border-radius: 10px; }
    .place-entry{ padding:14px 4px; border-bottom: 1px dashed rgba(255,255,255,.15) }
    .place-entry:last-child{ border-bottom:none }
  </style>
</head>
<body>
  <a href="index.html" class="back-to-home-button"><i class="fas fa-arrow-left"></i> Powrót</a>

  <div id="dynamic-content-wrapper">
    <p style="text-align:center; padding-top: 50px;">Ładowanie...</p>
  </div>

  <script type="module">
    import { db } from './js/firebase-config.js';
    import { collection, query, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    // --- UTYLsy ---
    const params = new URLSearchParams(location.search);
    // Obsługujemy obie wersje: ?nazwa=Sekcja (oryginał) i ?section=Sekcja (na wszelki)
    const sectionNameRaw = (params.get('nazwa') || params.get('section') || '').trim();
    const sectionName = decodeURIComponent(sectionNameRaw);
    const wrapper = document.getElementById('dynamic-content-wrapper');

    // Solidny, odporny lektor
    function createLector(buttonId, contentSelectorOrId, buttonText="Odsłuchaj") {
      const btn = document.getElementById(buttonId);
      if (!btn) return;

      const el = contentSelectorOrId.startsWith('#')
        ? document.querySelector(contentSelectorOrId)
        : document.getElementById(contentSelectorOrId);
      if (!el) { btn.disabled = true; return; }

      // Pobierz czysty tekst z HTML (zachowuje przerwy)
      const tmp = document.createElement('div');
      tmp.innerHTML = el.innerHTML;
      const fullText = (tmp.innerText || tmp.textContent || '').replace(/\s+\n/g, '\n').trim();

      if (!fullText) { btn.disabled = true; btn.style.opacity = .5; return; }

      // Segmentacja: kropki, znaki zapytania, wielokrotne nowe linie itp.
      const sentences = fullText
        .split(/(?:(?<=\S)[.!?…]+|\n{2,})\s+/g)
        .map(s => s.trim()).filter(Boolean);

      let currentIndex = 0;
      let isReading = false;
      let plVoice = null;

      function pickPolishVoice() {
        const voices = window.speechSynthesis.getVoices() || [];
        plVoice = voices.find(v => /pl/i.test(v.lang)) || null;
      }
      pickPolishVoice();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => pickPolishVoice();
      }

      function readSentence(i) {
        if (!isReading || i >= sentences.length) {
          window.speechSynthesis.cancel();
          isReading = false;
          btn.textContent = `▶️ ${buttonText}`;
          currentIndex = 0;
          return;
        }
        const utter = new SpeechSynthesisUtterance(sentences[i]);
        utter.lang = "pl-PL";
        if (plVoice) utter.voice = plVoice;
        utter.rate = 1;      // można podbić na 1.05, jeśli wolisz
        utter.pitch = 1;
        utter.onend = () => { if (isReading) { currentIndex++; readSentence(currentIndex); } };
        window.speechSynthesis.speak(utter);
      }

      btn.addEventListener("click", () => {
        const synth = window.speechSynthesis;
        if (isReading) {
          isReading = false;
          synth.cancel();
          btn.textContent = `🔄 Wznów`;
        } else {
          isReading = true;
          btn.textContent = `⏸️ Pauza`;
          // iOS/Safari lubią mieć „gesture” – wszystko uruchamiane tu, po kliknięciu
          readSentence(currentIndex);
        }
      });

      window.addEventListener("beforeunload", () => window.speechSynthesis.cancel());
    }

    // Render: Piciorys (wstęp + historia, podział po ---PODZIAL---)
    function renderPiciorys(entry) {
      const [quote, historia] = (entry.text || '').split('---PODZIAL---');
      wrapper.innerHTML = `
        <header class="page-header">
          <h1>Piciorys Chudego</h1>
          <a href="index.html" class="back-to-home-button">⟵ Powrót</a>
        </header>
        <main class="story-container">
          <article class="story-item">
            <div id="piciorys-wstep">
              <h2>${entry.title || ''}</h2>
              ${quote ? `<blockquote>${quote}</blockquote>` : ''}
            </div>
            <div class="speak-button-container">
              <button id="speakBtn1" class="speak-button">▶️ Odsłuchaj Wstęp</button>
            </div>
            <div id="piciorys-historia" class="wpis-calosc">${historia || ''}</div>
            <div class="speak-button-container">
              <button id="speakBtn2" class="speak-button">▶️ Odsłuchaj Historię</button>
            </div>
          </article>
        </main>`;
      createLector("speakBtn1", "piciorys-wstep", "Odsłuchaj Wstęp");
      createLector("speakBtn2", "piciorys-historia", "Odsłuchaj Historię");
    }

    // Render: Księżniczka – całość jednym lektorem
    function renderKsiezniczka(entry) {
      wrapper.innerHTML = `
        <header class="page-header">
          <h1>Z punktu widzenia księżniczki</h1>
          <a href="index.html" class="back-to-home-button">⟵ Powrót</a>
        </header>
        <main class="story-container">
          <article id="ksiezniczka-text" class="story-item">
            <h2>${entry.title || ''}</h2>
            ${entry.text || ''}
            <div class="speak-button-container">
              <button id="speakBtn" class="speak-button">▶️ Odsłuchaj</button>
            </div>
          </article>
        </main>`;
      createLector("speakBtn", "ksiezniczka-text");
    }

    // Render: Pomoc – akordeony wg woj.
    function renderPomoc(entries) {
      const grouped = entries.reduce((acc, e) => {
        const woj = e.woj || 'Inne';
        (acc[woj] ||= []).push(e);
        return acc;
      }, {});
      const wojOrder = ['Ogólnopolskie', ...Object.keys(grouped).filter(w => w!=='Ogólnopolskie').sort()];

      let accordionsHTML = '';
      for (const woj of wojOrder) {
        if (!grouped[woj]) continue;
        const itemsHtml = grouped[woj].map(e => `
          <div class="place-entry">
            <h3>${e.name || 'Brak nazwy'}</h3>
            ${e.address ? `<p><strong>Adres:</strong> ${e.address}</p>` : ''}
            ${e.phone ? `<p><strong>Telefon:</strong> ${e.phone}</p>` : ''}
            <p>${e.desc || ''}</p>
            ${e.link ? `<p><a href="${e.link}" target="_blank" rel="noopener">Przejdź do strony</a></p>` : ''}
          </div>
        `).join('');
        const icon = woj === 'Ogólnopolskie' ? '📞' : '🏥';
        accordionsHTML += `
          <div class="woj-group" data-woj="${woj}">
            <button class="accordion">${icon} ${woj}</button>
            <div class="panel">${itemsHtml}</div>
          </div>`;
      }

      wrapper.innerHTML = `
        <header class="page-header">
          <h1>Gdzie szukać pomocy – Uzależnienia</h1>
          <a href="index.html" class="back-to-home-button">⟵ Powrót</a>
        </header>
        <main class="story-container">
          <div class="filter-bar">
            <label for="wojewodztwoSelect"><strong>Filtruj wg województwa:</strong></label>
            <select id="wojewodztwoSelect">
              <option value="all">Wszystkie</option>
              ${wojOrder.map(w => `<option value="${w}">${w}</option>`).join('')}
            </select>
          </div>
          ${accordionsHTML || '<p>Brak ośrodków w bazie.</p>'}
        </main>`;

      document.querySelectorAll('.accordion').forEach(acc => {
        acc.addEventListener('click', function() {
          this.classList.toggle('active');
          const panel = this.nextElementSibling;
          panel.style.maxHeight = panel.style.maxHeight ? null : (panel.scrollHeight + "px");
        });
      });

      const select = document.getElementById('wojewodztwoSelect');
      const groups = document.querySelectorAll('.woj-group');
      select.addEventListener('change', function() {
        groups.forEach(g => g.style.display = (this.value === 'all' || g.dataset.woj === this.value) ? 'block' : 'none');
      });
    }

    // Render: standardowe sekcje (Kronika, Opowieści itd.)
    function renderStandard(sectionName, docs) {
      const items = docs.map(d => {
        const e = d.data();
        const id = d.id;
        const contentId = `content-full-${id}`;
        const buttonId  = `button-speak-${id}`;
        const skrot = (e.text || '').replace(/<[^>]*>?/gm, '').substring(0, 300);
        return `
          <div class="story-item">
            <h2>${e.title || 'Bez tytułu'}</h2>
            <div class="entry-item-meta">${e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : ''}</div>
            <div class="wpis-skrot"><p>${skrot}...</p></div>
            <div id="${contentId}" class="wpis-calosc" style="display:none;">${e.text || ''}</div>
            <div class="speak-button-container">
              <button class="czytaj-dalej-btn">...czytaj dalej</button>
              <button id="${buttonId}" class="speak-button" style="display:none;">▶️ Odsłuchaj</button>
            </div>
          </div>`;
      }).join('');

      wrapper.innerHTML = `
        <header class="page-header">
          <h1>${sectionName}</h1>
          <a href="index.html" class="back-to-home-button">⟵ Powrót</a>
        </header>
        <main><div class="story-container">${items}</div></main>`;

      // toggle + lektor
      document.querySelectorAll('.czytaj-dalej-btn').forEach(btn => {
        btn.addEventListener('click', function(){
          const story = this.closest('.story-item');
          const skrot = story.querySelector('.wpis-skrot');
          const calosc = story.querySelector('.wpis-calosc');
          const speak  = story.querySelector('.speak-button');
          const open = calosc.style.display === 'block';
          if (open) {
            calosc.style.display='none'; speak.style.display='none'; skrot.style.display='block'; this.textContent='...czytaj dalej';
          } else {
            calosc.style.display='block'; speak.style.display='inline-flex'; skrot.style.display='none'; this.textContent='Zwiń';
          }
        });
      });

      docs.forEach(d => {
        const contentId = `content-full-${d.id}`;
        const buttonId  = `button-speak-${d.id}`;
        createLector(buttonId, contentId);
      });
    }

    // --- START ---
    (async () => {
      try {
        if (!sectionName) {
          wrapper.innerHTML = `
            <header class="page-header"><h1>Błąd</h1></header>
            <main class="story-container"><p>Brak nazwy sekcji w adresie URL.</p></main>`;
          return;
        }

        document.title = `${sectionName} — Od Dna do Światła`;
        const entriesRef = collection(db, 'sekcje', sectionName, 'entries');

        // SPECJALNE
        if (sectionName === 'Piciorys Chudego') {
          const snap = await getDocs(query(entriesRef, limit(1)));
          if (snap.empty) {
            wrapper.innerHTML = `<header class="page-header"><h1>${sectionName}</h1></header><main class="story-container"><p>Brak wpisu.</p></main>`;
            return;
          }
          renderPiciorys(snap.docs[0].data());
          return;
        }
        if (sectionName.toLowerCase().includes('księżniczki')) {
          const snap = await getDocs(query(entriesRef, limit(1)));
          if (snap.empty) {
            wrapper.innerHTML = `<header class="page-header"><h1>${sectionName}</h1></header><main class="story-container"><p>Brak wpisu.</p></main>`;
            return;
          }
          renderKsiezniczka(snap.docs[0].data());
          return;
        }
        if (sectionName === 'Pomoc') {
          const snap = await getDocs(query(entriesRef, orderBy('woj')));
          const entries = snap.docs.map(d => d.data());
          renderPomoc(entries);
          return;
        }

        // STANDARD
        const snap = await getDocs(query(entriesRef, orderBy('createdAt','desc')));
        if (snap.empty) {
          wrapper.innerHTML = `<header class="page-header"><h1>${sectionName}</h1></header><main class="story-container"><p>Brak wpisów w tej sekcji.</p></main>`;
          return;
        }
        renderStandard(sectionName, snap.docs);

      } catch (err) {
        console.error('Błąd krytyczny w Sekcja.html:', err);
        wrapper.innerHTML = `<header class="page-header"><h1>Błąd krytyczny</h1></header><main class="story-container"><p>Wystąpił problem z ładowaniem sekcji. Sprawdź konsolę (F12), aby zobaczyć szczegóły.</p></main>`;
      }
    })();
  </script>
</body>
</html>
