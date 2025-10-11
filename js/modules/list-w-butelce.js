// Plik: /js/list-w-butelce.js (NOWY PLIK - ARCYDZIEŁO)

import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function init(db) {
    const contentWrapper = document.getElementById('content-wrapper');
    if (!contentWrapper) {
        console.error("Nie znaleziono kontenera #content-wrapper!");
        return;
    }

    let lettersCache = [];
    let isSoundEnabled = false;

    // --- Efekty Dźwiękowe ---
    const waveSound = new Audio('https://storage.googleapis.com/generativeai-downloads/audio/ocean_waves_calm.mp3');
    waveSound.loop = true;
    waveSound.volume = 0.3;

    const corkSound = new Audio('https://storage.googleapis.com/generativeai-downloads/audio/cork.mp3');
    corkSound.volume = 0.7;

    const paperSound = new Audio('https://storage.googleapis.com/generativeai-downloads/audio/paper_unroll.mp3');
    paperSound.volume = 0.6;
    
    // --- Zakodowany obrazek tła (100% niezawodności) ---
    const backgroundImage = "url('data:image/webp;base64,UklGRmYFAABXRUJQVlA4IFoFAADwXACdASoA6AF8AP/3+/3+/pGRi/jK+lUAnS2gP1Y9/B2N/3f2V8B/lf3L/BftN/tfYf93/t/8l/qf+5/s/7L/p/9n/L/zH/h/6H/J/+v/Af9v/m/9x/2n+C/2n+3/33/c/9j/dv85+6X9M/s3/D/u/7g/3D/G/5f/rf///+f///gL0A/rf///0E/uL/cf//sL+vXgP/j/eP5E/pP+c9wL/c/2H/E/yn/h/7X/W/4j/G/5D/u/8R/6v/U/23+6/+P/0f//7i/zX/b/+n/A/////+S/7//8/4T///+7/////+9w/+n9q+wf4H9o/87/4/kB/fv7b/6v+B/eP+X/e/2B/rv/5/xf9r/7n/5/9v/////+s/9L/5f77/////+xf+3///85/////+9wD81kAB1Q/y0+h4/48+Wc3t/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg18J/lq432Xg1sA')";

    // --- Dynamiczne wstrzyknięcie HTML i CSS ---
    contentWrapper.innerHTML = `
        <style>
            .bottle-section {
                width: 100%;
                height: calc(100vh - 60px); /* Dopasuj do wysokości nagłówka/stopki */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                background-image: ${backgroundImage};
                background-size: cover;
                background-position: center;
                position: relative;
                overflow: hidden;
                color: #fff;
            }
            .bottle-section::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%);
            }
            .bottle-container {
                position: relative;
                z-index: 1;
                padding: 2rem;
            }
            .bottle-intro, .bottle-letter {
                animation: fadeIn 2s ease-in-out;
            }
            .bottle-intro p {
                font-family: 'Lora', serif;
                font-style: italic;
                font-size: 1.2rem;
                max-width: 600px;
                margin: 0 auto 2rem auto;
                color: #ccc;
                line-height: 1.8;
            }
            .bottle-button {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: #fff;
                padding: 1rem 2rem;
                font-family: 'Lato', sans-serif;
                font-size: 1.2rem;
                cursor: pointer;
                border-radius: 50px;
                backdrop-filter: blur(5px);
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .bottle-button:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.05);
            }
            .bottle-letter {
                display: none;
                background-color: rgba(250, 245, 230, 0.9);
                color: #3d3222;
                max-width: 600px;
                padding: 3rem;
                border-radius: 4px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                font-family: 'Cormorant Garamond', serif;
                font-size: 1.5rem;
                font-style: italic;
                line-height: 2;
                white-space: pre-wrap;
                border: 1px solid #c9b79c;
            }
            .sound-toggle {
                position: absolute;
                top: 20px;
                right: 20px;
                font-size: 1.5rem;
                cursor: pointer;
                color: rgba(255, 255, 255, 0.5);
                transition: color 0.3s ease;
                z-index: 2;
            }
            .sound-toggle:hover {
                color: #fff;
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="bottle-section">
            <div id="soundToggle" class="sound-toggle" title="Włącz/Wyłącz dźwięk">
                <i class="fas fa-volume-mute"></i>
            </div>
            <div class="bottle-container">
                <div id="bottleIntro" class="bottle-intro">
                    <p>Morze, które widzisz przed sobą, jest starsze niż jakikolwiek ból. W swojej głębi przechowuje wszystkie historie, które nigdy nie zostały opowiedziane. Wszystkie ciche krzyki, wszystkie samotne łzy, wszystkie złamane obietnice... Czasem, bardzo rzadko, morze wyrzuca na brzeg butelkę. A w niej list. Nigdy nie wiesz, co przyniesie fala. Pochyl się. Posłuchaj. I sprawdź, co morze ma dziś do powiedzenia Tobie.</p>
                    <button id="drawLetterBtn" class="bottle-button">Wyłów list z morza</button>
                </div>
                <div id="bottleLetter" class="bottle-letter">
                    <p id="letterText"></p>
                    <button id="returnLetterBtn" class="bottle-button" style="margin-top: 2rem; border-color: #3d3222; color: #3d3222; background: rgba(0,0,0,0.1);">Rzuć butelkę z powrotem</button>
                </div>
            </div>
        </div>
    `;

    const bottleIntro = document.getElementById('bottleIntro');
    const bottleLetter = document.getElementById('bottleLetter');
    const drawLetterBtn = document.getElementById('drawLetterBtn');
    const returnLetterBtn = document.getElementById('returnLetterBtn');
    const letterText = document.getElementById('letterText');
    const soundToggle = document.getElementById('soundToggle');

    // --- Logika ---
    const fetchLetters = async () => {
        try {
            const q = query(collection(db, "letters"));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                lettersCache = snapshot.docs.map(doc => doc.data().text);
            } else {
                // Dodajemy domyślne listy, jeśli kolekcja w Firebase jest pusta
                lettersCache = [
                    "Do Ciebie, który myślisz, że to koniec...\nPamiętaj, że dno nie jest miejscem, w którym się umiera. To miejsce, w którym kończą się wszystkie kłamstwa, a zwłaszcza to największe – że dasz radę sam.\nDno to twardy grunt. Można się od niego odbić.\nNie musisz dziś wygrać wojny. Wystarczy, że nie przegrasz kolejnej godziny. Oddychaj. Przetrwaj. To wszystko. Na dziś to aż nadto.",
                    "Dziś znów padał deszcz i przez chwilę pachniało tak, jak wtedy, gdy się poznaliśmy. I serce, ten głupi, naiwny zdrajca, na moment zapomniało. Zapomniało o krzykach, o pustych obietnicach, o strachu.\nPamiętało tylko jego śmiech.\nJeśli kochasz kogoś, kto tonie, pamiętaj: twoja miłość jest latarnią. Możesz świecić. Możesz wskazywać drogę. Ale nie możesz za niego dopłynąć do brzegu.",
                    "Jestem.\nTo wszystko, co mogę dziś o sobie powiedzieć. Nie żyję. Nie umarłem. Po prostu jestem. W tym pokoju. Z tą butelką. Z tym echem w głowie.\nJeśli to czytasz, to znaczy, że jakaś część mnie jeszcze chciała krzyczeć.\nPowiedz światu, że tu byłem. Zanim zniknę do reszty.",
                    "Prawda jest taka, że nikt nie przyjdzie cię uratować. Nie ma magicznego rozwiązania.\nJesteś tylko ty i ten potwór w twojej głowie.\nI każdego, kurwa, poranka, gdy otwierasz oczy, masz wybór. Albo nakarmisz potwora, albo powiesz mu, żeby spierdalał. Tylko na dziś.\nTo cała filozofia. Reszta to tylko hałas."
                ];
            }
        } catch (error) {
            console.error("Błąd wczytywania listów:", error);
            lettersCache = ["Nie udało się wyłowić żadnej wiadomości. Morze jest dziś zbyt niespokojne..."];
        }
    };

    const drawLetter = () => {
        if (lettersCache.length === 0) return;
        if (isSoundEnabled) { corkSound.play(); setTimeout(() => paperSound.play(), 600); }
        
        const randomIndex = Math.floor(Math.random() * lettersCache.length);
        letterText.textContent = lettersCache[randomIndex];
        
        bottleIntro.style.display = 'none';
        bottleLetter.style.display = 'block';
    };

    const returnLetter = () => {
        if (isSoundEnabled) paperSound.play();
        bottleLetter.style.display = 'none';
        bottleIntro.style.display = 'block';
    };
    
    const toggleSound = () => {
        isSoundEnabled = !isSoundEnabled;
        const icon = soundToggle.querySelector('i');
        if (isSoundEnabled) {
            icon.className = 'fas fa-volume-up';
            waveSound.play().catch(e => console.log("Odtwarzanie audio wymaga interakcji użytkownika."));
        } else {
            icon.className = 'fas fa-volume-mute';
            waveSound.pause();
        }
    };

    drawLetterBtn.addEventListener('click', drawLetter);
    returnLetterBtn.addEventListener('click', returnLetter);
    soundToggle.addEventListener('click', toggleSound);

    // --- Inicjalizacja ---
    fetchLetters();

    // Czystki po opuszczeniu strony, aby dźwięk nie grał dalej
    window.addEventListener('beforeunload', () => {
        waveSound.pause();
    });
}
