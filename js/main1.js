// Plik: /js/main.js (WERSJA OSTATECZNA, ZMODERNIZOWANA I SAMODZIELNA)

// --- Konfiguracja i Inicjalizacja Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, collectionGroup, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app", // POPRAWIONA NAZWA
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
  measurementId: "G-LNYWJD2YV7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Główny obiekt aplikacji `LatarniaApp`.
 */
const LatarniaApp = {
    state: {
        sparks: [],
        playlist: [],
        player: null,
        currentSongIndex: 0,
    },
    elements: {},
    utils: {
        escapeHtml: (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        stripHtml: (s = '') => String(s).replace(/<[^>]*>?/gm, ''),
        getVideoId: (url) => {
            if (!url) return null;
            const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const matches = url.match(regex);
            return matches ? matches[1] : null;
        }
    },

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            this.cacheElements();
            this.loadData();
            this.initModules();
            this.bindEvents();
        });
    },

    cacheElements() {
        this.elements = {
            menuContainer: document.getElementById('main-menu'),
            entriesContainer: document.getElementById("entries-container"),
            galleryContainer: document.getElementById("gallery-container"),
            sparkText: document.getElementById("sparkText"),
            sparkButton: document.getElementById("sparkButton"),
            songTitle: document.getElementById("current-song-title"),
            playPauseBtn: document.getElementById('play-pause-btn'),
            prevBtn: document.getElementById("prev-btn"),
            nextBtn: document.getElementById("next-btn"),
            loadLatarniaButton: document.getElementById('load-latarnia-btn'),
            disqusThread: document.getElementById('disqus_thread'),
            mainContent: document.getElementById('main-content'),
            dynamicContainer: document.getElementById('dynamic-content-container'),
        };
    },

    async loadData() {
        await Promise.all([
            this.fetchMenu(),
            this.fetchLatestEntries(),
            this.fetchGallery(),
            this.fetchSparks(),
            this.fetchPlaylist()
        ]).catch(err => console.error("Wystąpił krytyczny błąd podczas ładowania danych:", err));
    },

    initModules() {
        this.modules.player.init();
        this.modules.disqus.init();
    },

    bindEvents() {
        const { sparkButton, sparkText, playPauseBtn, nextBtn, prevBtn, loadLatarniaButton } = this.elements;
        if (sparkButton && sparkText) {
            sparkButton.addEventListener("click", () => this.renderRandomSpark());
            setInterval(() => this.renderRandomSpark(), 20000);
        }
        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.modules.player.togglePlayPause());
        if (nextBtn) nextBtn.addEventListener("click", () => this.modules.player.nextSong());
        if (prevBtn) prevBtn.addEventListener("click", () => this.modules.player.prevSong());
        if (loadLatarniaButton) loadLatarniaButton.addEventListener('click', () => this.modules.card.load());
    },

    async fetchMenu() {
        const { menuContainer } = this.elements;
        if (!menuContainer) return;
        try {
            const q = query(collection(db, "menu"), orderBy("order", "asc"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                menuContainer.innerHTML = '<li><a>Brak menu</a></li>';
                return;
            }
            menuContainer.innerHTML = snapshot.docs.map(doc => {
                const data = doc.data();
                let finalUrl = this.utils.escapeHtml(data.url);
                if (finalUrl === 'Sekcja.html') {
                    // Generujemy nowy, poprawny format linku
                    finalUrl = `${finalUrl}?section=${encodeURIComponent(data.text)}`;
                }
                return `<li><a href="${finalUrl}">${this.utils.escapeHtml(data.text)}</a></li>`;
            }).join('');
        } catch (err) {
            console.error("Błąd wczytywania menu: ", err);
            menuContainer.innerHTML = '<li><a>Błąd wczytywania menu</a></li>';
        }
    },

    async fetchLatestEntries() {
        const { entriesContainer } = this.elements;
        if (!entriesContainer) return;
        try {
            const q = query(collectionGroup(db, "entries"), orderBy("createdAt", "desc"), limit(3));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                entriesContainer.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>";
                return;
            }
            entriesContainer.innerHTML = snapshot.docs.map(doc => {
                const e = { id: doc.id, section: doc.ref.parent.parent.id, ...doc.data() };
                const skrot = this.utils.stripHtml(e.text).substring(0, 300);
                const url = `Sekcja.html?section=${encodeURIComponent(e.section)}`;
                const title = this.utils.escapeHtml(e.title || 'Bez tytułu');
                const section = this.utils.escapeHtml(e.section);
                const date = e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : '';
                return `
                <article class="story-item">
                    <h3 class="fancy-title"><a href="${url}" style="text-decoration:none; color:inherit;">${title}</a></h3>
                    <div class="entry-item-meta"><strong>W sekcji: ${section}</strong> • ${date}</div>
                    <div class="wpis-skrot"><p>${this.utils.escapeHtml(skrot)}...</p></div>
                    <a href="${url}" class="speak-button" style="text-decoration: none; margin: 15px auto 0; display: table;">Czytaj dalej</a>
                </article>`;
            }).join('');
        } catch (err) {
            console.error("Błąd wczytywania Ostatniej Latarni Nadziei:", err);
            entriesContainer.innerHTML = `<p style='text-align:center;'>Błąd wczytywania wpisów.</p>`;
        }
    },
    
    async fetchGallery() {
        const { galleryContainer } = this.elements;
        if (!galleryContainer) return;
        try {
            const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(6));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return;
            galleryContainer.innerHTML = snapshot.docs.map(doc => {
                const img = doc.data();
                const url = this.utils.escapeHtml(img.url);
                const desc = this.utils.escapeHtml(img.desc);
                return `<a href="Galeria.html" title="${desc}"><img src="${url}" alt="${desc}"></a>`;
            }).join('');
        } catch (err) {
            console.error("Błąd wczytywania galerii:", err);
        }
    },

    async fetchSparks() {
        try {
            const q = query(collection(db, "sparks"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            this.state.sparks = snapshot.docs.map(doc => doc.data().quote);
            this.renderRandomSpark();
        } catch (err) {
            console.error("Błąd wczytywania iskierek:", err);
            if(this.elements.sparkText) this.elements.sparkText.innerText = "Błąd ładowania iskierek.";
        }
    },

    renderRandomSpark() {
        const { sparkText } = this.elements;
        if (!sparkText || !this.state.sparks.length) {
            if(sparkText) sparkText.innerText = "Brak iskierek w bazie.";
            return;
        }
        const newSpark = this.state.sparks[Math.floor(Math.random() * this.state.sparks.length)];
        sparkText.style.opacity = 0;
        setTimeout(() => {
            sparkText.innerText = this.utils.escapeHtml(newSpark);
            sparkText.style.opacity = 1;
        }, 300);
    },

    async fetchPlaylist() {
        try {
            const q = query(collection(db, "playlist"), orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);
            this.state.playlist = snapshot.docs.map(doc => ({ title: doc.data().title, videoId: this.utils.getVideoId(doc.data().link) })).filter(song => song.videoId);
        } catch (err) {
            console.error("Błąd wczytywania playlisty:", err);
            if (this.elements.songTitle) this.elements.songTitle.innerText = "Błąd ładowania playlisty.";
        }
    },

    modules: {
        player: {
            init() {
                if (!document.getElementById('youtube-player')) return;
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
                window.onYouTubeIframeAPIReady = () => this.onApiReady();
            },
            onApiReady() {
                LatarniaApp.state.player = new YT.Player('youtube-player', {
                    height: '0', width: '0',
                    playerVars: { 'playsinline': 1, 'origin': window.location.origin },
                    events: { 'onReady': this.onPlayerReady, 'onStateChange': this.onPlayerStateChange }
                });
            },
            onPlayerReady() {
                if (LatarniaApp.state.playlist.length > 0) LatarniaApp.modules.player.loadSong(false);
                else if (LatarniaApp.elements.songTitle) LatarniaApp.elements.songTitle.innerText = "Brak utworów.";
            },
            onPlayerStateChange(event) {
                const icon = LatarniaApp.elements.playPauseBtn?.querySelector('i');
                if (icon) icon.className = (event.data === YT.PlayerState.PLAYING) ? 'fas fa-pause' : 'fas fa-play';
                if (event.data === YT.PlayerState.ENDED) this.nextSong();
            },
            loadSong(autoplay = true) {
                const { playlist, currentSongIndex, player } = LatarniaApp.state;
                const { songTitle } = LatarniaApp.elements;
                if (!playlist.length || !player || !songTitle) return;
                const song = playlist[currentSongIndex];
                songTitle.style.opacity = 0;
                setTimeout(() => {
                    songTitle.innerText = LatarniaApp.utils.escapeHtml(song.title);
                    songTitle.style.opacity = 1;
                }, 300);
                if (autoplay) player.loadVideoById(song.videoId);
                else player.cueVideoById(song.videoId);
            },
            togglePlayPause() {
                const { player, playlist } = LatarniaApp.state;
                if (!player || !playlist.length) return;
                const state = player.getPlayerState();
                (state === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
            },
            nextSong() {
                const { playlist } = LatarniaApp.state;
                if (!playlist.length) return;
                LatarniaApp.state.currentSongIndex = (LatarniaApp.state.currentSongIndex + 1) % playlist.length;
                this.loadSong(true);
            },
            prevSong() {
                const { playlist } = LatarniaApp.state;
                if (!playlist.length) return;
                LatarniaApp.state.currentSongIndex = (LatarniaApp.state.currentSongIndex - 1 + playlist.length) % playlist.length;
                this.loadSong(true);
            }
        },
        disqus: {
            init() {
                const { disqusThread } = LatarniaApp.elements;
                if (!disqusThread) return;
                const d = document, s = d.createElement('script');
                s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js';
                s.setAttribute('data-timestamp', +new Date());
                (d.head || d.body).appendChild(s);
            }
        },
        card: {
            async load() {
                const { mainContent, dynamicContainer } = LatarniaApp.elements;
                if (!mainContent || !dynamicContainer) return;
                try {
                    const response = await fetch('latarnia-template.html');
                    if (!response.ok) throw new Error('Brak szablonu latarnia-template.html');
                    mainContent.style.display = 'none';
                    dynamicContainer.innerHTML = await response.text();
                    dynamicContainer.style.display = 'flex';
                    const backBtn = document.getElementById('back-to-main-btn');
                    if (backBtn) backBtn.addEventListener('click', () => this.unload());
                } catch (err) {
                    console.error("Błąd ładowania wizytówki:", err);
                    this.unload();
                }
            },
            unload() {
                const { mainContent, dynamicContainer } = LatarniaApp.elements;
                if (dynamicContainer) {
                    dynamicContainer.style.display = 'none';
                    dynamicContainer.innerHTML = '';
                }
                if (mainContent) mainContent.style.display = 'block';
            }
        }
    }
};

LatarniaApp.init();
