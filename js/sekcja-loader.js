import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, doc, updateDoc, increment, addDoc, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// --- Konfiguracja Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.app",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app", // ✅ Poprawny bucket
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};

// --- Inicjalizacja Aplikacji ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app, "gs://projekt-latarnia.firebasestorage.app");

// ==========================================================
// 🎵 CONFIG HYMNU 🎵
// ==========================================================
const HYMN_URL = "audio/hymn.mp3"; 

// ========================================
// Moduł Odtwarzacza Muzyki (MusicPlayer - Hymn)
// ========================================
const MusicPlayer = (() => {
    let audio = null;
    let isPlaying = false;
    let btnElement = null;

    const init = () => {
        audio = new Audio(HYMN_URL);
        audio.loop = true; 
        
        const style = document.createElement('style');
        style.innerHTML = `
            .hymn-wrapper { position: fixed; bottom: 25px; right: 25px; z-index: 9999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .hymn-btn-3d { position: relative; width: 65px; height: 65px; border-radius: 50%; border: none; background: linear-gradient(145deg, #ffd97b, #c5a059); box-shadow: 0 6px 0 #8c7035, 0 12px 20px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.5); cursor: pointer; transition: all 0.1s; display: flex; justify-content: center; align-items: center; font-size: 24px; color: #222; outline: none; }
            .hymn-btn-3d:active { box-shadow: 0 0 0 #8c7035, inset 0 4px 10px rgba(0,0,0,0.3); transform: translateY(6px); }
            .hymn-btn-3d i { filter: drop-shadow(0 1px 1px rgba(255,255,255,0.4)); transition: transform 0.3s; }
            .hymn-label { background: rgba(0,0,0,0.85); color: #ffd97b; padding: 4px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; opacity: 0; transition: opacity 0.3s; pointer-events: none; white-space: nowrap; border: 1px solid rgba(255, 217, 123, 0.2); }
            .hymn-wrapper:hover .hymn-label { opacity: 1; }
            .pulse-ring { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 0 0 0 rgba(255, 217, 123, 0.6); animation: pulse-gold 2s infinite; z-index: -1; display: none; }
            @keyframes pulse-gold { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 217, 123, 0.6); } 70% { transform: scale(1.6); box-shadow: 0 0 0 25px rgba(255, 217, 123, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 217, 123, 0); } }
        `;
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.className = 'hymn-wrapper';
        wrapper.innerHTML = `<span class="hymn-label">Hymn</span><div class="pulse-ring" id="hymn-pulse"></div><button class="hymn-btn-3d" id="hymn-btn" aria-label="Odtwórz Hymn"><i class="fas fa-music"></i></button>`;
        document.body.appendChild(wrapper);

        btnElement = document.getElementById('hymn-btn');
        btnElement.addEventListener('click', togglePlay);
    };

    const togglePlay = () => { if (isPlaying) stop(); else play(); };

    const play = () => {
        if (!audio) return;
        // Zatrzymujemy inne źródła dźwięku (lektor, audio sekcja)
        if (typeof lektor !== 'undefined') lektor.stop();
        const hiddenPlayer = document.getElementById('hiddenPlayer');
        if (hiddenPlayer) { hiddenPlayer.pause(); }
        
        document.querySelectorAll('[data-action="lector-play-pause"]').forEach(btn => { btn.innerHTML = `<i class="fas fa-play"></i> Odsłuchaj`; });
        
        audio.play().then(() => { isPlaying = true; updateUI(true); }).catch(e => { console.error("Błąd audio:", e); alert("Brak pliku audio/hymn.mp3"); });
    };

    const stop = () => { if (!audio) return; audio.pause(); isPlaying = false; updateUI(false); };

    const updateUI = (playing) => {
        const icon = btnElement.querySelector('i');
        const pulse = document.getElementById('hymn-pulse');
        if (playing) { icon.className = 'fas fa-pause'; pulse.style.display = 'block'; }
        else { icon.className = 'fas fa-music'; pulse.style.display = 'none'; }
    };

    return { init, stop, play };
})();

