// Plik: /js/main.js (WERSJA OSTATECZNA, KOMPLETNA 100%)

import { db } from './firebase-config.js'; 
import { collection, getDocs, query, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Zmienne Globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- FUNKCJE RENDERUJĄCE ---
async function fetchAndRenderMenu(container) { 
    if (!container) return;
    try { 
        const snapshot = await getDocs(query(collection(db, "menu"), orderBy("order", "asc"))); 
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const url = `Sekcja.html?section=${encodeURIComponent(data.text)}`;
            return `<li><a href="${url}">${data.text}</a></li>`;
        }).join('') || '<li><a>Brak menu</a></li>'; 
    } catch (err) { 
        console.error("Błąd wczytywania menu: ", err); 
        container.innerHTML = '<li><a>Błąd wczytywania menu</a></li>'; 
    } 
}

async function fetchLatarniaNadziei(container) { 
    if (!container) return;
    try { 
        const entriesQuery = query(collectionGroup(db, "entries"), orderBy("createdAt", "desc")); 
        const snapshot = await getDocs(entriesQuery); 
        const specialSections = ['Piciorys Chudego', 'Z punktu widzenia księżniczki', 'Pomoc', 'Galeria'];
        const entries = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data(), section: doc.ref.parent.parent.id }))
            .filter(e => !specialSections.includes(e.section)); 

        if (!entries.length) { 
            container.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>"; 
            return; 
        } 
        
        container.innerHTML = entries.slice(0, 3).map(e => { 
            const skrot = e.text.replace(/<[^>]*>?/gm, '').substring(0, 300); 
            const url = `Sekcja.html?section=${encodeURIComponent(e.section)}`;
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
        if (err.code === 'failed-precondition') {
            container.innerHTML = "<p style='text-align:center; font-weight:bold; color: #ff9800;'>Błąd bazy: Wymagany jest Indeks. Sprawdź konsolę (F12), aby go utworzyć.</p>";
        } else {
            container.innerHTML = "<p style='text-align:center;'>Błąd wczytywania wpisów.</p>"; 
        }
    } 
}

async function fetchSparks(textElement) { 
    if (!textElement) return;
    try { 
        const q = query(collection(db, "sparks"), orderBy("createdAt", "desc")); 
        const snapshot = await getDocs(q); 
        sparksFromDB = snapshot.docs.map(doc => doc.data().quote); 
        if (sparksFromDB.length > 0) {
            changeSpark(textElement); 
        } else {
            textElement.innerText = "Brak iskierek w bazie."; 
        }
    } catch (err) { 
        console.error("Błąd wczytywania iskierek:", err); 
        textElement.innerText = "Błąd ładowania iskierek."; 
    } 
}

function changeSpark(textElement) { 
    if (!sparksFromDB.length || !textElement) return; 
    const newSpark = sparksFromDB[Math.floor(Math.random() * sparksFromDB.length)]; 
    textElement.style.opacity = 0; 
    setTimeout(() => { 
        textElement.innerText = newSpark; 
        textElement.style.opacity = 1; 
    }, 300); 
}

// --- LOGIKA ODTWARZACZA YOUTUBE ---
function getVideoId(url) { 
    if (!url) return null; 
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; 
    const matches = url.match(regex); 
    return matches ? matches[1] : null; 
}

const tag = document.createElement('script'); 
tag.src = "https://www.youtube.com/iframe_api"; 
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = function() { 
    player = new YT.Player('youtube-player', { 
        height: '0', 
        width: '0', 
        playerVars: { 'playsinline': 1, 'origin': window.location.origin }, 
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange } 
    }); 
};

async function onPlayerReady(event) { 
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
    const btn = document.getElementById('play-pause-btn'), icon = btn ? btn.querySelector('i') : null; 
    if(icon) icon.className = (event.data === YT.PlayerState.PLAYING) ? 'fas fa-pause' : 'fas fa-play'; 
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

// --- LOGIKA DISQUS ---
function initializeDisqus() { 
    const disqusThread = document.getElementById('disqus_thread');
    if (!disqusThread) return;
    (function() { 
        var d = document, s = d.createElement('script'); 
        s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js'; 
        s.setAttribute('data-timestamp', +new Date()); 
        (d.head || d.body).appendChild(s); 
    })(); 
}

// --- LOGIKA DYNAMICZNEGO KONTENTU ("WIZYTÓWKI") ---
async function loadLatarniaContent() {
    const mainContent = document.getElementById('main-content');
    const dynamicContainer = document.getElementById('dynamic-content-container');
    if (!mainContent || !dynamicContainer) return;

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

// --- GŁÓWNY PUNKT STARTOWY APLIKACJI ---
document.addEventListener("DOMContentLoaded", () => {
    // Definicje elementów
    const menuContainer = document.getElementById('main-menu');
    const entriesContainer = document.getElementById("entries-container");
    const sparkTextElement = document.getElementById("sparkText");
    const sparkButton = document.getElementById("sparkButton");
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const loadLatarniaButton = document.getElementById('load-latarnia-btn');

    // Inicjalizacja funkcji
    fetchAndRenderMenu(menuContainer);
    fetchLatarniaNadziei(entriesContainer);
    fetchSparks(sparkTextElement);
    initializeDisqus();

    // Podpięcie eventów
    if (sparkButton && sparkTextElement) {
        sparkButton.addEventListener("click", () => changeSpark(sparkTextElement));
        setInterval(() => changeSpark(sparkTextElement), 20000);
    }
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (nextBtn) nextBtn.addEventListener("click", nextSong);
    if (prevBtn) prevBtn.addEventListener("click", prevSong);
    if (loadLatarniaButton) {
        loadLatarniaButton.addEventListener('click', loadLatarniaContent);
    }
});
