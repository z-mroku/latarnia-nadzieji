// Plik: /js/main.js (WERSJA OSTATECZNA, CZYSTA I POPRAWIONA)
import { db, auth } from './firebase-config.js'; 
import { collection, getDocs, query, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Zmienne Globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- FUNKCJE RENDERUJĄCE ---
async function fetchAndRenderMenu(container) { 
    try { 
        const snapshot = await getDocs(query(collection(db, "menu"), orderBy("order", "asc"))); 
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            // Poprawka: upewnij się, że URL jest poprawny
            const url = data.url.startsWith('http') || data.url.startsWith('#') ? data.url : `/${data.url}`;
            return `<li><a href="${url}">${data.text}</a></li>`;
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
        // Wykluczamy sekcje specjalne
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
        else songTitle.innerText = "Brak utworów w playliście."; 
    } catch (err) { 
        console.error("Błąd wczytywania playlisty:", err); 
        songTitle.innerText = "Błąd ładowania playlisty."; 
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
    (function() { 
        var d = document, s = d.createElement('script'); 
        s.src = 'https://od-dna-do-swiatla.disqus.com/embed.js'; 
        s.setAttribute('data-timestamp', +new Date()); 
        (d.head || d.body).appendChild(s); 
    })(); 
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

    // Inicjalizacja funkcji
    fetchAndRenderMenu(menuContainer);
    fetchLatarniaNadziei(entriesContainer);
    fetchSparks(sparkTextElement);
    initializeDisqus();

    // Podpięcie eventów
    sparkButton.addEventListener("click", () => changeSpark(sparkTextElement));
    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener("click", nextSong);
    prevBtn.addEventListener("click", prevSong);
});
