
// Plik: /js/lektor.js
// ========================================
// Lektor Arcymistrz PRO – Serce projektu
// ========================================

export const lektor = (() => {
    let queue = [];
    let currentUtterance = null;
    let isPaused = false;
    let selectedVoice = null;
    let mode = "lektorski"; // Domyślny tryb

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
        if (num > 99999) return num.toString(); // Ograniczenie dla bezpieczeństwa
        const ones = ["zero", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
        const teens = ["dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
        const tens = ["", "dziesięć", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
        const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
        if (num < 1000) return hundreds[Math.floor(num / 100)] + (num % 100 ? " " + numToWords(num % 100) : "");
        if (num === 1000) return "tysiąc";
        const thousands = Math.floor(num / 1000);
        const remainder = num % 1000;
        if (thousands === 1) return "tysiąc" + (remainder ? " " + numToWords(remainder) : "");
        const endings = { 2: "tysiące", 3: "tysiące", 4: "tysiące" };
        const ending = (endings[thousands] || "tysięcy");
        return numToWords(thousands) + " " + ending + (remainder ? " " + numToWords(remainder) : "");
    };

    const parseDate = (str) => {
        const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!match) return null;
        const [_, d, m, y] = match.map(Number);
        const months = ["", "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
        return `${numToWords(d)} ${months[m]} ${numToWords(y)} roku`;
    };

    const normalizeText = (input = "") => {
        let text = stripHtml(input);
        const replacements = { "np.": "na przykład", "itd.": "i tak dalej", "itp.": "i tym podobne", "m.in.": "między innymi", "tj.": "to jest", "dr ": "doktor ", "prof.": "profesor", "ul.": "ulica" };
        for (const [abbr, full] of Object.entries(replacements)) {
            text = text.replace(new RegExp("\\b" + abbr.replace(".", "\\.") + "\\b", "gi"), full);
        }
        text = text.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (d) => parseDate(d) || d);
        text = text.replace(/\b(\d+)\b/g, (n) => { const num = parseInt(n, 10); return isNaN(num) ? n : numToWords(num); });
        return text.replace(/\s+/g, " ").trim();
    };

    const splitText = (text, maxLen = 250) => {
        const parts = [];
        const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [];
        let chunk = "";
        for (const s of sentences) {
            if ((chunk + " " + s).length > maxLen) {
                if (chunk) parts.push(chunk.trim());
                chunk = s;
            } else {
                chunk += " " + s;
            }
        }
        if (chunk.trim()) parts.push(chunk.trim());
        return parts;
    };

    const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return null;
        return voices.find(v => v.lang === "pl-PL") || voices.find(v => v.lang && v.lang.startsWith("pl")) || voices.find(v => v.default) || voices[0];
    };

    const initVoices = () => {
        selectedVoice = pickVoice();
        if (selectedVoice) console.log("✅ Wybrany głos lektora:", selectedVoice.name);
    };

    window.speechSynthesis.onvoiceschanged = initVoices;
    initVoices();

    const enqueue = (rawText) => {
        if (!rawText) return;
        stop();
        const clean = normalizeText(rawText);
        const parts = splitText(clean);
        queue.push(...parts);
        if (!currentUtterance) speakNext();
    };

    const speakNext = () => {
        if (queue.length === 0) {
            currentUtterance = null;
            document.dispatchEvent(new CustomEvent('lector-finished'));
            return;
        }
        const text = queue.shift();
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = "pl-PL";
        if (selectedVoice) currentUtterance.voice = selectedVoice;
        const cfg = modes[mode] || modes.normalny;
        currentUtterance.rate = cfg.rate;
        currentUtterance.pitch = cfg.pitch;
        currentUtterance.volume = cfg.volume;
        currentUtterance.onend = () => { if (!isPaused) speakNext(); };
        currentUtterance.onerror = (e) => { console.error("❌ Błąd lektora:", e); currentUtterance = null; speakNext(); };
        window.speechSynthesis.speak(currentUtterance);
        document.dispatchEvent(new CustomEvent('lector-started'));
    };

    const stop = () => { isPaused = false; queue = []; window.speechSynthesis.cancel(); currentUtterance = null; document.dispatchEvent(new CustomEvent('lector-stopped')); };
    const pause = () => { if (window.speechSynthesis.speaking && !isPaused) { window.speechSynthesis.pause(); isPaused = true; document.dispatchEvent(new CustomEvent('lector-paused')); } };
    const resume = () => { if (isPaused) { window.speechSynthesis.resume(); isPaused = false; document.dispatchEvent(new CustomEvent('lector-resumed')); } };
    const setMode = (newMode) => { if (modes[newMode]) { mode = newMode; } };

    return { enqueue, stop, pause, resume, setMode };
})();

