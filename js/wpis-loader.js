// Plik: /js/wpis-loader.js (WERSJA OSTATECZNA, KOMPLETNA + POPRAWKI)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, query, orderBy, limit, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const WpisApp = {
    state: {},
    elements: {},

    async init() {
        this.cacheElements();
        this.modules.progressBar.init();
        
        const params = new URLSearchParams(location.search);
        // === POPRAWKA DLA KOMPATYBILNOŚCI WSTECZNEJ ===
        this.state.sectionName = (params.get("section") || params.get("nazwa"))?.trim();
        this.state.entryId = params.get("id")?.trim();

        if (!this.state.sectionName || !this.state.entryId) {
            return this.renderError('Błąd', 'Brak wymaganych parametrów (sekcja lub ID wpisu) w adresie URL.');
        }
        
        this.modules.theme.init(this.state.sectionName);
        const entryRef = doc(db, "sekcje", this.state.sectionName, "entries", this.state.entryId);
        const entrySnap = await getDoc(entryRef);

        if (!entrySnap.exists()) {
            return this.renderError('Nie znaleziono', 'Wpis o podanym ID nie istnieje w tej sekcji.');
        }

        this.state.entry = entrySnap.data();
        this.state.entryRef = entryRef;
        document.title = `${this.state.entry.title || "Wpis"} — Od Dna do Światła`;
        
        this.render();
        this.modules.disqus.init();
        this.modules.likeButton.init();
        
        updateDoc(entryRef, { views: increment(1) }).catch(console.error);
    },

    cacheElements() {
        this.elements.wrapper = document.getElementById('entry-wrapper');
        this.elements.progressBar = document.getElementById('progress-bar');
    },

    render() {
        const e = this.state.entry;
        const backLink = `Sekcja.html?section=${encodeURIComponent(this.state.sectionName)}`;
        this.elements.wrapper.innerHTML = `
            <header class="page-header">
                <h1>${e.section || this.state.sectionName}</h1>
                <a href="${backLink}" class="back-to-home-button">⟵ Powrót do sekcji</a>
            </header>
            <main class="content-container">
                <article class="entry-content">
                    <h2>${e.title || "Bez tytułu"}</h2>
                    <div class="entry-meta-bar">
                        <span class="meta-item"><i class="fa-solid fa-user-pen"></i> ${e.author || 'Anonim'}</span>
                        <span class="meta-item"><i class="fa-solid fa-calendar-days"></i> ${e.createdAt ? e.createdAt.toDate().toLocaleDateString('pl-PL') : ''}</span>
                        <span class="meta-item"><i class="fa-solid fa-eye"></i> <span id="views-count">${(e.views || 0) + 1}</span></span>
                        <span class="meta-item"><i class="fa-solid fa-heart"></i> <span id="likes-count">${e.likes || 0}</span></span>
                    </div>
                    <div id="entry-text">${e.text || ""}</div>
                    
                    <div class="entry-actions">
                        <button id="like-btn" class="like-btn" aria-label="Polub ten wpis">
                            <i class="fa-solid fa-heart"></i> Polub
                        </button>
                        <div class="share-buttons" style="margin-left: auto;">
                            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank" aria-label="Udostępnij na Facebooku"><i class="fab fa-facebook"></i></a>
                            <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(e.title)}" target="_blank" aria-label="Udostępnij na Twitterze"><i class="fab fa-twitter"></i></a>
                            <a href="mailto:?subject=${encodeURIComponent(e.title)}&body=${encodeURIComponent('Zobacz ten wpis: ' + window.location.href)}" aria-label="Udostępnij przez e-mail"><i class="fa-solid fa-envelope"></i></a>
                        </div>
                    </div>
                </article>

                <div class="nav-buttons">
                    <a id="prev-btn" class="nav-btn speak-button hidden">⟵ Poprzedni</a>
                    <a id="next-btn" class="nav-btn speak-button hidden">Następny ⟶</a>
                </div>

                <section id="comments" class="comments-section">
                    <h2>Podziel się swoją historią lub wesprzyj innych</h2>
                    <div id="disqus_thread"></div>
                </section>
            </main>`;
        
        setTimeout(() => this.elements.wrapper.classList.add('loaded'), 10);
        this.modules.navigation.init();
    },

    renderError(title, message) {
        this.elements.wrapper.innerHTML = `<header class="page-header"><h1>${title}</h1></header><main class="content-container"><p>${message}</p></main>`;
        this.elements.wrapper.classList.add('loaded');
    },

    modules: {
        theme: {
            init(sectionName) {
                let themeClass = 'theme-kronika';
                if (sectionName === 'Piciorys Chudego') themeClass = 'theme-piciorys';
                else if (sectionName.toLowerCase().includes('księżniczki')) themeClass = 'theme-ksiezniczka';
                document.documentElement.className = themeClass;
            }
        },
        progressBar: {
            init() {
                window.addEventListener('scroll', this.update, { passive: true });
            },
            update() {
                const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = (window.scrollY / totalHeight) * 100;
                WpisApp.elements.progressBar.style.width = `${progress}%`;
            }
        },
        likeButton: {
            init() {
                this.likeBtn = document.getElementById('like-btn');
                this.likesCountEl = document.getElementById('likes-count');
                this.entryId = WpisApp.state.entryId;

                if (localStorage.getItem(`liked_${this.entryId}`)) {
                    this.likeBtn.classList.add('liked');
                }
                this.likeBtn.addEventListener('click', () => this.toggleLike());
            },
            async toggleLike() {
                if (this.likeBtn.classList.contains('liked')) return;
                this.likeBtn.classList.add('liked');
                localStorage.setItem(`liked_${this.entryId}`, 'true');
                this.likesCountEl.textContent = parseInt(this.likesCountEl.textContent) + 1;
                await updateDoc(WpisApp.state.entryRef, { likes: increment(1) });
            }
        },
        navigation: {
            async init() {
                const { sectionName, entry } = WpisApp.state;
                const prevBtn = document.getElementById('prev-btn');
                const nextBtn = document.getElementById('next-btn');

                const prevQuery = query(collection(db, "sekcje", sectionName, "entries"), orderBy("createdAt", "asc"), where("createdAt", ">", entry.createdAt), limit(1));
                const nextQuery = query(collection(db, "sekcje", sectionName, "entries"), orderBy("createdAt", "desc"), where("createdAt", "<", entry.createdAt), limit(1));

                const [prevSnap, nextSnap] = await Promise.all([getDocs(prevQuery), getDocs(nextQuery)]);

                if (!prevSnap.empty) {
                    const prevId = prevSnap.docs[0].id;
                    prevBtn.href = `Wpis.html?section=${encodeURIComponent(sectionName)}&id=${prevId}`;
                    prevBtn.classList.remove('hidden');
                }
                if (!nextSnap.empty) {
                    const nextId = nextSnap.docs[0].id;
                    nextBtn.href = `Wpis.html?section=${encodeURIComponent(sectionName)}&id=${nextId}`;
                    nextBtn.classList.remove('hidden');
                }
            }
        },
        disqus: {
            init() {
                window.disqus_config = function () {
                    this.page.url = window.location.href;
                    this.page.identifier = WpisApp.state.entryId;
                };
                const d = document, s = d.createElement('script');
                s.src = `https://od-dna-do-swiatla.disqus.com/embed.js`;
                s.setAttribute('data-timestamp', +new Date());
                (d.head || d.body).appendChild(s);
            }
        }
    }
};

WpisApp.init();

