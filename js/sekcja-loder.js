// Plik: /js/sekcja-loader.js (WERSJA OSTATECZNA, KOMPLETNA + POPRAWKI)

// --- Konfiguracja i Inicjalizacja Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, limit, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app", // Poprawna nazwa
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


const SectionLoader = {
    state: {
        sectionName: '',
    },
    elements: {
        wrapper: document.getElementById('content-wrapper'),
    },
    utils: {
        escapeHtml: (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        stripHtml: (s = '') => String(s).replace(/<[^>]*>?/gm, ''),
    },

    router: {
        'Piciorys Chudego': { fetcher: 'fetchSingleEntry', renderer: 'renderPiciorys' },
        'Z punktu widzenia księżniczki': { fetcher: 'fetchSingleEntry', renderer: 'renderKsiezniczka' },
        'Pomoc': { fetcher: 'fetchAllHelpEntries', renderer: 'renderPomoc' },
        '__default__': { fetcher: 'fetchAllEntries', renderer: 'renderStandard', queryOptions: [orderBy('createdAt', 'desc')] }
    },

    async init() {
        try {
            const params = new URLSearchParams(window.location.search);
            // === POPRAWKA DLA KOMPATYBILNOŚCI WSTECZNEJ ===
            const sectionNameRaw = params.get('section') || params.get('nazwa') || '';
            this.state.sectionName = decodeURIComponent(sectionNameRaw).trim();

            if (!this.state.sectionName) {
                return this.render.renderError('Błąd', 'Brak nazwy sekcji w adresie URL.');
            }

            document.title = `${this.utils.escapeHtml(this.state.sectionName)} — Od Dna do Światła`;
            const routeConfig = this.router[this.state.sectionName] || this.router['__default__'];
            const data = await this.fetch[routeConfig.fetcher](routeConfig.queryOptions);
            this.render[routeConfig.renderer](data);

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
            return snapshot.empty ? null : snapshot.docs[0].data();
        },
        async fetchAllEntries(queryOptions = []) {
            const entriesRef = collection(db, 'sekcje', SectionLoader.state.sectionName, 'entries');
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

    render: {
        renderPiciorys(entry) {
            if (!entry) return SectionLoader.render.renderEmpty();
            const [quote, historia] = (entry.text || '').split('---PODZIAL---');
            const html = `
                <header class="page-header"><h1>Piciorys Chudego</h1></header>
                <main class="content-container">
                    <article class="story-item">
                        <div id="piciorys-wstep"><h2>${SectionLoader.utils.escapeHtml(entry.title || '')}</h2>${quote ? `<blockquote>${quote}</blockquote>` : ''}</div>
                        <button id="speakBtn1" class="speak-button">▶️ Odsłuchaj Wstęp</button>
                        <hr class="sep">
                        <div id="piciorys-historia" class="wpis-calosc" style="display:block;">${historia || ''}</div>
                        <button id="speakBtn2" class="speak-button">▶️ Odsłuchaj Historię</button>
                    </article>
                </main>`;
            SectionLoader.elements.wrapper.innerHTML = html;
            SectionLoader.modules.lector.create("speakBtn1", "#piciorys-wstep");
            SectionLoader.modules.lector.create("speakBtn2", "#piciorys-historia");
        },
        renderKsiezniczka(entry) {
            if (!entry) return SectionLoader.render.renderEmpty();
            const html = `
                <header class="page-header"><h1>Z punktu widzenia księżniczki</h1></header>
                <main class="content-container">
                    <article id="ksiezniczka-text" class="story-item">
                        <h2>${SectionLoader.utils.escapeHtml(entry.title || '')}</h2>
                        ${entry.text || ''}
                        <button id="speakBtn" class="speak-button">▶️ Odsłuchaj</button>
                    </article>
                </main>`;
            SectionLoader.elements.wrapper.innerHTML = html;
            SectionLoader.modules.lector.create("speakBtn", "#ksiezniczka-text");
        },
        renderPomoc(docs) {
            if (!docs || docs.length === 0) return SectionLoader.render.renderEmpty('Brak ośrodków pomocy w bazie.');
            const entries = docs.map(d => d.data());
            const grouped = entries.reduce((acc, e) => {
                const woj = e.woj || 'Inne';
                (acc[woj] ||= []).push(e);
                return acc;
            }, {});
            const wojOrder = ['Ogólnopolskie', ...Object.keys(grouped).filter(w => w !== 'Ogólnopolskie').sort()];
            const accordionsHTML = wojOrder.map(woj => {
                if (!grouped[woj]) return '';
                const itemsHtml = grouped[woj].map(e => `
                    <div class="place-entry">
                        <h3>${SectionLoader.utils.escapeHtml(e.name || 'Brak nazwy')}</h3>
                        ${e.address ? `<p><strong>Adres:</strong> ${SectionLoader.utils.escapeHtml(e.address)}</p>` : ''}
                        ${e.phone ? `<p><strong>Telefon:</strong> ${SectionLoader.utils.escapeHtml(e.phone)}</p>` : ''}
                        <p>${e.desc || ''}</p>
                        ${e.link ? `<p><a href="${e.link}" target="_blank" rel="noopener">Przejdź do strony</a></p>` : ''}
                    </div>`).join('');
                return `<div class="woj-group" data-woj="${woj}"><button class="accordion"> ${woj}</button><div class="panel">${itemsHtml}</div></div>`;
            }).join('');
            const html = `
                <header class="page-header"><h1>Gdzie szukać pomocy – Uzależnienia</h1></header>
                <main class="content-container">
                    <div class="filter-bar">
                        <label for="wojewodztwoSelect"><strong>Filtruj wg województwa:</strong></label>
                        <select id="wojewodztwoSelect"><option value="all">Wszystkie</option>${wojOrder.map(w => `<option value="${w}">${w}</option>`).join('')}</select>
                    </div>
                    <div>${accordionsHTML}</div>
                </main>`;
            SectionLoader.elements.wrapper.innerHTML = html;
            SectionLoader.modules.accordion.init();
        },
        renderStandard(docs) {
             if (!docs || docs.length === 0) return SectionLoader.render.renderEmpty();
            const items = docs.map(doc => {
                const e = doc.data();
                const id = doc.id;
                const title = SectionLoader.utils.escapeHtml(e.title || 'Bez tytułu');
                const date = e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : '';
                const skrot = SectionLoader.utils.stripHtml(e.text).substring(0, 300);
                return `
                    <article class="story-item" data-id="${id}">
                        <h2>${title}</h2>
                        <div class="entry-item-meta">${date}</div>
                        <div class="wpis-skrot"><p>${SectionLoader.utils.escapeHtml(skrot)}...</p></div>
                        <div class="wpis-calosc">${e.text || ''}</div>
                        <div class="button-container">
                            <button class="czytaj-dalej-btn">...czytaj dalej</button>
                            <button class="speak-button" style="display:none;">▶️ Odsłuchaj</button>
                        </div>
                    </article>`;
            }).join('');
            const html = `
                <header class="page-header"><h1>${SectionLoader.utils.escapeHtml(SectionLoader.state.sectionName)}</h1></header>
                <main class="content-container">${items}</main>`;
            SectionLoader.elements.wrapper.innerHTML = html;
            SectionLoader.modules.standardEntries.init();
        },
        renderError(title, message) {
            SectionLoader.elements.wrapper.innerHTML = `
                <header class="page-header"><h1>${SectionLoader.utils.escapeHtml(title)}</h1></header>
                <main class="content-container"><p>${SectionLoader.utils.escapeHtml(message)}</p></main>`;
        },
    },
    
    modules: {
        lector: {
             create(buttonOrId, contentOrSelector) {
                const btn = typeof buttonOrId === 'string' ? document.getElementById(buttonOrId) : buttonOrId;
                if (!btn) return;
                const el = typeof contentOrSelector === 'string' ? document.querySelector(contentOrSelector) : contentOrSelector;
                if (!el) return;
                const text = el.innerText || "";
                if (!text) { btn.disabled = true; return; }
                const synth = window.speechSynthesis;
                btn.addEventListener("click", () => {
                    if (synth.speaking) {
                        synth.cancel();
                    } else {
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = "pl-PL";
                        synth.speak(utterance);
                    }
                });
             }
        },
        accordion: {
            init() {
                SectionLoader.elements.wrapper.addEventListener('click', function(e) {
                    if (!e.target.classList.contains('accordion')) return;
                    e.target.classList.toggle('active');
                    const panel = e.target.nextElementSibling;
                    panel.style.maxHeight = panel.style.maxHeight ? null : `${panel.scrollHeight}px`;
                });
                const select = document.getElementById('wojewodztwoSelect');
                select?.addEventListener('change', function() {
                    const value = this.value;
                    document.querySelectorAll('.woj-group').forEach(g => g.style.display = (value === 'all' || g.dataset.woj === value) ? 'block' : 'none');
                });
            }
        },
        standardEntries: {
            init() {
                SectionLoader.elements.wrapper.addEventListener('click', e => {
                    if (!e.target.closest('.czytaj-dalej-btn')) return;
                    const story = e.target.closest('.story-item');
                    const skrot = story.querySelector('.wpis-skrot');
                    const calosc = story.querySelector('.wpis-calosc');
                    const speakBtn = story.querySelector('.speak-button');
                    const isOpen = calosc.style.display === 'block';
                    if (isOpen) {
                        calosc.style.display = 'none';
                        speakBtn.style.display = 'none';
                        skrot.style.display = 'block';
                        e.target.textContent = '...czytaj dalej';
                    } else {
                        calosc.style.display = 'block';
                        speakBtn.style.display = 'inline-flex';
                        skrot.style.display = 'none';
                        e.target.textContent = 'Zwiń';
                        if (!speakBtn.dataset.lectorInitialized) {
                            SectionLoader.modules.lector.create(speakBtn, calosc);
                            speakBtn.dataset.lectorInitialized = true;
                        }
                    }
                });
            }
        }
    }
};

SectionLoader.init();