// ========================================
// Moduł Lektora
// ========================================
const lektor = (() => {
    let queue = [];
    let currentUtterance = null;
    let isPaused = false;
    let selectedVoice = null;

    const stripHtml = (html = "") => { const div = document.createElement("div"); div.innerHTML = html; return div.textContent || div.innerText || ""; };
    const numToWords = (num) => { if (num > 999999) return num.toString(); const ones = ["zero","jeden","dwa","trzy","cztery","pięć","sześć","siedem","osiem","dziewięć"]; const teens = ["dziesięć","jedenaście","dwanaście","trzynaście","czternaście","piętnaście","szesnaście","siedemnaście","osiemnaście","dziewiętnaście"]; const tens = ["","dziesięć","dwadzieścia","trzydzieści","czterdzieści","pięćdziesiąt","sześćdziesiąt","siedemdziesiąt","osiemdziesiąt","dziewięćdziesiąt"]; const hundreds = ["","sto","dwieście","trzysta","czterysta","pięćset","sześćset","siedemset","osiemset","dziewięćset"]; if (num < 10) return ones[num]; if (num < 20) return teens[num-10]; if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : ""); if (num < 1000) return hundreds[Math.floor(num/100)] + (num%100 ? " " + numToWords(num%100) : ""); if (num < 2000) return "tysiąc " + (num%1000 ? numToWords(num%1000) : ""); const thousands = Math.floor(num/1000); let thousandsStr = ""; if ([2,3,4].includes(thousands % 10) && ![12,13,14].includes(thousands % 100)) thousandsStr = numToWords(thousands) + " tysiące"; else thousandsStr = numToWords(thousands) + " tysięcy"; return thousandsStr + (num%1000 ? " " + numToWords(num%1000) : ""); };
    const parseDate = (str) => { const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (!match) return null; const [_, d, m, y] = match.map(Number); const months = ["","stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"]; return `${numToWords(d)} ${months[m]} ${numToWords(y)} roku`; };
    const parseTime = (str) => { const match = str.match(/^(\d{1,2}):(\d{2})$/); if (!match) return null; const [_, h, m] = match.map(Number); if (m === 0) return `${numToWords(h)} zero zero`; return `${numToWords(h)} ${numToWords(m)}`; };
    const normalizeText = (input = "") => { let text = stripHtml(input); const replacements = { "np.": "na przykład", "itd.": "i tak dalej", "itp.": "i tym podobne", "m.in.": "między innymi", "tj.": "to jest", "dr ": "doktor ", "prof.": "profesor", "ul.": "ulica", "mr ": "mister ", "mrs ": "missis " }; for (const [abbr, full] of Object.entries(replacements)) { text = text.replace(new RegExp("\\b" + abbr.replace(".", "\\.") + "\\b", "gi"), full); } text = text.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, (d) => parseDate(d) || d); text = text.replace(/\b\d{1,2}:\d{2}\b/g, (t) => parseTime(t) || t); text = text.replace(/\b\d+\b/g, (n) => { const num = parseInt(n, 10); return isNaN(num) ? n : numToWords(num); }); return text.replace(/\s+/g, " ").trim(); };
    const splitText = (text, maxLen = 250) => { const parts = []; if (!text) return parts; const sentences = text.match(/[^.!?]+[.!?]*/g) || []; let chunk = ""; for (const s of sentences) { if ((chunk + " " + s).length > maxLen) { if (chunk) parts.push(chunk.trim()); chunk = s; } else { chunk += " " + s; } } if (chunk.trim()) parts.push(chunk.trim()); return parts.filter(p => p); };
    const initVoices = () => { const voices = window.speechSynthesis.getVoices(); selectedVoice = voices.find(v => v.lang === "pl-PL") || voices[0]; }; window.speechSynthesis.onvoiceschanged = initVoices; initVoices();

    const speakNext = () => {
        if (isPaused || queue.length === 0) { currentUtterance = null; return; }
        const text = queue.shift();
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = "pl-PL";
        if (selectedVoice) currentUtterance.voice = selectedVoice;
        currentUtterance.rate = 0.9;
        currentUtterance.onend = () => { currentUtterance = null; if (!isPaused) speakNext(); };
        window.speechSynthesis.speak(currentUtterance);
    };

    const enqueue = (rawText) => { if (!rawText) return; MusicPlayer.stop(); stop(); const clean = normalizeText(rawText); const parts = splitText(clean); queue.push(...parts); speakNext(); };
    const stop = () => { isPaused = false; queue = []; currentUtterance = null; window.speechSynthesis.cancel(); };
    const pause = () => { if (window.speechSynthesis.speaking && !isPaused) { window.speechSynthesis.pause(); isPaused = true; } };
    const resume = () => { if (!isPaused) return; MusicPlayer.stop(); isPaused = false; if (window.speechSynthesis.paused) window.speechSynthesis.resume(); else if (queue.length > 0 && !window.speechSynthesis.speaking) speakNext(); };
    const getStatus = () => ({ speaking: window.speechSynthesis.speaking, paused: isPaused });
    return { enqueue, stop, pause, resume, getStatus };
})();

