// ========================================
//  SEKTION LOADER – MASTER ARCYLEVEL
//  Od Dna do Światła – Latarnia Nadziei
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ModalModule } from './modules.js';

// 🔑 Firebase konfiguracja
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================================
// Lektor Arcymistrz PRO
// ========================================

export const lektor = (() => {
    let queue = [];
    let currentUtterance = null;
    let isPaused = false;
    let selectedVoice = null;
    let mode = "normalny";

    const modes = {
        normalny: { rate: 1, pitch: 1, volume: 1 },
        szybki: { rate: 1.4, pitch: 1, volume: 1 },
        wolny: { rate: 0.8, pitch: 1, volume: 1 },
        szept: { rate: 1, pitch: 1.2, volume: 0.4 },
        lektorski: { rate: 0.9, pitch: 0.9, volume: 1 }
    };

    const stripHtml = (html = "") => {
        const div = document.createElement("div");
        div.innerHTML = html;
        return div.textContent || div.innerText || "";
    };

    const numToWords = (num) => {
        const ones = ["zero","jeden","dwa","trzy","cztery","pięć","sześć","siedem","osiem","dziewięć"];
        const teens = ["dziesięć","jedenaście","dwanaście","trzynaście","czternaście","piętnaście","szesnaście","siedemnaście","osiemnaście","dziewiętnaście"];
        const tens = ["","dziesięć","dwadzieścia","trzydzieści","czterdzieści","pięćdziesiąt","sześćdziesiąt","siedemdziesiąt","osiemdziesiąt","dziewięćdziesiąt"];
        const hundreds = ["","sto","dwieście","trzysta","czterysta","pięćset","sześćset","siedemset","osiemset","dziewięćset"];
        if (num < 10) return ones[num];
        if (num < 20) return teens[num-10];
        if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
        if (num < 1000) return hundreds[Math.floor(num/100)] + (num%100 ? " " + numToWords(num%100) : "");
        if (num < 2000) return "tysiąc " + numToWords(num%1000);
        if (num < 5000) return numToWords(Math.floor(num/1000)) + " tysiące " + (num%1000 ? numToWords(num%1000) : "");
        return num.toString();
    };

    const parseDate = (str) => {
        const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!match) return null;
        const [_, d, m, y] = match.map(Number);
        const months = ["","stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"];
        return `${numToWords(d)} ${months[m]} ${numToWords(y)} roku`;
    };

    const parseTime = (str) => {
        const match = str.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const [_, h, m] = match.map(Number);
        if (m === 0) return `${numToWords(h)} zero zero`;
        return `${numToWords(h)} ${numToWords(m)}`;
    };

    const normalizeText = (input = "") => {
        let text = stripHtml(input);
        const replacements = {
            "np.": "na przykład",
            "itd.": "i tak dalej",
            "itp.": "i tym podobne",
            "m.in.": "między innymi",
            "tj.": "to jest",
            "dr ": "doktor ",
            "prof.": "profesor",
            "ul.": "ulica",
            "mr ": "mister ",
            "mrs ": "missis "
        };
        for (const [abbr, full] of Object.entries(replacements)) {
            const regex = new RegExp("\\b" + abbr.replace(".", "\\.") + "\\b", "gi");
            text = text.replace(regex, full);
        }

        const emojiMap = { "🙂": "uśmiech","😀": "szeroki uśmiech","😂": "śmiech","❤️": "serce","👍": "kciuk w górę" };
        for (const [emoji, word] of Object.entries(emojiMap)) text = text.replaceAll(emoji, " " + word + " ");
        text = text.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, (d) => parseDate(d) || d);
        text = text.replace(/\b\d{1,2}:\d{2}\b/g, (t) => parseTime(t) || t);
        text = text.replace(/\b\d+\b/g, (n) => { const num = parseInt(n, 10); return isNaN(num) ? n : numToWords(num); });
        return text.replace(/\s+/g, " ").trim();
    };

    const splitText = (text, maxLen = 300) => {
        const parts = [];
        const sentences = text.replace(/\s+/g, " ").trim().split(/([.!?]\s+)/);
        let chunk = "";
        for (let i = 0; i < sentences.length; i++) {
            const s = sentences[i];
            if ((chunk + s).length > maxLen) { parts.push(chunk.trim()); chunk = s; } 
            else { chunk += s; }
        }
        if (chunk.trim().length > 0) parts.push(chunk.trim());
        return parts;
    };

    const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return null;
        return voices.find(v => v.lang === "pl-PL") || voices.find(v => v.lang && v.lang.startsWith("pl")) || voices[0];
    };

    const initVoices = () => { selectedVoice = pickVoice(); console.log("✅ Wybrany głos:", selectedVoice?.name, selectedVoice?.lang); };
    window.speechSynthesis.onvoiceschanged = () => initVoices();
    initVoices();

    const enqueue = (rawText) => {
        if (!rawText) return;
        const clean = normalizeText(rawText);
        const parts = splitText(clean);
        queue.push(...parts);
        if (!currentUtterance) speakNext();
    };

    const speakNext = () => {
        if (queue.length === 0) { currentUtterance = null; return; }
        const text = queue.shift();
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = "pl-PL";
        if (selectedVoice) currentUtterance.voice = selectedVoice;
        const cfg = modes[mode] || modes.normalny;
        currentUtterance.rate = cfg.rate; currentUtterance.pitch = cfg.pitch; currentUtterance.volume = cfg.volume;
        currentUtterance.onend = () => { currentUtterance = null; if (!isPaused) speakNext(); };
        currentUtterance.onerror = (e) => { console.error("❌ Błąd lektora:", e); currentUtterance = null; speakNext(); };
        window.speechSynthesis.speak(currentUtterance);
    };

    const stop = () => { window.speechSynthesis.cancel(); queue = []; currentUtterance = null; isPaused = false; };
    const pause = () => { if (currentUtterance && !isPaused) { window.speechSynthesis.pause(); isPaused = true; } };
    const resume = () => { if (currentUtterance && isPaused) { window.speechSynthesis.resume(); isPaused = false; } };
    const isSpeaking = () => window.speechSynthesis.speaking;
    const setMode = (newMode) => { if (modes[newMode]) { mode = newMode; console.log("🎙️ Tryb lektora:", newMode); } };

    return { enqueue, stop, pause, resume, isSpeaking, setMode };
})();

