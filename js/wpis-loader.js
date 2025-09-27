// ========================================
//  SEKTION LOADER – MASTER ARCYLEVEL
//  Od Dna do Światła – Latarnia Nadziei
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ModalModule, lektor } from './modules.js';

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

  // ==============================
  //  INICJALIZACJA
  // ==============================
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

  // ==============================
  //  FETCHERY – POBIERANIE DANYCH
  // ==============================
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

  // ==============================
  //  FUNKCJE POMOCNICZE FIRESTORE
  // ==============================
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

  // ==============================
  //  RENDERERY – WIDOKI
  // ==============================
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
      SectionLoader.modules.lector.init(document.getElementById("speakBtn"), entry.text || '');
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

      // Toggle content
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

      // Like buttons
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

      // Increment views for all articles
      docs.forEach(d => SectionLoader.incrementViews(d.id));
    },

    renderError(title, message) {
      SectionLoader.elements.wrapper.innerHTML = `<div class="content-container"><h2 class="fancy-title">${title}</h2><p>${message}</p></div>`;
    },

    renderEmpty(message = "Brak wpisów w tej sekcji.") {
      SectionLoader.render.renderError(SectionLoader.state.sectionName, message);
    }
  },

  // ==============================
  //  DODATKOWE MODUŁY
  // ==============================
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