// ========================================
// Główny obiekt aplikacji SectionLoader
// ========================================
const SectionLoader = {
    state: { sectionName: '', currentLectorTarget: null, cleanupFunctions: [] },
    elements: { wrapper: document.getElementById('content-wrapper') },
    utils: {
        escapeHtml: (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        stripHtml: (s = '') => String(s).replace(/<[^>]*>?/gm, ''),
        likedPostsKey: 'latarniaLikedPosts',
        getLikedPosts: () => { try { const liked = localStorage.getItem(SectionLoader.utils.likedPostsKey); return liked ? JSON.parse(liked) : []; } catch (e) { return []; } },
        addLikedPost: (docId) => { try { const liked = SectionLoader.utils.getLikedPosts(); if (docId && !liked.includes(docId)) { liked.push(docId); localStorage.setItem(SectionLoader.utils.likedPostsKey, JSON.stringify(liked)); } } catch (e) {} }
    },
    router: {
        // ✅ NOWA TRASA DLA AUDIO
        'Głos Latarni': { fetcher: 'fetchNoOp', renderer: 'renderAudioSection', theme: 'theme-audio' },
        'Piciorys Chudego': { fetcher: 'fetchSingleEntry', renderer: 'renderPiciorys', theme: 'theme-piciorys' },
        'Z punktu widzenia księżniczki': { fetcher: 'fetchSingleEntry', renderer: 'renderKsiezniczka', theme: 'theme-ksiezniczka' },
        'Pomoc': { fetcher: 'fetchAllHelpEntries', renderer: 'renderPomoc', theme: 'theme-pomoc' },
        'List w Butelce': { fetcher: 'fetchNoOp', renderer: 'renderBottleSection', theme: 'theme-bottle' },
        'Galeria': { fetcher: 'fetchNoOp', renderer: 'renderGallery', theme: 'theme-gallery' },
        'Wsparcie': { fetcher: 'fetchNoOp', renderer: 'renderSupportSection', theme: 'theme-support' },
        'support.html': { fetcher: 'fetchNoOp', renderer: 'renderSupportSection', theme: 'theme-support' },
        'Sekcja.html': { fetcher: 'fetchNoOp', renderer: 'renderSupportSection', theme: 'theme-support' },
        '__default__': { fetcher: 'fetchAllEntries', renderer: 'renderStandard', queryOptions: [orderBy('createdAt', 'desc')], theme: 'theme-kronika' }
    },

    async init() {
        MusicPlayer.init();
        this.state.cleanupFunctions.forEach(cleanup => cleanup());
        this.state.cleanupFunctions = [];
        this.setupEventListeners();
        try {
            const params = new URLSearchParams(window.location.search);
            this.state.sectionName = decodeURIComponent(params.get('nazwa') || 'Kronika').trim();
            const routeConfig = this.router[this.state.sectionName] || this.router['__default__'];
            if (!routeConfig) throw new Error(`Brak konfiguracji dla sekcji: "${this.state.sectionName}"`);
            document.documentElement.className = routeConfig.theme;
            document.title = `${this.utils.escapeHtml(this.state.sectionName)} — Latarnia Nadziei`;
            const data = await this.fetch[routeConfig.fetcher].call(this, routeConfig.queryOptions);
            this.render[routeConfig.renderer].call(this, data);
        } catch (error) {
            console.error('Błąd krytyczny w SectionLoader:', error);
            this.render.renderError.call(this, 'Błąd Krytyczny', 'Wystąpił problem z ładowaniem sekcji.');
        }
    },

    setupEventListeners() {
        this.elements.wrapper.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            const article = button.closest('[data-doc-id]');
            const docId = article ? article.dataset.docId : null;

            switch (action) {
                case 'like':
                    if (button.disabled || (docId && this.utils.getLikedPosts().includes(docId))) return;
                    button.disabled = true;
                    try {
                        const collectionName = (['Wsparcie','support.html','Sekcja.html'].includes(this.state.sectionName)) ? 'support_stories' : `sekcje/${this.state.sectionName}/entries`;
                        const ref = doc(db, collectionName, docId);
                        await updateDoc(ref, { likes: increment(1) });
                        this.utils.addLikedPost(docId);
                        const counter = article.querySelector('[data-likes-counter]');
                        if(counter) {
                            const currentLikes = parseInt(counter.innerText.match(/\d+/)[0] || 0);
                            counter.innerHTML = `<i class="fas fa-heart"></i> Polubienia: ${currentLikes + 1}`;
                        }
                        button.innerHTML = `<i class="fas fa-check"></i> Polubiono`;
                    } catch (error) { button.disabled = false; }
                    break;
                case 'read-more':
                    const content = button.closest('.story-item').querySelector('.full-content');
                    if (content) {
                        const isHidden = content.style.display === 'none' || !content.style.display;
                        content.style.display = isHidden ? 'block' : 'none';
                        button.textContent = isHidden ? 'Ukryj' : 'Czytaj Dalej';
                        // Zlicz wyświetlenie przy rozwinięciu
                        if(isHidden && docId) {
                            try { await updateDoc(doc(db, `sekcje/${this.state.sectionName}/entries`, docId), { views: increment(1) }); } catch(e){}
                        }
                    }
                    break;
                case 'lector-play-pause':
                    const targetId = button.dataset.target;
                    const lectorStatus = lektor.getStatus();
                    if (lectorStatus.speaking && !lectorStatus.paused && this.state.currentLectorTarget === targetId) {
                        lektor.pause();
                        button.innerHTML = `<i class="fas fa-play"></i> Wznów`;
                    } else if (lectorStatus.paused && this.state.currentLectorTarget === targetId) {
                        lektor.resume();
                        button.innerHTML = `<i class="fas fa-pause"></i> Pauza`;
                    } else {
                        const textContainer = button.closest('[data-text]');
                        if (textContainer && textContainer.dataset.text) {
                            document.querySelectorAll('[data-action="lector-play-pause"]').forEach(btn => btn.innerHTML = `<i class="fas fa-play"></i> Odsłuchaj`);
                            lektor.enqueue(textContainer.dataset.text);
                            this.state.currentLectorTarget = targetId;
                            button.innerHTML = `<i class="fas fa-pause"></i> Pauza`;
                        }
                    }
                    break;
            }
        });
    },
    
    fetch: {
        async fetchNoOp() { return null; },
        async fetchSingleEntry() { const ref = collection(db, 'sekcje', this.state.sectionName, 'entries'); const q = query(ref, limit(1)); const snapshot = await getDocs(q); return snapshot.empty ? null : snapshot.docs[0]; },
        async fetchAllEntries(queryOptions = []) { const ref = collection(db, `sekcje/${this.state.sectionName}/entries`); const q = query(ref, ...queryOptions); const snapshot = await getDocs(q); return snapshot.docs; },
        async fetchAllHelpEntries() { const q = query(collection(db, 'help'), orderBy('name', 'asc')); const snapshot = await getDocs(q); return snapshot.docs; }
    },

    async incrementViews(docId) { 
        if (!docId) return; 
        const collectionName = (['Wsparcie','support.html','Sekcja.html'].includes(this.state.sectionName)) ? 'support_stories' : `sekcje/${this.state.sectionName}/entries`;
        const ref = doc(db, collectionName, docId);
        try { await updateDoc(ref, { views: increment(1) }); } catch (e) {} 
    },

    render: {
        // ===========================================
        // 🎙️ RENDER: GŁOS LATARNI (AUDIO)
        // ===========================================
        async renderAudioSection() {
            this.elements.wrapper.innerHTML = `
                <style>
                  .audio-wrap { max-width: 800px; margin: 0 auto; padding: 40px 20px 100px; text-align: left; }
                  .audio-header { margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; }
                  .audio-header h1 { font-family: 'Cinzel', serif; color: #ffd97b; font-size: 2.2rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
                  .audio-header p { color: rgba(255,255,255,0.7); font-size: 1.1rem; margin: 0; line-height: 1.5; }
                  
                  .audio-category { margin-bottom: 40px; }
                  .audio-category h2 { color: #fff; opacity: 0.5; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; border-left: 3px solid #ffd97b; padding-left: 10px; }
                  
                  .audio-btn { 
                      background: #151515; 
                      border-left: 4px solid #333; 
                      padding: 18px 20px; 
                      margin-bottom: 12px; 
                      border-radius: 6px; 
                      cursor: pointer; 
                      transition: all 0.2s ease; 
                      display: flex; 
                      align-items: center; 
                      gap: 15px;
                      position: relative;
                      overflow: hidden;
                  }
                  .audio-btn:hover { background: #1f1f1f; transform: translateX(5px); }
                  .audio-btn.playing { 
                      border-left-color: #ff3b3b; 
                      background: #220a0a; 
                      box-shadow: 0 0 15px rgba(255, 59, 59, 0.1); 
                  }
                  .audio-btn.playing .audio-icon { color: #ff3b3b; animation: pulse-icon 1.5s infinite; }
                  
                  .audio-icon { font-size: 1.5rem; color: #555; transition: color 0.3s; min-width: 30px; text-align: center; }
                  .audio-content { flex-grow: 1; }
                  .audio-title { font-size: 1.1rem; font-weight: 700; color: #e0e0e0; margin-bottom: 4px; }
                  .audio-desc { font-size: 0.85rem; color: #888; }
                  
                  @keyframes pulse-icon { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                  
                  .list-empty { padding: 40px; text-align: center; color: #555; font-style: italic; }
                </style>

                <div class="audio-wrap">
                    <header class="audio-header">
                        <h1>Głos Latarni</h1>
                        <p>Jeśli nie masz siły czytać — kliknij i słuchaj. Tu nikt Cię nie ocenia.</p>
                    </header>
                    
                    <div id="audioCategories" class="audio-list">
                        <div class="list-empty"><i class="fas fa-spinner fa-spin"></i> Ładowanie głosu...</div>
                    </div>
                    
                    <audio id="hiddenPlayer" style="display:none;"></audio>
                </div>
            `;

            const container = document.getElementById('audioCategories');
            const player = document.getElementById('hiddenPlayer');
            let currentTrackPath = null;
            let currentBtn = null;

            // Logika odtwarzania
            const handlePlay = (track, btn) => {
                // Jeśli kliknięto to samo, co gra -> STOP
                if (currentTrackPath === track.filePath) {
                    stopAudio();
                    return;
                }
                
                // Jeśli gra coś innego -> STOP tamtego i START nowego
                stopAudio();
                
                MusicPlayer.stop(); // Zatrzymaj hymn jeśli gra
                if(typeof lektor !== 'undefined') lektor.stop(); // Zatrzymaj lektora

                // Start nowego - obsługa Storage i URL
                if (track.url) {
                    player.src = track.url;
                    player.play().catch(e => alert("Błąd odtwarzania: " + e.message));
                    
                    currentTrackPath = track.filePath;
                    currentBtn = btn;
                    btn.classList.add('playing');
                    const icon = btn.querySelector('.audio-icon i');
                    if(icon) { icon.className = 'fas fa-stop'; }

                } else if (track.filePath) {
                    const fileRef = ref(storage, track.filePath);
                    getDownloadURL(fileRef).then(url => {
                        player.src = url;
                        player.play().catch(e => alert("Błąd odtwarzania: " + e.message));
                    }).catch(err => {
                        alert("Nie można pobrać pliku audio");
                        console.error(err);
                    });

                    currentTrackPath = track.filePath;
                    currentBtn = btn;
                    btn.classList.add('playing');
                    const icon = btn.querySelector('.audio-icon i');
                    if(icon) { icon.className = 'fas fa-stop'; }
                }
            };

            const stopAudio = () => {
                player.pause();
                player.currentTime = 0;
                currentTrackPath = null;
                
                if (currentBtn) {
                    currentBtn.classList.remove('playing');
                    const icon = currentBtn.querySelector('.audio-icon i');
                    if(icon) { icon.className = 'fas fa-play'; }
                    currentBtn = null;
                }
            };

            player.onended = stopAudio;

            // Pobieranie danych z Firestore
            const q = query(
              collection(db, 'audio_tracks'),
              orderBy('category'),
              orderBy('order')
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    container.innerHTML = '<div class="list-empty">Jeszcze nic tu nie ma.</div>';
                    return;
                }

                const tracks = snapshot.docs.map(d => d.data());
                
                // Grupowanie
                const grouped = tracks.reduce((acc, track) => {
                    const cat = track.category || 'inne';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(track);
                    return acc;
                }, {});

                // Renderowanie
                container.innerHTML = '';
                
                const catNames = {
                    'ratunek': '🆘 Ratunek Teraz',
                    'medytacje': '🧘 Medytacje i Oddech',
                    'wiedza': '🧠 Wiedza',
                    'historie': '🔥 Historie'
                };

                for (const [cat, items] of Object.entries(grouped)) {
                    const section = document.createElement('div');
                    section.className = 'audio-category';
                    section.innerHTML = `<h2>${catNames[cat] || cat}</h2>`;
                    
                    items.forEach(track => {
                        const btn = document.createElement('div');
                        btn.className = 'audio-btn';
                        // Jeśli to ten przycisk aktualnie gra (przy odświeżeniu), zachowaj stan (opcjonalne, tu prosty reset)
                        
                        btn.innerHTML = `
                            <div class="audio-icon"><i class="fas fa-play"></i></div>
                            <div class="audio-content">
                                <div class="audio-title">${this.utils.escapeHtml(track.title)}</div>
                                ${track.description ? `<div class="audio-desc">${this.utils.escapeHtml(track.description)}</div>` : ''}
                            </div>
                        `;
                        
                        btn.onclick = () => handlePlay(track, btn);
                        section.appendChild(btn);
                    });
                    
                    container.appendChild(section);
                }
            });
            
            this.state.cleanupFunctions.push(unsubscribe);
            // Dodatkowo cleanup playera przy wyjściu z sekcji
            this.state.cleanupFunctions.push(() => stopAudio());
        },

        async renderSupportSection() {
            this.elements.wrapper.innerHTML = `
                <style>
                  .support-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 48px 18px 140px; position: relative; overflow-x: hidden; }
                  .support-header { z-index: 8; text-align: center; margin-bottom: 30px; position: relative; }
                  .support-header h1 { font-size: 2.4rem; letter-spacing: 2px; margin: 0; text-transform: uppercase; color: #ffd97b; text-shadow: 0 0 20px rgba(255, 217, 123, 0.4), 2px 2px 4px rgba(0,0,0,0.8); font-family: 'Cinzel', serif; }
                  .support-header p.lead { margin: 15px 0 0; color: rgba(255,255,255,0.9); font-size: 1.1rem; max-width: 800px; line-height: 1.6; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
                  
                  .support-form { width: 100%; max-width: 820px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 25px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.15); display: flex; flex-direction: column; gap: 15px; z-index: 12; position: relative; margin-bottom: 40px; }
                  .support-form input, .support-form textarea { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0, 0, 0, 0.3); color: #fff; font-size: 1.05rem; outline: none; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); box-sizing: border-box; font-family: inherit; }
                  .support-form input::placeholder, .support-form textarea::placeholder { color: rgba(255,255,255,0.5); }
                  .support-form input:focus, .support-form textarea:focus { border-color: #ffd97b; box-shadow: 0 0 15px rgba(255, 217, 123, 0.2); background: rgba(0, 0, 0, 0.5); }
                  .support-form textarea { min-height: 140px; resize: vertical; }
                  
                  .meta-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 5px; }
                  .note { color: rgba(255,255,255,0.7); font-size: 0.9rem; font-style: italic; }
                  .btn { background: linear-gradient(135deg, #ffd97b 0%, #b8860b 100%); color: #1a1a1a; border: none; padding: 12px 25px; border-radius: 30px; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(255, 217, 123, 0.3); transition: transform 0.2s, box-shadow 0.2s; }
                  .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255, 217, 123, 0.5); }
                  .btn:disabled { background: #555; cursor: not-allowed; opacity: 0.7; }
                  
                  .feed { width: 100%; max-width: 820px; display: flex; flex-direction: column; gap: 25px; z-index: 12; }
                  .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 25px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); transition: transform 0.3s ease, opacity 0.5s ease; opacity: 0; transform: translateY(20px); position: relative; overflow: hidden; }
                  .card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%); pointer-events: none; }
                  .card.show { opacity: 1; transform: translateY(0); }
                  .card h3 { margin: 0 0 12px; font-size: 1.3rem; color: #ffd97b; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.5); letter-spacing: 0.5px; }
                  .card p { margin: 0; color: rgba(255,255,255,0.95); line-height: 1.6; font-size: 1.05rem; white-space: pre-wrap; font-family: 'Georgia', serif; }
                  
                  .meta { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 0.9rem; }
                  .like-btn { transition: color 0.3s; display: flex; align-items: center; gap: 6px; }
                  .like-btn:hover { color: #ff6b6b; }
                  
                  .card-actions { margin-top: 15px; display: flex; justify-content: flex-end; gap: 12px; }
                  .card-action-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(4px); }
                  .card-action-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-1px); border-color: rgba(255,255,255,0.4); }
                  
                  .comments-wrapper { margin-top: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 15px; display: none; border: 1px solid rgba(255,255,255,0.05); }
                  .comment { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 10px; }
                  .comment:last-child { border-bottom: none; margin-bottom: 0; }
                  .comment-author { font-weight: 700; color: #ffd97b; margin: 0 0 4px 0; font-size: 0.9rem; }
                  .comment-text { font-size: 0.95rem; line-height: 1.5; color: rgba(255,255,255,0.9); margin: 0; }
                  
                  .comment-form { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
                  .comment-form input, .comment-form textarea { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; padding: 10px; color: white; border-radius: 8px; }
                  .comment-form textarea { min-height: 60px; }
                </style>
                
                <div class="support-wrap">
                    <header class="support-header">
                        <h1>Podziel się swoją historią lub wesprzyj innych</h1>
                        <p class="lead">Twoje doświadczenie ma znaczenie. Anonimowo lub nie – każde słowo wsparcia jest bezcenne.</p>
                    </header>
                    
                    <form id="supportForm" class="support-form" aria-label="Formularz dodawania historii">
                        <input id="supportName" placeholder="Twoje imię lub pseudonim (wymagane)" autocomplete="name" required />
                        <textarea id="supportStory" placeholder="Twoja historia... (wymagane)" required></textarea>
                        <div class="meta-row">
                            <div class="note">Twoje słowa mogą być dla kogoś latarnią.</div>
                            <button class="btn" type="submit">Opublikuj</button>
                        </div>
                    </form>
                    
                    <div id="feed" class="feed" aria-live="polite"></div>
                </div>`;

            const feed = document.getElementById('feed');
            const form = document.getElementById('supportForm');
            const { escapeHtml, getLikedPosts, addLikedPost } = SectionLoader.utils;
            
            const renderCard = (item, docId) => {
                const card = document.createElement('article');
                card.className = 'card';
                card.dataset.text = `${item.name}. ${item.text}`;
                card.dataset.docId = docId;
                
                const dateString = item.t ? new Date(item.t.toDate()).toLocaleString('pl-PL') : 'Przed chwilą';
                
                card.innerHTML = `
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.text)}</p>
                    <div class="meta">
                        <span>${dateString}</span>
                        <span title="Polub" class="like-btn" style="cursor: pointer;" data-likes-counter>❤️ <span class="like-count">${item.likes || 0}</span></span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn" data-action="lector-play-pause" data-target="${docId}"><i class="fas fa-play"></i> Odsłuchaj</button>
                        <button class="card-action-btn toggle-comments-btn"><i class="fas fa-comments"></i> Komentarze</button>
                    </div>
                    
                    <div class="comments-wrapper">
                        <div class="comments-list"></div>
                        <form class="comment-form">
                            <input type="text" class="comment-author-input" placeholder="Twoje imię" required>
                            <textarea class="comment-text-input" placeholder="Napisz komentarz..." rows="2" required></textarea>
                            <button type="submit" class="card-action-btn" style="align-self: flex-end;">Wyślij</button>
                        </form>
                    </div>
                `;
                feed.prepend(card);
                setTimeout(() => card.classList.add('show'), 50);

                const likeBtn = card.querySelector('.like-btn');
                if (getLikedPosts().includes(docId)) {
                    likeBtn.style.pointerEvents = 'none';
                    likeBtn.style.cursor = 'default';
                    likeBtn.title = 'Już polubiono';
                    likeBtn.style.color = '#ff6b6b';
                }

                likeBtn.addEventListener('click', async () => {
                    if (getLikedPosts().includes(docId)) return;
                    likeBtn.style.pointerEvents = 'none';
                    const ref = doc(db, 'support_stories', docId);
                    try { 
                        await updateDoc(ref, { likes: increment(1) });
                        addLikedPost(docId);
                        likeBtn.style.color = '#ff6b6b';
                        const likeCountSpan = likeBtn.querySelector('.like-count');
                        const currentLikes = parseInt(likeCountSpan.textContent, 10);
                        likeCountSpan.textContent = currentLikes + 1;
                    } catch(e){ console.error(e); likeBtn.style.pointerEvents = 'auto'; }
                });
                
                const toggleCommentsBtn = card.querySelector('.toggle-comments-btn');
                const commentsWrapper = card.querySelector('.comments-wrapper');
                const commentsList = card.querySelector('.comments-list');
                const commentForm = card.querySelector('.comment-form');
                let commentsLoaded = false;

                toggleCommentsBtn.addEventListener('click', () => {
                    const isHidden = commentsWrapper.style.display === 'none' || !commentsWrapper.style.display;
                    commentsWrapper.style.display = isHidden ? 'block' : 'none';
                    if (isHidden && !commentsLoaded) {
                        loadComments();
                        commentsLoaded = true;
                    }
                });

                const loadComments = () => {
                    const commentsRef = collection(db, 'support_stories', docId, 'comments');
                    const q = query(commentsRef, orderBy('t', 'asc'));
                    const unsubscribe = onSnapshot(q, (snapshot) => {
                        commentsList.innerHTML = '';
                        snapshot.forEach(commentDoc => {
                            const cData = commentDoc.data();
                            const commentEl = document.createElement('div');
                            commentEl.className = 'comment';
                            commentEl.innerHTML = `<div class="comment-author">${escapeHtml(cData.author)}</div><p class="comment-text">${escapeHtml(cData.text)}</p>`;
                            commentsList.append(commentEl);
                        });
                        if(snapshot.empty) commentsList.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.5); font-style:italic;">Brak komentarzy. Bądź pierwszy!</div>';
                    });
                    this.state.cleanupFunctions.push(unsubscribe);
                };

                commentForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const authorInput = commentForm.querySelector('.comment-author-input');
                    const textInput = commentForm.querySelector('.comment-text-input');
                    const submitBtn = commentForm.querySelector('button');
                    if (!authorInput.value.trim() || !textInput.value.trim()) return;
                    
                    submitBtn.disabled = true;
                    const commentsRef = collection(db, 'support_stories', docId, 'comments');
                    try {
                        await addDoc(commentsRef, { author: authorInput.value.trim(), text: textInput.value.trim(), t: serverTimestamp() });
                        commentForm.reset();
                    } catch (error) {
                        alert("Błąd dodawania komentarza.");
                    } finally {
                        submitBtn.disabled = false;
                    }
                });
            };
            
            const q = query(collection(db, "support_stories"), where("isApproved", "==", true), orderBy("t", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                feed.innerHTML = '';
                snapshot.forEach(doc => { renderCard(doc.data(), doc.id); });
                if (feed.children.length === 0) {
                    feed.innerHTML = `<p style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.5);">Brak wpisów. Bądź pierwszą osobą, która podzieli się wsparciem!</p>`;
                }
            });

            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const name = document.getElementById('supportName').value.trim();
                const text = document.getElementById('supportStory').value.trim();
                if (!name || !text) return alert("Wypełnij wszystkie pola.");
                const btn = form.querySelector('.btn');
                btn.disabled = true;
                btn.textContent = 'Wysyłanie...';
                try {
                    await addDoc(collection(db, "support_stories"), { name, text, t: serverTimestamp(), isApproved: false, likes: 0 });
                    form.reset();
                    alert("Dziękujemy! Twój wpis został wysłany i czeka na akceptację.");
                } catch (e) {
                    alert('Wystąpił błąd.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Opublikuj';
                }
            });
            this.state.cleanupFunctions.push(unsubscribe);
        },
        
        renderBottleSection() { this.render.renderError.call(this, "List w Butelce", "Sekcja wczytana poprawnie."); },
        renderPiciorys(doc) {
             if (!doc) return this.render.renderEmpty.call(this, "Nie znaleziono wpisu.");
            const e = doc.data();
            const { escapeHtml } = this.utils;
            const introText = (e.text || '').split('---PODZIAL---')[0] || "";
            const mainText = (e.text || '').split('---PODZIAL---')[1] || "";
            this.elements.wrapper.innerHTML = `
              <div class="log-container" data-doc-id="${doc.id}">
                  <div id="piciorys-intro" data-text="${escapeHtml(e.introTitle)}. ${escapeHtml(introText)}">
                      <h2 class="log-title">${escapeHtml(e.introTitle || "Nazywam się Alkohol")}</h2>
                      <div class="log-content" id="intro-content-target"></div>
                      <div class="log-actions">
                          <button class="action-button" data-action="lector-play-pause" data-target="piciorys-intro"><i class="fas fa-play"></i> Odsłuchaj</button>
                          <button id="continue-btn" class="action-button"><i class="fas fa-book-open"></i> Czytaj dalej</button>
                      </div>
                  </div>
                  <div id="piciorys-main" style="display: none;" data-text="${escapeHtml(e.mainTitle)}. ${escapeHtml(mainText)}">
                      <hr class="piciorys-separator">
                      <h2 class="log-title">${escapeHtml(e.mainTitle || "Piciorys Chudego")}</h2>
                      <div class="log-meta"><span><i class="fas fa-eye"></i> ${e.views || 0}</span><span data-likes-counter><i class="fas fa-heart"></i> Polubienia: ${e.likes || 0}</span></div>
                      <div class="log-content" id="main-content-target"></div>
                      <div class="log-actions">
                          <button class="action-button" data-action="lector-play-pause" data-target="piciorys-main"><i class="fas fa-play"></i> Odsłuchaj</button>
                          <button class="action-button" data-action="like"><i class="fas fa-heart"></i> Lubię to</button>
                      </div>
                  </div>
              </div>`;
            this.modules.typewriter.start(document.getElementById('intro-content-target'), introText);
            document.getElementById('continue-btn').addEventListener('click', () => {
                lektor.stop();
                document.getElementById('piciorys-intro').style.display = 'none';
                document.getElementById('piciorys-main').style.display = 'block';
                this.modules.typewriter.start(document.getElementById('main-content-target'), mainText);
                this.incrementViews(doc.id);
            }, { once: true });
        },
        renderKsiezniczka(doc) { this.render.renderError.call(this, "Z punktu widzenia księżniczki", "Sekcja w budowie."); },
        renderPomoc(docs) { this.render.renderError.call(this, "Pomoc", "Sekcja w budowie."); },
        renderGallery() { this.render.renderError.call(this, "Galeria", "Sekcja w budowie."); },
        renderStandard(docs) {
             if (!docs || docs.length === 0) return this.render.renderEmpty.call(this);
            const { escapeHtml, stripHtml } = this.utils;
            const items = docs.map(doc => {
                const e = doc.data();
                const excerpt = stripHtml(e.text || '').substring(0, 300) + '...';
                const dateStr = e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : 'Brak daty';
                return `
                  <article class="story-item" data-doc-id="${doc.id}" data-text="${escapeHtml(e.title)}. ${escapeHtml(e.text)}">
                      <h3 class="entry-title">${escapeHtml(e.title || 'Bez tytułu')}</h3>
                      <div class="entry-meta">
                          <span><i class="fas fa-user-edit"></i> ${escapeHtml(e.author || 'Chudy')}</span>
                          <span><i class="fas fa-calendar-alt"></i> ${dateStr}</span>
                          <span data-likes-counter><i class="fas fa-heart"></i> Polubienia: ${e.likes || 0}</span>
                          <span><i class="fas fa-eye"></i> Wyświetlenia: ${e.views || 0}</span>
                      </div>
                      <div class="entry-content"><p>${excerpt}</p><div class="full-content" style="display: none;">${e.text}</div></div>
                      <div class="log-actions"><button class="action-button" data-action="read-more">Czytaj Dalej</button><button class="action-button" data-action="lector-play-pause" data-target="${doc.id}"><i class="fas fa-play"></i> Odsłuchaj</button><button class="action-button" data-action="like"><i class="fas fa-heart"></i> Lubię to</button></div>
                  </article>`;
            }).join('');
            this.elements.wrapper.innerHTML = `<div class="content-container"><h2 class="fancy-title">${escapeHtml(this.state.sectionName)}</h2><div class="story-list">${items}</div></div>`;
            docs.forEach(d => this.incrementViews(d.id));
        },
        renderError(title, message) { this.elements.wrapper.innerHTML = `<div class="content-container"><h2 class="fancy-title">${title}</h2><p>${message}</p></div>`; },
        renderEmpty(message = "Brak wpisów.") { this.render.renderError.call(this, this.state.sectionName, message); }
    },
    
    modules: {
        typewriter: {
            start(element, text, speed = 30) {
                if (!element || !text) { if (element) element.innerHTML = ""; return; }
                let i = 0; element.innerHTML = '<span class="typing-cursor"></span>';
                function type() { if (i < text.length) { element.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>') + '<span class="typing-cursor"></span>'; i++; setTimeout(type, speed); } else { element.innerHTML = text.replace(/\n/g, '<br>'); } }
                type();
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => SectionLoader.init());
