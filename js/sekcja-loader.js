import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, doc, updateDoc, increment, addDoc, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Konfiguracja Firebase (Zgodna z zaleceniami Alejandro) ---
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app", // Poprawione
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================================
// Moduł Odtwarzacza Hymnu (MusicPlayer)
// ========================================
const MusicPlayer = (() => {
    let audio = new Audio("audio/hymn.mp3");
    audio.loop = true;
    let isPlaying = false;

    const init = () => {
        // Tworzymy przycisk dynamicznie, jeśli nie ma go w HTML
        if (!document.getElementById('hymn-btn')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'hymn-wrapper';
            wrapper.innerHTML = `
                <div class="pulse-ring" id="hymn-pulse" style="display:none"></div>
                <button class="hymn-btn-3d" id="hymn-btn"><i class="fas fa-music"></i></button>
            `;
            document.body.appendChild(wrapper);
        }
        document.getElementById('hymn-btn').onclick = () => isPlaying ? stop() : play();
    };

    const play = () => {
        lektor.stop(); 
        audio.play().then(() => {
            isPlaying = true;
            document.getElementById('hymn-btn').innerHTML = '<i class="fas fa-pause"></i>';
            document.getElementById('hymn-pulse').style.display = 'block';
        }).catch(e => console.warn("Audio play blocked by browser. Click anywhere to enable."));
    };

    const stop = () => {
        audio.pause();
        isPlaying = false;
        document.getElementById('hymn-btn').innerHTML = '<i class="fas fa-music"></i>';
        document.getElementById('hymn-pulse').style.display = 'none';
    };

    return { init, stop, play };
})();

// ========================================
// Moduł Lektora (TTS)
// ========================================
const lektor = (() => {
    let queue = [];
    let isPaused = false;

    const stop = () => {
        isPaused = false;
        queue = [];
        window.speechSynthesis.cancel();
    };

    const speakNext = () => {
        if (isPaused || queue.length === 0) return;
        const utt = new SpeechSynthesisUtterance(queue.shift());
        utt.lang = 'pl-PL';
        utt.rate = 0.95;
        utt.onend = () => { if(!isPaused) speakNext(); };
        window.speechSynthesis.speak(utt);
    };

    const enqueue = (text) => {
        MusicPlayer.stop(); 
        stop();
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        queue = cleanText.match(/[^.!?]+[.!?]*/g) || [cleanText];
        speakNext();
    };

    const pause = () => { 
        if(window.speechSynthesis.speaking) { 
            window.speechSynthesis.pause(); 
            isPaused = true; 
        } 
    };

    const resume = () => { 
        MusicPlayer.stop(); 
        isPaused = false; 
        window.speechSynthesis.resume(); 
        if(!window.speechSynthesis.speaking) speakNext(); 
    };

    return { 
        enqueue, stop, pause, resume, 
        getStatus: () => ({ speaking: window.speechSynthesis.speaking, paused: isPaused }) 
    };
})();

