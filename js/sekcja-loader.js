
// ========================================
//  LATARNIA NADZIEI - SECTION LOADER (FINALNA, KOMPLETNA WERSJA)
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, doc, updateDoc, increment, addDoc, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Konfiguracja Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};

// --- Inicjalizacja Aplikacji ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================================
// Moduł Lektora
// ========================================
const lektor = (() => {
    let queue = []; let currentUtterance = null; let isPaused = false; let selectedVoice = null; const stripHtml = (html = "") => { const div = document.createElement("div"); div.innerHTML = html; return div.textContent || div.innerText || ""; }; const numToWords = (num) => { if (num > 999999) return num.toString(); const ones = ["zero","jeden","dwa","trzy","cztery","pięć","sześć","siedem","osiem","dziewięć"]; const teens = ["dziesięć","jedenaście","dwanaście","trzynaście","czternaście","piętnaście","szesnaście","siedemnaście","osiemnaście","dziewiętnaście"]; const tens = ["","dziesięć","dwadzieścia","trzydzieści","czterdzieści","pięćdziesiąt","sześćdziesiąt","siedemdziesiąt","osiemdziesiąt","dziewięćdziesiąt"]; const hundreds = ["","sto","dwieście","trzysta","czterysta","pięćset","sześćset","siedemset","osiemset","dziewięćset"]; if (num < 10) return ones[num]; if (num < 20) return teens[num-10]; if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : ""); if (num < 1000) return hundreds[Math.floor(num/100)] + (num%100 ? " " + numToWords(num%100) : ""); if (num < 2000) return "tysiąc " + (num%1000 ? numToWords(num%1000) : ""); const thousands = Math.floor(num/1000); let thousandsStr = ""; if ([2,3,4].includes(thousands % 10) && ![12,13,14].includes(thousands % 100)) thousandsStr = numToWords(thousands) + " tysiące"; else thousandsStr = numToWords(thousands) + " tysięcy"; return thousandsStr + (num%1000 ? " " + numToWords(num%1000) : ""); }; const parseDate = (str) => { const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (!match) return null; const [_, d, m, y] = match.map(Number); const months = ["","stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"]; return `${numToWords(d)} ${months[m]} ${numToWords(y)} roku`; }; const parseTime = (str) => { const match = str.match(/^(\d{1,2}):(\d{2})$/); if (!match) return null; const [_, h, m] = match.map(Number); if (m === 0) return `${numToWords(h)} zero zero`; return `${numToWords(h)} ${numToWords(m)}`; }; const normalizeText = (input = "") => { let text = stripHtml(input); const replacements = { "np.": "na przykład", "itd.": "i tak dalej", "itp.": "i tym podobne", "m.in.": "między innymi", "tj.": "to jest", "dr ": "doktor ", "prof.": "profesor", "ul.": "ulica", "mr ": "mister ", "mrs ": "missis " }; for (const [abbr, full] of Object.entries(replacements)) { text = text.replace(new RegExp("\\b" + abbr.replace(".", "\\.") + "\\b", "gi"), full); } const emojiMap = { "🙂": "uśmiech","😀": "szeroki uśmiech","😂": "śmiech","❤️": "serce","👍": "kciuk w górę" }; for (const [emoji, word] of Object.entries(emojiMap)) text = text.replaceAll(emoji, " " + word + " "); text = text.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, (d) => parseDate(d) || d); text = text.replace(/\b\d{1,2}:\d{2}\b/g, (t) => parseTime(t) || t); text = text.replace(/\b\d+\b/g, (n) => { const num = parseInt(n, 10); return isNaN(num) ? n : numToWords(num); }); return text.replace(/\s+/g, " ").trim(); }; const splitText = (text, maxLen = 250) => { const parts = []; if (!text) return parts; const sentences = text.match(/[^.!?]+[.!?]*/g) || []; let chunk = ""; for (const s of sentences) { if ((chunk + " " + s).length > maxLen) { if (chunk) parts.push(chunk.trim()); chunk = s; } else { chunk += " " + s; } } if (chunk.trim()) parts.push(chunk.trim()); return parts.filter(p => p); }; const pickVoice = () => { const voices = window.speechSynthesis.getVoices(); if (!voices || voices.length === 0) return null; const polishVoice = voices.find(v => v.name === "Microsoft Adam - Polish (Poland)" || v.lang === "pl-PL"); return polishVoice || voices.find(v => v.lang && v.lang.startsWith("pl")) || voices[0]; }; const initVoices = () => { selectedVoice = pickVoice(); }; window.speechSynthesis.onvoiceschanged = initVoices; initVoices(); const speakNext = () => { if (isPaused || queue.length === 0) { currentUtterance = null; return; } const text = queue.shift(); currentUtterance = new SpeechSynthesisUtterance(text); currentUtterance.lang = "pl-PL"; if (selectedVoice) currentUtterance.voice = selectedVoice; currentUtterance.rate = 0.9; currentUtterance.onend = () => { currentUtterance = null; if (!isPaused) speakNext(); }; currentUtterance.onerror = (e) => { console.error("❌ Błąd lektora:", e); currentUtterance = null; speakNext(); }; window.speechSynthesis.speak(currentUtterance); }; const enqueue = (rawText) => { if (!rawText) return; stop(); const clean = normalizeText(rawText); const parts = splitText(clean); queue.push(...parts); if (!window.speechSynthesis.speaking) { isPaused = false; speakNext(); } }; const stop = () => { isPaused = false; queue = []; window.speechSynthesis.cancel(); currentUtterance = null; }; const pause = () => { if (window.speechSynthesis.speaking && !isPaused) { window.speechSynthesis.pause(); isPaused = true; } }; const resume = () => { if (window.speechSynthesis.paused && isPaused) { window.speechSynthesis.resume(); isPaused = false; } }; const getStatus = () => ({ speaking: window.speechSynthesis.speaking, paused: isPaused }); return { enqueue, stop, pause, resume, getStatus };
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
    },
    router: {
        'Piciorys Chudego': { fetcher: 'fetchSingleEntry', renderer: 'renderPiciorys', theme: 'theme-piciorys' },
        'Z punktu widzenia księżniczki': { fetcher: 'fetchSingleEntry', renderer: 'renderKsiezniczka', theme: 'theme-ksiezniczka' },
        'Pomoc': { fetcher: 'fetchAllHelpEntries', renderer: 'renderPomoc', theme: 'theme-pomoc' },
        'List w Butelce': { fetcher: 'fetchNoOp', renderer: 'renderBottleSection', theme: 'theme-bottle' },
        'Galeria': { fetcher: 'fetchNoOp', renderer: 'renderGallery', theme: 'theme-gallery' },
        'Wsparcie': { fetcher: 'fetchNoOp', renderer: 'renderSupportSection', theme: 'theme-support' },
        'support.html': { fetcher: 'fetchNoOp', renderer: 'renderSupportSection', theme: 'theme-support' },
        '__default__': { fetcher: 'fetchAllEntries', renderer: 'renderStandard', queryOptions: [orderBy('createdAt', 'desc')], theme: 'theme-kronika' }
    },

    async init() {
        this.state.cleanupFunctions.forEach(cleanup => cleanup());
        this.state.cleanupFunctions = [];
        this.setupEventListeners();
        try {
            const params = new URLSearchParams(window.location.search);
            this.state.sectionName = decodeURIComponent(params.get('nazwa') || 'Kronika').trim();
            const routeConfig = this.router[this.state.sectionName] || this.router['__default__'];
            
            if (!routeConfig) {
                throw new Error(`Brak konfiguracji dla sekcji: "${this.state.sectionName}"`);
            }

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
                    if (button.disabled) return;
                    button.disabled = true;
                    try {
                        await this.incrementLikes(docId);
                        const counter = article.querySelector('[data-likes-counter]');
                        const currentLikes = parseInt(counter.innerText.match(/\d+/)[0] || 0);
                        counter.innerHTML = `<i class="fas fa-heart"></i> Polubienia: ${currentLikes + 1}`;
                        button.innerHTML = `<i class="fas fa-check"></i> Polubiono`;
                    } catch (error) {
                        button.disabled = false;
                    }
                    break;
                case 'read-more':
                    const content = button.closest('.story-item').querySelector('.full-content');
                    if (content) {
                        const isHidden = content.style.display === 'none' || !content.style.display;
                        content.style.display = isHidden ? 'block' : 'none';
                        button.textContent = isHidden ? 'Ukryj' : 'Czytaj Dalej';
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
                            document.querySelectorAll('[data-action="lector-play-pause"]').forEach(btn => {
                                btn.innerHTML = `<i class="fas fa-play"></i> Odsłuchaj`;
                            });
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

    async incrementViews(docId) { if (!docId) return; const ref = doc(db, 'sekcje', this.state.sectionName, 'entries', docId); try { await updateDoc(ref, { views: increment(1) }); } catch (e) {} },
    async incrementLikes(docId) { if (!docId) return; const ref = doc(db, 'sekcje', this.state.sectionName, 'entries', docId); try { await updateDoc(ref, { likes: increment(1) }); } catch (error) { console.error("Błąd przy polubieniu:", error.message); alert("Aby polubić, musisz być zalogowany."); throw error; } },

    render: {
        renderSupportSection() {
            this.elements.wrapper.innerHTML = `
            <style>
              .support-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:48px 18px 140px;position:relative;overflow-x:hidden}
              .support-header{z-index:8;text-align:center;margin-bottom:18px}
              .support-header h1{font-size:2.2rem;letter-spacing:1px;margin:0;text-transform:uppercase;color:#ffd97b;text-shadow:0 6px 30px rgba(0,0,0,0.6)}
              .support-header p.lead{margin:8px 0 0;color:rgba(255,255,255,0.85);max-width:860px}
              .support-form{width:100%;max-width:820px;background:linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.15));border-radius:14px;padding:18px;backdrop-filter:blur(10px);box-shadow:0 12px 60px rgba(0,0,0,0.8);display:flex;flex-direction:column;gap:12px;z-index:12;position:relative;border:1px solid rgba(255,255,255,0.05)}
              .support-form.enter{animation:fadeInUp .7s cubic-bezier(.2,.9,.3,1) both} @keyframes fadeInUp{from{opacity:0;transform:translateY(22px) scale(.995)}to{opacity:1;transform:translateY(0) scale(1)}}
              .support-form input, .support-form textarea{width:100%;padding:14px;border-radius:12px;border:0;background:rgba(0,0,0,0.2);color:#fff;font-size:1rem;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02);transition:box-shadow .18s, transform .12s}
              .support-form input::placeholder, .support-form textarea::placeholder{color:rgba(255,255,255,0.45)}
              .support-form input:focus, .support-form textarea:focus{box-shadow:0 6px 30px rgba(0,0,0,0.6), 0 0 26px rgba(255,217,123,0.06);transform:translateY(-2px)}
              .support-form textarea{min-height:120px;resize:vertical}
              .meta-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
              .note{color:rgba(255,255,255,0.85);font-size:.92rem}
              .btn{background:linear-gradient(180deg,#ffd97b,#ffd16a);color:#000;border:0;padding:12px 16px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 10px 36px rgba(255,217,123,0.12);transition:all .12s}
              .btn:disabled { background: #555; cursor: not-allowed; opacity: 0.7; } .btn:active{transform:translateY(1px)}
              
              .feed {
                width: 100%;
                max-width: 1100px;
                margin-top: 28px;
                display: flex;
                flex-direction: column-reverse;
                gap: 20px;
                z-index: 12;
              }

              .card {
                background: linear-gradient(180deg, rgba(15,20,35,0.65), rgba(10,15,25,0.35));
                border-radius: 14px;
                padding: 18px;
                backdrop-filter: blur(14px) saturate(120%);
                box-shadow: 0 14px 45px rgba(0,0,0,0.75), inset 0 0 16px rgba(255,255,255,0.03);
                opacity: 0;
                transform: translateY(22px);
                transition: transform .6s cubic-bezier(.2,.9,.3,1), opacity .6s;
                position: relative;
                border: 1px solid rgba(255,255,255,0.08);
                width: 100%;
              }

              .card.show{opacity:1;transform:translateY(0)}
              .card h3{margin:0 0 8px;font-size:1.05rem;color:#ffd97b;text-shadow:0 2px 6px rgba(0,0,0,0.8)}
              .card p{margin:0;color:rgba(255,255,255,0.96);line-height:1.45;white-space:pre-wrap;word-wrap:break-word;text-shadow:0 1px 4px rgba(0,0,0,0.8);}
              .meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:rgba(255,255,255,0.6);font-size:.86rem}
              .meta span[title="Polub"] { cursor: pointer; transition: transform .2s; user-select: none; }
              .meta span[title="Polub"]:active { transform: scale(1.2); }
              
              .card-actions { margin-top: 15px; text-align: right; }
              .card-action-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: background .2s; }
              .card-action-btn:hover { background: rgba(255,255,255,0.2); }
              .card-action-btn i { margin-right: 5px; }

            </style>
            <div class="support-wrap">
              <header class="support-header">
                <h1>Oddech Światła — Sekcja Wsparcia</h1>
                <p class="lead">Twoja historia ma znaczenie. Podziel się nią anonimowo i daj siłę innym. Twoje słowa trafią do moderacji, zanim pojawią się na ścianie.</p>
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
            const { escapeHtml } = SectionLoader.utils;

            const renderCard = (item, docId) => {
                const card = document.createElement('article');
                card.className = 'card';
                card.dataset.id = docId;
                const fullTextForLector = `${item.name}. ${item.text}`;
                card.dataset.text = fullTextForLector;
                card.dataset.docId = docId;

                const dateString = item.t ? new Date(item.t.toDate()).toLocaleString('pl-PL') : 'Przed chwilą';
                
                card.innerHTML = `
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.text)}</p>
                    <div class="meta">
                        <span>${dateString}</span>
                        <span title="Polub">❤️ <span class="like-count">${item.likes || 0}</span></span>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn" data-action="lector-play-pause" data-target="${docId}">
                            <i class="fas fa-play"></i> Odsłuchaj
                        </button>
                    </div>
                `;

                feed.append(card); // ZMIANA NA APPEND
                
                setTimeout(() => card.classList.add('show'), 50);

                const likeSpan = card.querySelector('span[title="Polub"]');
                likeSpan.addEventListener('click', async () => {
                    likeSpan.style.pointerEvents = 'none';
                    const ref = doc(db, 'support_stories', docId);
                    try {
                      await updateDoc(ref, { likes: increment(1) });
                    } catch(e){
                      console.error("Błąd polubienia:", e);
                      likeSpan.style.pointerEvents = 'auto';
                    }
                });
            };
            
            const q = query(collection(db, "support_stories"), where("isApproved", "==", true), orderBy("t", "asc")); // ZMIANA NA ASC
            const unsubscribe = onSnapshot(q, (snapshot) => {
                feed.innerHTML = '';
                snapshot.docs.forEach(doc => {
                    renderCard(doc.data(), doc.id);
                });

                if (feed.children.length === 0) {
                    feed.innerHTML = `<p>Brak wpisów. Bądź pierwszą osobą, która podzieli się wsparciem!</p>`;
                }
            });

            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const name = document.getElementById('supportName').value.trim();
                const text = document.getElementById('supportStory').value.trim();
                if (!name || !text) {
                    return alert("Imię i historia są wymagane.");
                }
                const btn = form.querySelector('.btn');
                btn.disabled = true;
                btn.textContent = 'Wysyłanie...';
                try {
                    await addDoc(collection(db, "support_stories"), { name, text, t: serverTimestamp(), isApproved: false, likes: 0 });
                    form.reset();
                    alert("Dziękujemy! Twój wpis został wysłany i czeka na akceptację.");
                } catch (e) {
                    alert('Wystąpił błąd podczas wysyłania.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Opublikuj';
                }
            });
            
            this.state.cleanupFunctions.push(unsubscribe);
            document.querySelector('.support-form').classList.add('enter');
        },
        
        renderBottleSection() {
            const contentWrapper = this.elements.wrapper;
            const oceanSound = new Audio('/audio/morze.mp3');
            oceanSound.loop = true;
            oceanSound.volume = 0.4;
            const backgroundImage = "url('/img/morze.webp')";
            contentWrapper.innerHTML = `
                <style>
                    .bottle-section { width: 100%; min-height: 100vh; height: auto; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #fff; position: relative; overflow: hidden; background-image: ${backgroundImage} !important; background-size: cover !important; background-position: center center !important; background-repeat: no-repeat !important; background-attachment: fixed !important; }
                    .bottle-section::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%); }
                    .bottle-container { position: relative; z-index: 1; padding: 2rem; animation: fadeIn 2s ease-in-out; }
                    .bottle-intro p { font-style: italic; font-size: 1.3rem; max-width: 700px; margin: 0 auto 2.5rem auto; color: #ddd; line-height: 1.9; text-shadow: 1px 1px 3px rgba(0,0,0,0.7); }
                    .bottle-button { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); padding: 1rem 2rem; font-size: 1.2rem; cursor: pointer; border-radius: 50px; backdrop-filter: blur(5px); transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: inset 0 -4px 10px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.2), 0 0 20px rgba(255,255,255,0.1); }
                    .bottle-button:hover { transform: translateY(-2px); box-shadow: inset 0 -4px 12px rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.3), 0 0 30px rgba(255,255,255,0.15); }
                    .bottle-button:active { transform: translateY(1px); box-shadow: inset 0 -2px 5px rgba(0,0,0,0.5); }
                    #drawLetterBtn, #returnLetterBtn { color: #E0C56E; text-shadow: 0 0 8px rgba(255, 215, 0, 0.7); }
                    .bottle-letter { display: none; background: rgba(10, 15, 25, 0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; max-width: 650px; padding: 2.5rem 3.5rem; box-shadow: 0 8px 32px 0 rgba(0, 150, 255, 0.3), 0 0 15px rgba(0, 150, 255, 0.2); }
                    .bottle-letter p { font-family: 'Georgia', 'Times New Roman', serif; font-size: 1.7rem; line-height: 1.9; color: transparent; background: linear-gradient(180deg, #FFDDE1 20%, #FFFFFF 50%, #BDBDBD 85%); -webkit-background-clip: text; background-clip: text; text-shadow: 0 1px 1px rgba(0,0,0,0.5), 0 0 15px rgba(0, 150, 255, 0.4), 0 0 40px rgba(0, 150, 255, 0.2); }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                </style>
                <div class="bottle-section">
                    <div class="bottle-container">
                        <div id="bottleIntro" class="bottle-intro">
                            <p>Morze, które widzisz przed sobą, jest starsze niż jakikolwiek ból... Czasem, bardzo rzadko, wyrzuca na brzeg butelkę. A w niej list. Sprawdź, co morze ma dziś do powiedzenia Tobie.</p>
                            <button id="drawLetterBtn" class="bottle-button">Wyłów list z morza</button>
                        </div>
                        <div id="bottleLetter" class="bottle-letter">
                            <p id="letterText"></p>
                            <button id="returnLetterBtn" class="bottle-button" style="margin-top: 2rem;">Wrzuć list z powrotem</button>
                        </div>
                    </div>
                </div>
            `;
            let lettersCache = [];
            const bottleIntro = contentWrapper.querySelector('#bottleIntro'), bottleLetter = contentWrapper.querySelector('#bottleLetter'), drawLetterBtn = contentWrapper.querySelector('#drawLetterBtn'), returnLetterBtn = contentWrapper.querySelector('#returnLetterBtn'), letterText = contentWrapper.querySelector('#letterText');
            const fetchLetters = async () => { if (lettersCache.length > 0) return; try { const q = query(collection(db, 'letters')); const snapshot = await getDocs(q); snapshot.forEach(doc => lettersCache.push(doc.data().text || 'Pusta butelka.')); if (lettersCache.length === 0) lettersCache.push("Morze jest dziś spokojne i nie wyrzuciło żadnych listów."); } catch (e) { console.error("Błąd podczas pobierania listów:", e); lettersCache.push("Fale były zbyt silne, by wyłowić list."); } };
            const drawLetter = () => { if (lettersCache.length === 0) return; letterText.textContent = lettersCache[Math.floor(Math.random() * lettersCache.length)]; bottleIntro.style.display = 'none'; bottleLetter.style.display = 'block'; };
            const returnLetter = () => { bottleLetter.style.display = 'none'; bottleIntro.style.display = 'block'; };
            drawLetterBtn.addEventListener('click', drawLetter);
            returnLetterBtn.addEventListener('click', returnLetter);
            
            this.state.cleanupFunctions.push(() => {
                oceanSound.pause();
                oceanSound.currentTime = 0;
            });
            fetchLetters();
        },
        
        renderPiciorys(doc) {
          if (!doc) return this.render.renderEmpty.call(this, "Nie znaleziono wpisu dla tej sekcji.");
          const e = doc.data();
          const { escapeHtml, stripHtml } = this.utils;
          const introText = (e.text || '').split('---PODZIAL---')[0] || "Brak tekstu wstępu.";
          const mainText = (e.text || '').split('---PODZIAL---')[1] || "Brak tekstu głównego.";
          const fullContentForIntroLector = escapeHtml(`${e.introTitle || ''}. ${stripHtml(introText)}`);
          const fullContentForMainLector = escapeHtml(`${e.mainTitle || ''}. ${stripHtml(mainText)}`);

          const html = `
            <div class="log-container" data-doc-id="${doc.id}">
                <div id="piciorys-intro" data-text="${fullContentForIntroLector}">
                    <h2 class="log-title">${escapeHtml(e.introTitle || "Nazywam się Alkohol")}</h2>
                    <div class="log-content" id="intro-content-target"></div>
                    <div class="log-actions">
                        <button class="action-button" data-action="lector-play-pause" data-target="piciorys-intro"><i class="fas fa-play"></i> Odsłuchaj</button>
                        <button id="continue-btn" class="action-button"><i class="fas fa-book-open"></i> Czytaj dalej</button>
                    </div>
                </div>
                <div id="piciorys-main" style="display: none;" data-text="${fullContentForMainLector}">
                    <hr class="piciorys-separator">
                    <h2 class="log-title">${escapeHtml(e.mainTitle || "Piciorys Chudego")}</h2>
                    <div class="log-meta">
                        <span><i class="fas fa-eye"></i> ${e.views || 0}</span>
                        <span data-likes-counter><i class="fas fa-heart"></i> Polubienia: ${e.likes || 0}</span>
                    </div>
                    <div class="log-content" id="main-content-target"></div>
                    <div class="log-actions">
                        <button class="action-button" data-action="lector-play-pause" data-target="piciorys-main"><i class="fas fa-play"></i> Odsłuchaj</button>
                        <button class="action-button" data-action="like"><i class="fas fa-heart"></i> Lubię to</button>
                    </div>
                </div>
            </div>`;
          this.elements.wrapper.innerHTML = html;
          this.modules.typewriter.start(document.getElementById('intro-content-target'), introText);
          document.getElementById('continue-btn').addEventListener('click', () => {
              lektor.stop();
              document.querySelector('[data-action="lector-play-pause"][data-target="piciorys-intro"]').innerHTML = `<i class="fas fa-play"></i> Odsłuchaj`;
              this.state.currentLectorTarget = null;
              document.getElementById('piciorys-intro').style.display = 'none';
              document.getElementById('piciorys-main').style.display = 'block';
              this.modules.typewriter.start(document.getElementById('main-content-target'), mainText);
              this.incrementViews(doc.id);
          }, { once: true });
        },
        
        renderKsiezniczka(doc) {
            this.render.renderError.call(this, "Z punktu widzenia księżniczki", "Sekcja w budowie.");
        },
        renderPomoc(docs) { this.render.renderError.call(this, "Pomoc", "Sekcja w budowie."); },
        renderGallery() { this.render.renderError.call(this, "Galeria", "Sekcja w budowie."); },
        
        renderStandard(docs) {
          if (!docs || docs.length === 0) return this.render.renderEmpty.call(this);
          const { escapeHtml, stripHtml } = this.utils;
          const items = docs.map(doc => {
            const e = doc.data();
            const fullContentForLector = escapeHtml(`${e.title || ''}. ${stripHtml(e.text || '')}`);
            const fullContentForDisplay = e.text || '';
            const excerpt = stripHtml(fullContentForDisplay).substring(0, 300) + (fullContentForDisplay.length > 300 ? '...' : '');
            return `
              <article class="story-item" data-doc-id="${doc.id}" data-text="${fullContentForLector}">
                <h3 class="entry-title">${escapeHtml(e.title || 'Bez tytułu')}</h3>
                <div class="entry-meta">
                  <span><i class="fas fa-user-edit"></i> Autor: ${escapeHtml(e.author || 'Chudy')}</span>
                  <span><i class="fas fa-calendar-alt"></i> ${e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : 'Brak daty'}</span>
                  <span data-likes-counter><i class="fas fa-heart"></i> Polubienia: ${e.likes || 0}</span>
                  <span><i class="fas fa-eye"></i> Wyświetlenia: ${e.views || 0}</span>
                </div>
                <div class="entry-content">
                    <p>${excerpt}</p>
                    <div class="full-content" style="display: none;">${fullContentForDisplay}</div>
                </div>
                <div class="log-actions">
                    <button class="action-button" data-action="read-more">Czytaj Dalej</button>
                    <button class="action-button" data-action="lector-play-pause" data-target="${doc.id}"><i class="fas fa-play"></i> Odsłuchaj</button>
                    <button class="action-button" data-action="like"><i class="fas fa-heart"></i> Lubię to</button>
                </div>
              </article>`;
          }).join('');
          const html = `<div class="content-container"><h2 class="fancy-title">${escapeHtml(this.state.sectionName)}</h2><div class="story-list">${items}</div></div>`;
          this.elements.wrapper.innerHTML = html;
          docs.forEach(d => this.incrementViews(d.id));
        },
        
        renderError(title, message) {
            this.elements.wrapper.innerHTML = `<div class="content-container"><h2 class="fancy-title">${this.utils.escapeHtml(title)}</h2><p>${this.utils.escapeHtml(message)}</p></div>`;
        },
        
        renderEmpty(message = "Brak wpisów w tej sekcji.") {
            this.render.renderError.call(this, this.state.sectionName, message);
        }
    },
    
    modules: {
        typewriter: {
            start(element, text, speed = 30) {
                if (!element || !text) {
                    if (element) element.innerHTML = "(Brak tekstu)";
                    return;
                }
                let i = 0;
                element.innerHTML = '<span class="typing-cursor"></span>';
                function type() {
                    if (i < text.length) {
                        element.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>') + '<span class="typing-cursor"></span>';
                        i++;
                        setTimeout(type, speed);
                    } else {
                        element.innerHTML = text.replace(/\n/g, '<br>');
                    }
                }
                type();
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => SectionLoader.init());

