// Plik: /js/main.js

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, collectionGroup, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Zmienne globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- Funkcja lektora (dla każdej sekcji osobno) ---
function createLector(buttonId, textElementId, buttonText = "Odsłuchaj") {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const textElement = document.getElementById(textElementId);
    if (!textElement) return;
    const fullText = (textElement.textContent || textElement.innerText || "").trim();
    if (!fullText) { btn.disabled = true; btn.style.opacity = 0.5; return; }

    const sentences = fullText.match(/[^.!?…]+[.!?…]?/g) || [fullText];
    let currentIndex = 0;
    let isReading = false;

    function readSentence(i) {
        if (!isReading || i >= sentences.length) {
            window.speechSynthesis.cancel();
            isReading = false;
            btn.textContent = `▶️ ${buttonText}`;
            currentIndex = 0;
            return;
        }
        const utterance = new SpeechSynthesisUtterance(sentences[i].trim());
        utterance.lang = "pl-PL";
        utterance.onend = () => { if (isReading) { currentIndex++; readSentence(currentIndex); } };
        window.speechSynthesis.speak(utterance);
    }

    btn.addEventListener("click", () => {
        const synth = window.speechSynthesis;
        if (isReading) { isReading = false; synth.cancel(); btn.textContent = `🔄 Wznów`; }
        else { isReading = true; btn.textContent = `⏸️ Pauza`; readSentence(currentIndex); }
    });
    window.addEventListener("beforeunload", () => window.speechSynthesis.cancel());
}

// --- Pobieranie menu ---
async function fetchAndRenderMenu(container) {
    try {
        const snapshot = await getDocs(query(collection(db, "menu"), orderBy("order", "asc")));
        container.innerHTML = snapshot.docs.map(doc => `<li><a href="${doc.data().url}">${doc.data().text}</a></li>`).join('') || '<li><a>Brak menu</a></li>';
    } catch (err) {
        console.error("Błąd wczytywania menu: ", err);
        container.innerHTML = '<li><a>Błąd wczytywania menu</a></li>';
    }
}

// --- Pobieranie iskierek ---
async function fetchSparks(textElement) {
    try {
        const snapshot = await getDocs(query(collection(db, "sparks"), orderBy("createdAt", "desc")));
        sparksFromDB = snapshot.docs.map(doc => doc.data().quote);
        if (sparksFromDB.length) changeSpark(textElement);
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

// --- Ładowanie treści Sekcja.html ---
async function loadSectionContent() {
    const params = new URLSearchParams(location.search);
    const sectionName = (params.get('nazwa') || '').trim();
    const wrapper = document.getElementById('dynamic-content-wrapper');
    if (!sectionName) {
        wrapper.innerHTML = `<h1>Błąd</h1><p>Brak nazwy sekcji w URL.</p>`; return;
    }

    const entriesRef = collection(db, 'sekcje', sectionName, 'entries');

    try {
        if (sectionName === 'Piciorys Chudego') {
            const snap = await getDocs(query(entriesRef, limit(1)));
            if (snap.empty) { wrapper.innerHTML = "<p>Brak wpisu w tej sekcji.</p>"; return; }
            const entry = snap.docs[0].data();
            const [quote, historia] = (entry.text || '').split('---PODZIAL---');

            wrapper.innerHTML = `
                <h2>${entry.title || ''}</h2>
                <div id="piciorys-wstep">${quote || ''}</div>
                <button id="speakBtn1">▶️ Odsłuchaj Wstęp</button>
                <div id="piciorys-historia">${historia || ''}</div>
                <button id="speakBtn2">▶️ Odsłuchaj Historię</button>
            `;
            createLector("speakBtn1", "piciorys-wstep");
            createLector("speakBtn2", "piciorys-historia");
        } 
        else if (sectionName.toLowerCase().includes('księżniczki')) {
            const snap = await getDocs(query(entriesRef, limit(1)));
            if (snap.empty) { wrapper.innerHTML = "<p>Brak wpisu w tej sekcji.</p>"; return; }
            const entry = snap.docs[0].data();

            wrapper.innerHTML = `
                <h2>${entry.title || ''}</h2>
                <div id="ksiezniczka-text">${entry.text || ''}</div>
                <button id="speakBtn">▶️ Odsłuchaj</button>
            `;
            createLector("speakBtn", "ksiezniczka-text");
        } 
        else if (sectionName === 'Pomoc') {
            const snap = await getDocs(query(entriesRef, orderBy("woj")));
            const grouped = snap.docs.reduce((acc, doc) => {
                const e = doc.data(); const woj = e.woj || 'Inne';
                if (!acc[woj]) acc[woj] = [];
                acc[woj].push(e); return acc;
            }, {});

            let html = '';
            Object.keys(grouped).forEach(woj => {
                html += `<h3>${woj}</h3>`;
                grouped[woj].forEach(e => html += `<p>${e.name} – ${e.address || ''} – ${e.phone || ''}</p>`);
            });
            wrapper.innerHTML = html;
        }
        else {
            const snap = await getDocs(query(entriesRef, orderBy("createdAt", "desc")));
            if (snap.empty) { wrapper.innerHTML = "<p>Brak wpisów w tej sekcji.</p>"; return; }

            wrapper.innerHTML = snap.docs.map(doc => {
                const e = doc.data();
                const contentId = `content-full-${doc.id}`;
                const buttonId = `button-speak-${doc.id}`;
                return `
                    <h3>${e.title || ''}</h3>
                    <div class="wpis-skrot">${e.text.substring(0, 300)}...</div>
                    <div id="${contentId}" style="display:none;">${e.text}</div>
                    <button class="czytaj-dalej-btn">...czytaj dalej</button>
                    <button id="${buttonId}" style="display:none;">▶️ Odsłuchaj</button>
                `;
            }).join('');

            document.querySelectorAll('.czytaj-dalej-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const parent = this.previousElementSibling;
                    const content = this.nextElementSibling;
                    const lektorBtn = content.nextElementSibling;
                    const isVisible = content.style.display === 'block';
                    content.style.display = isVisible ? 'none' : 'block';
                    lektorBtn.style.display = isVisible ? 'none' : 'inline-block';
                    this.textContent = isVisible ? '...czytaj dalej' : 'Zwiń';
                });
            });

            snap.docs.forEach(doc => {
                const contentId = `content-full-${doc.id}`;
                const buttonId = `button-speak-${doc.id}`;
                createLector(buttonId, contentId);
            });
        }
    } catch (err) {
        console.error("Błąd wczytywania sekcji:", err);
        wrapper.innerHTML = "<p>Błąd wczytywania sekcji. Sprawdź konsolę.</p>";
    }
}

// --- START ---
document.addEventListener("DOMContentLoaded", () => {
    const menuContainer = document.getElementById('main-menu');
    const sparkTextElement = document.getElementById("sparkText");
    const sparkButton = document.getElementById("sparkButton");

    if (menuContainer) fetchAndRenderMenu(menuContainer);
    if (sparkTextElement) fetchSparks(sparkTextElement);
    if (sparkButton) sparkButton.addEventListener("click", () => changeSpark(sparkTextElement));

    // Jeśli jesteśmy na Sekcja.html
    if (document.getElementBy
        // Jeśli jesteśmy na Sekcja.html
    if (document.getElementById('dynamic-content-wrapper')) {
        loadSectionContent();
    }
});