// ========================================
// Główny obiekt SectionLoader
// ========================================
const SectionLoader = {
    state: { sectionName: '', currentLectorTarget: null },
    elements: { wrapper: document.getElementById('content-wrapper') },
    
    utils: {
        escapeHtml: (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        stripHtml: (s) => String(s).replace(/<[^>]*>?/gm, ''),
        getLiked: () => JSON.parse(localStorage.getItem('likedPosts') || '[]'),
        setLiked: (id) => { 
            const l = SectionLoader.utils.getLiked(); 
            if(!l.includes(id)) {
                l.push(id); 
                localStorage.setItem('likedPosts', JSON.stringify(l)); 
            }
        }
    },

    async init() {
        MusicPlayer.init();
        const params = new URLSearchParams(window.location.search);
        this.state.sectionName = decodeURIComponent(params.get('nazwa') || 'Kronika').trim();
        
        this.setupEventListeners();
        this.loadSection();
    },

    setupEventListeners() {
        if (!this.elements.wrapper) return;

        this.elements.wrapper.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const article = btn.closest('[data-doc-id]');
            const docId = article?.dataset.docId;

            if (action === 'lector-play-pause') {
                const status = lektor.getStatus();
                if (status.speaking && !status.paused && this.state.currentLectorTarget === docId) {
                    lektor.pause(); 
                    btn.innerHTML = '<i class="fas fa-play"></i> Wznów';
                } else if (status.paused && this.state.currentLectorTarget === docId) {
                    lektor.resume(); 
                    btn.innerHTML = '<i class="fas fa-pause"></i> Pauza';
                } else {
                    const text = article.dataset.text || article.innerText;
                    document.querySelectorAll('[data-action="lector-play-pause"]').forEach(b => b.innerHTML = '<i class="fas fa-play"></i> Odsłuchaj');
                    lektor.enqueue(text);
                    this.state.currentLectorTarget = docId;
                    btn.innerHTML = '<i class="fas fa-pause"></i> Pauza';
                }
            }

            if (action === 'like' && docId) {
                if (this.utils.getLiked().includes(docId)) return;
                const coll = this.state.sectionName === 'Wsparcie' ? 'support_stories' : `sekcje/${this.state.sectionName}/entries`;
                try {
                    await updateDoc(doc(db, coll, docId), { likes: increment(1) });
                    this.utils.setLiked(docId);
                    btn.disabled = true; 
                    btn.innerHTML = '<i class="fas fa-check"></i> Polubiono';
                } catch(err) { console.error("Like error:", err); }
            }

            if (action === 'read-more') {
                const full = article.querySelector('.full-content');
                if (full) {
                    const isHidden = full.style.display === 'none' || !full.style.display;
                    full.style.display = isHidden ? 'block' : 'none';
                    btn.textContent = isHidden ? 'Ukryj' : 'Czytaj Dalej';
                }
            }
        });
    },

    async loadSection() {
        if (this.state.sectionName === 'Wsparcie') this.renderSupport();
        else if (this.state.sectionName === 'Piciorys Chudego') this.renderPiciorys();
        else this.renderStandard();
    },

    async renderStandard() {
        const q = query(collection(db, `sekcje/${this.state.sectionName}/entries`), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        
        let html = `<h2 class="fancy-title">${this.state.sectionName}</h2>`;
        if(snap.empty) {
            html += '<p style="text-align:center">Brak wpisów w tej sekcji.</p>';
        } else {
            snap.forEach(d => {
                const e = d.data();
                const liked = this.utils.getLiked().includes(d.id);
                html += `
                <article class="story-item" data-doc-id="${d.id}" data-text="${this.utils.escapeHtml(e.title + ". " + this.utils.stripHtml(e.text))}">
                    <h3>${this.utils.escapeHtml(e.title)}</h3>
                    <div class="entry-meta">
                        <span><i class="fas fa-calendar"></i> ${e.createdAt?.toDate().toLocaleDateString('pl-PL') || ''}</span>
                    </div>
                    <div class="entry-content">
                        <p>${this.utils.stripHtml(e.text).substring(0, 250)}...</p>
                        <div class="full-content" style="display:none; margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">${e.text}</div>
                    </div>
                    <div class="log-actions" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button class="action-button" data-action="read-more">Czytaj Dalej</button>
                        <button class="action-button" data-action="lector-play-pause"><i class="fas fa-play"></i> Odsłuchaj</button>
                        <button class="action-button" data-action="like" ${liked ? 'disabled' : ''}>
                            <i class="fas fa-heart"></i> ${liked ? 'Polubiono' : 'Lubię to'}
                        </button>
                    </div>
                </article>`;
            });
        }
        this.elements.wrapper.innerHTML = html;
    },

    async renderPiciorys() {
        const q = query(collection(db, 'sekcje', 'Piciorys Chudego', 'entries'), limit(1));
        const snap = await getDocs(q);
        if(snap.empty) return;
        const e = snap.docs[0].data();
        this.elements.wrapper.innerHTML = `
            <h2 class="fancy-title">Piciorys Chudego</h2>
            <div class="log-container" data-doc-id="${snap.docs[0].id}">
                <div id="typewriter-area" style="line-height:1.8;"></div>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button class="action-button" data-action="lector-play-pause"><i class="fas fa-play"></i> Odsłuchaj</button>
                    <button class="action-button" data-action="like"><i class="fas fa-heart"></i> Lubię to</button>
                </div>
            </div>
        `;
        this.modules.typewriter.start(document.getElementById('typewriter-area'), e.text);
    },

    renderSupport() {
        this.elements.wrapper.innerHTML = `
            <h2 class="fancy-title">Wsparcie</h2>
            <div class="log-container">
                <form id="supportForm" class="support-form" style="display:flex; flex-direction:column; gap:10px">
                    <input id="supName" placeholder="Imię / Pseudonim" required style="padding:10px; background:#111; border:1px solid #333; color:#fff">
                    <textarea id="supText" placeholder="Twoje słowa wsparcia..." rows="4" required style="padding:10px; background:#111; border:1px solid #333; color:#fff"></textarea>
                    <button type="submit" class="action-button" style="background:var(--gold); color:#000">Wyślij wiadomość</button>
                </form>
            </div>
            <div id="support-feed"></div>
        `;

        const feed = document.getElementById('support-feed');
        const q = query(collection(db, "support_stories"), where("isApproved", "==", true), orderBy("t", "desc"));
        
        onSnapshot(q, (snapshot) => {
            feed.innerHTML = '';
            snapshot.forEach(d => {
                const item = d.data();
                const liked = this.utils.getLiked().includes(d.id);
                const div = document.createElement('div');
                div.className = 'story-item';
                div.dataset.docId = d.id;
                div.innerHTML = `
                    <h4>${this.utils.escapeHtml(item.name)}</h4>
                    <p>${this.utils.escapeHtml(item.text)}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <button class="action-button" data-action="lector-play-pause"><i class="fas fa-play"></i> Odsłuchaj</button>
                        <button class="action-button" data-action="like" ${liked ? 'disabled' : ''}>
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </button>
                    </div>
                `;
                feed.appendChild(div);
            });
        });

        document.getElementById('supportForm').onsubmit = async (e) => {
            e.preventDefault();
            try {
                await addDoc(collection(db, "support_stories"), {
                    name: document.getElementById('supName').value,
                    text: document.getElementById('supText').value,
                    t: serverTimestamp(),
                    isApproved: false,
                    likes: 0
                });
                alert("Dziękujemy! Wiadomość pojawi się po moderacji.");
                e.target.reset();
            } catch(e) { alert("Błąd wysyłania."); }
        };
    },

    modules: {
        typewriter: {
            start(el, text) {
                if(!el) return;
                let i = 0;
                const type = () => {
                    if (i < text.length) {
                        el.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>') + '<span class="typing-cursor"></span>';
                        i++; setTimeout(type, 35);
                    } else {
                        el.innerHTML = text.replace(/\n/g, '<br>');
                    }
                };
                type();
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => SectionLoader.init());
