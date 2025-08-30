<script type="module">
    // === Importy z Firebase ===
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    
    // === Konfiguracja Firebase ===
    const firebaseConfig = {
      apiKey: "AIzaSyBklDD5GaEkHypr-gIII6Hxs7qN9R8zt_U",
      authDomain: "swiatlo-z-mroku-v2-c6381.firebaseapp.com",
      projectId: "swiatlo-z-mroku-v2-c6381",
      storageBucket: "swiatlo-z-mroku-v2-c6381.appspot.com",
      messagingSenderId: "55811472801",
      appId: "1:55811472801:web:c9d580b77fbf0d94c59fe0"
    };

    // Inicjalizacja
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // ==========================================================
    // === NOWA LOGIKA DLA DYNAMICZNEGO ODTWARZACZA ===
    // ==========================================================
    
    // Elementy odtwarzacza z pliku HTML
    const player = document.getElementById('main-player');
    const songTitleElement = document.getElementById('current-song-title');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    let playlist = [];
    let currentSongIndex = 0;

    async function fetchPlaylist() {
        const q = query(collection(db, "playlist"), orderBy("order"));
        const querySnapshot = await getDocs(q);
        playlist = querySnapshot.docs.map(doc => doc.data());
    }

    function loadSong(songIndex) {
        if (playlist.length === 0) {
            songTitleElement.textContent = "Playlista jest pusta.";
            return;
        }
        currentSongIndex = songIndex;
        const song = playlist[currentSongIndex];
        player.src = song.song_url;
        songTitleElement.textContent = `${song.artist} – ${song.title}`;
        player.play();
    }

    function playNextSong() {
        let nextIndex = currentSongIndex + 1;
        if (nextIndex >= playlist.length) {
            nextIndex = 0; // Zapętlenie
        }
        loadSong(nextIndex);
    }

    function playPrevSong() {
        let prevIndex = currentSongIndex - 1;
        if (prevIndex < 0) {
            prevIndex = playlist.length - 1; // Zapętlenie
        }
        loadSong(prevIndex);
    }

    async function initializePlayer() {
        await fetchPlaylist();
        if (playlist.length > 0) {
            const firstSong = playlist[0];
            player.src = firstSong.song_url;
            songTitleElement.textContent = `${firstSong.artist} – ${firstSong.title}`;
        }
        nextBtn.addEventListener('click', playNextSong);
        prevBtn.addEventListener('click', playPrevSong);
        player.addEventListener('ended', playNextSong);
    }

    // ==========================================================
    // === Logika dla Iskierek Nadziei (bez zmian) ===
    // ==========================================================
    const sparkTextElement = document.getElementById("sparkText");
    const sparkButton = document.querySelector(".spark-button");
    let sparksFromDB = [];

    function changeSpark() {
      // ... (cały kod dla changeSpark bez zmian) ...
    }

    async function fetchSparksFromDB() {
      // ... (cały kod dla fetchSparksFromDB bez zmian) ...
    }

    // ==========================================================
    // === Logika dla Kroniki (bez zmian) ===
    // ==========================================================
    const entriesContainer = document.getElementById("entries-container");
    async function fetchLatestEntries() {
        // ... (cały kod dla fetchLatestEntries bez zmian) ...
    }

    // ==========================================================
    // === Logika Disqus (bez zmian) ===
    // ==========================================================
    function initializeDisqus() {
        // ... (cały kod dla initializeDisqus bez zmian) ...
    }

    // ==========================================================
    // === GŁÓWNY PUNKT STARTOWY (ZAKTUALIZOWANY) ===
    // ==========================================================
    document.addEventListener('DOMContentLoaded', () => {
      fetchSparksFromDB();
      fetchLatestEntries();
      initializeDisqus();
      initializePlayer(); // Dodaliśmy inicjalizację odtwarzacza
      if(sparkButton) {
          sparkButton.addEventListener('click', changeSpark);
      }
    });
</script>