// ========================================
// SectionLoader – logika i renderery w całości
// ========================================

const SectionLoader = {
  state: { sectionName: '' },
  elements: { wrapper: document.getElementById('content-wrapper') },
  utils: {
    escapeHtml: (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    stripHtml: (s = '') => String(s).replace(/<[^>]*>?/gm, ''),
  },
  router: {
    'Piciorys Chudego': { fetcher: 'fetchSingleEntry', renderer: 'renderPiciorys', theme: 'theme-piciorys' },
    'Z punktu widzenia księżniczki': { fetcher: 'fetchSingleEntry', renderer: 'renderKsiezniczka', theme: 'theme-ksiezniczka' },
    'Pomoc': { fetcher: 'fetchAllHelpEntries', renderer: 'renderPomoc', theme: 'theme-pomoc' },
    '__default__': { fetcher: 'fetchAllEntries', renderer: 'renderStandard', queryOptions: [orderBy('createdAt', 'desc')], theme: 'theme-kronika' }
  },

  async init() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sectionNameRaw = params.get('nazwa') || '';
      this.state.sectionName = decodeURIComponent(sectionNameRaw).trim();
      if (!this.state.sectionName) { 
        return this.render.renderError('Błąd', 'Brak nazwy sekcji w adresie URL.'); 
      }
      const routeConfig = this.router[this.state.sectionName] || this.router['__default__'];
      document.documentElement.className = routeConfig.theme;
      document.title = `${this.utils.escapeHtml(this.state.sectionName)} — Od Dna do Światła`;
      const data = await this.fetch[routeConfig.fetcher](routeConfig.queryOptions);
      this.render[routeConfig.renderer](data);
      ModalModule.init(); 
    } catch (error) {
      console.error('Błąd krytyczny w SectionLoader:', error);
      this.render.renderError('Błąd Krytyczny', 'Wystąpił problem z ładowaniem sekcji.');
    }
  },

  fetch: {
    async fetchSingleEntry() {
      const entriesRef = collection(db, 'sekcje', SectionLoader.state.sectionName, 'entries');
      const q = query(entriesRef, limit(1));
      const snapshot = await getDocs(q);
      return snapshot.empty ? null : snapshot.docs[0];
    },
    async fetchAllEntries(queryOptions = []) {
      const collectionPath = `sekcje/${SectionLoader.state.sectionName}/entries`;
      const entriesRef = collection(db, collectionPath);
      const q = query(entriesRef, ...queryOptions);
      const snapshot = await getDocs(q);
      return snapshot.docs;
    },
    async fetchAllHelpEntries() {
      const q = query(collection(db, 'help'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs;
    }
  },

  async incrementViews(docId) {
    if (!docId) return;
    const ref = doc(db, 'sekcje', SectionLoader.state.sectionName, 'entries', docId);
    await updateDoc(ref, { views: increment(1) });
  },

  async incrementLikes(docId) {
    if (!docId) return;
    const ref = doc(db, 'sekcje', SectionLoader.state.sectionName, 'entries', docId);
    await updateDoc(ref, { likes: increment(1) });
  },

  render: {
    renderPiciorys(doc) {
      if (!doc || !doc.exists()) return SectionLoader.render.renderEmpty("Brak danych dla Piciorysu.");
      const entry = doc.data();
      const { escapeHtml } = SectionLoader.utils;
      const introTitle = entry.introTitle || "Nazywam się Alkohol";
      const introText = entry.introText || (entry.text || '').split('---PODZIAL---')[0] || "Brak tekstu wstępu.";
      const mainTitle = entry.mainTitle || "Piciorys Chudego";
      const mainText = entry.mainText || (entry.text || '').split('---PODZIAL---')[1] || "Brak tekstu głównego.";
      const views = entry.views || 0;
      const likes = entry.likes || 0;

      const html = `
      <div class="log-container" data-doc-id="${doc.id}">
        <div id="piciorys-intro">
          <div class="log-title">${escapeHtml(introTitle)}</div>
          <div class="log-content" id="intro-content-target"></div>
          <div class="log-actions">
            <button id="lector-intro" class="action-button"><i class="fas fa-play"></i> Odsłuchaj</button>
            <button id="lector-intro-stop" class="action-button"><i class="fas fa-stop"></i> Stop</button>
            <button id="continue-btn" class="action-button"><i class="fas fa-book-open"></i> Czytaj dalej</button>
          </div>
        </div>

        <div id="piciorys-main" style="display: none;">
          <hr class="piciorys-separator">
          <div class="log-title">${escapeHtml(mainTitle)}</div>
          <div class="log-meta">
            <span><i class="fas fa-eye"></i> ${views}</span>
            <span><i class="fas fa-heart"></i> Polubienia: ${likes}</span>
          </div>
          <div class="log-content" id="main-content-target"></div>
          <div class="log-actions">
            <button id="lector-main" class="action-button"><i class="fas fa-play"></i> Odsłuchaj</button>
            <button id="lector-main-stop" class="action-button"><i class="fas fa-stop"></i> Stop</button>
            <button id="like-main" class="action-button"><i class="fas fa-heart"></i> Lubię to</button>
            <a href="index.html" class="action-button"><i class="fas fa-arrow-left"></i> Powrót</a>
          </div>
        </div>
      </div>`;

      SectionLoader.elements.wrapper.innerHTML = html;

      const { typewriter } = SectionLoader.modules;
      const introTarget = document.getElementById('intro-content-target');
      const mainTarget = document.getElementById('main-content-target');
      const continueBtn = document.getElementById('continue-btn');

      typewriter.start(introTarget, introText);

      document.getElementById('lector-intro').onclick = () => lektor.enqueue(introText);
      document.getElementById('lector-intro-stop').onclick = () => lektor.stop();

      continueBtn.addEventListener('click', () => {
        lektor.stop();
        document.getElementById('piciorys-intro').style.display = 'none';
        document.getElementById('piciorys-main').style.display = 'block';
        typewriter.start(mainTarget, mainText);
        document.getElementById('lector-main').onclick = () => lektor.enqueue(mainText);
        document.getElementById('lector-main-stop').onclick = () => lektor.stop();
        document.getElementById('like-main').onclick = async () => {
          await SectionLoader.incrementLikes(doc.id);
          const likeSpan = document.querySelector('#piciorys-main .log-meta span:nth-child(2)');
          likeSpan.textContent = `Polubienia: ${likes + 1}`;
        };
        SectionLoader.incrementViews(doc.id);
      }, { once: true });
    },

    renderKsiezniczka(doc) {
      if (!doc || !doc.exists()) return SectionLoader.render.renderEmpty();
      const entry = doc.data();
      const html = `
        <main class="content-container story-container">
          <h2 class="fancy-title">Z punktu widzenia księżniczki</h2>
          <article id="ksiezniczka-text" class="story-item">
            <h3>${SectionLoader.utils.escapeHtml(entry.title || '')}</h3>
            ${entry.text || ''}
            <button id="speakBtn" class="action-button"><i class="fas fa-volume-up"></i> Odsłuchaj</button>
          </article>
        </main>`;
      SectionLoader.elements.wrapper.innerHTML = html;
      document.getElementById("speakBtn").onclick = () => lektor.enqueue(entry.text || '');
    },

    renderPomoc(docs) {
      SectionLoader.elements.wrapper.innerHTML = "<h2>Pomoc - w budowie</h2>";
    },

    renderStandard(docs) {
      if (!docs || docs.length === 0) return SectionLoader.render.renderEmpty();
      const { escapeHtml, stripHtml } = SectionLoader.utils;
      const items = docs.map(doc => {
        const e = doc.data();
        const title = escapeHtml(e.title || 'Bez tytułu');
        const author = escapeHtml(e.author || 'Chudy');
        const date = e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : 'Brak daty';
        const likes = e.likes || 0;
        const views = e.views || 0;
        const fullContent = e.text || '';
        const excerpt = stripHtml(fullContent).substring(0, 300) + (fullContent.length > 300 ? '...' : '');
        return `
          <article class="story-item" data-doc-id="${doc.id}">
            <h3 class="entry-title"><a href="#">${title}</a></h3>
            <div class="entry-meta">
              <span><i class="fas fa-user-edit"></i> Autor: ${author}</span>
              <span><i class="fas fa-calendar-alt"></i> ${date}</span>
              <span><i class="fas fa-heart"></i> Polubienia: ${likes}</span>
              <span><i class="fas fa-eye"></i> Wyświetlenia: ${views}</span>
            </div>
            <div class="entry-content">
              <p>${escapeHtml(excerpt)}</p>
              <div class="full-content" style="display: none;">${fullContent}</div>
            </div>
            <button class="action-button read-more-btn">Czytaj Dalej</button>
            <button class="action-button like-btn"><i class="fas fa-heart"></i> Lubię to</button>
          </article>`;
      }).join('');
      const html = `
        <div class="content-container">
          <h2 class="fancy-title">${escapeHtml(SectionLoader.state.sectionName)}</h2>
          <div class="story-list">${items}</div>
        </div>`;
      SectionLoader.elements.wrapper.innerHTML = html;

      document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const content = e.target.closest('.story-item').querySelector('.full-content');
          if (content.style.display === 'none') {
            content.style.display = 'block';
            btn.textContent = "Ukryj";
          } else {
            content.style.display = 'none';
            btn.textContent = "Czytaj Dalej";
          }
        });
      });

      document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          const article = e.target.closest('.story-item');
          const docId = article.dataset.docId;
          await SectionLoader.incrementLikes(docId);
          const likeSpan = article.querySelector('.entry-meta span:nth-child(3)');
          const currentLikes = parseInt(likeSpan.textContent.match(/\d+/)[0]);
          likeSpan.textContent = `Polubienia: ${currentLikes + 1}`;
        });
      });

      docs.forEach(d => SectionLoader.incrementViews(d.id));
    },

    renderError(title, message) {
      SectionLoader.elements.wrapper.innerHTML = `<div class="content-container"><h2 class="fancy-title">${title}</h2><p>${message}</p></div>`;
    },

    renderEmpty(message = "Brak wpisów w tej sekcji.") {
      SectionLoader.render.renderError(SectionLoader.state.sectionName, message);
    }
  },

  modules: {
    typewriter: {
      start(element, text, speed = 30) {
        if (!element || !text) { if (element) element.innerHTML = "(Brak tekstu)"; return; }
        let i = 0;
        element.innerHTML = '<span class="typing-cursor"></span>';
        function type() {
          if (i < text.length) {
            const content = text.substring(0, i + 1).replace(/\n/g, '<br>');
            element.innerHTML = content + '<span class="typing-cursor"></span>';
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

SectionLoader.init();
