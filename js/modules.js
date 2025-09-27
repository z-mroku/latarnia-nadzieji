// Plik: /js/modules.js (WERSJA Z LEKTOREM ARCYMISTRZA)

// =====================================================================
// == LEKTOR ARCYMISTRZA – Ratunek w sztormie "Od Dna do Światła" ==
// =====================================================================
class ArcymistrzLektor {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.currentUtterance = null;
    this.queue = [];
    this.isSpeaking = false;
    this.isPaused = false;

    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = this.synth.getVoices();
    this.voice = this.voices.find(v => v.lang.startsWith("pl")) || this.voices[0];
  }

  cleanText(text) {
    return text.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").replace(/\bitd\./gi, "i tak dalej").replace(/\bitp\./gi, "i tym podobne").replace(/\bdr\./gi, "doktor").replace(/\bprof\./gi, "profesor").trim();
  }

  splitText(text, maxLength = 200) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let chunks = [];
    let current = "";
    for (let sentence of sentences) {
      if ((current + sentence).length > maxLength) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += " " + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  enqueue(text) {
    this.stop(); // Zatrzymaj poprzednie, jeśli jakieś było
    const clean = this.cleanText(text);
    const parts = this.splitText(clean);
    this.queue.push(...parts);
    if (!this.isSpeaking) {
      this.speakNext();
    }
  }

  speakNext() {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      document.dispatchEvent(new CustomEvent('lector-finished'));
      return;
    }
    this.isSpeaking = true;
    this.isPaused = false;
    const text = this.queue.shift();
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.voice = this.voice;
    this.currentUtterance.rate = 0.95;
    this.currentUtterance.pitch = 1.0;
    this.currentUtterance.volume = 1.0;
    this.currentUtterance.onend = () => this.speakNext();
    this.synth.speak(this.currentUtterance);
    document.dispatchEvent(new CustomEvent('lector-started'));
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.isPaused = true;
      document.dispatchEvent(new CustomEvent('lector-paused'));
    }
  }

  resume() {
    if (this.synth.paused) {
      this.synth.resume();
      this.isPaused = false;
      document.dispatchEvent(new CustomEvent('lector-resumed'));
    }
  }

  stop() {
    this.queue = [];
    this.synth.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    document.dispatchEvent(new CustomEvent('lector-stopped'));
  }
}

// Stwórz jedną, globalną instancję lektora dla całej strony
export const lektor = new ArcymistrzLektor();

// =====================================================================
// == MODUŁ OKNA MODALNEGO (zintegrowany z Lektorem Arcymistrza) ==
// =====================================================================
export const ModalModule = {
    modal: null,
    init() {
        if (document.getElementById('glass-modal')) return;
        const modalHtml = `<div id="glass-modal" class="modal-overlay"><div class="modal-content"><button class="modal-close-btn">&times;</button><h2 id="modal-title" class="modal-title"></h2><div id="modal-meta" class="modal-meta"></div><div id="modal-body" class="modal-body"></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('glass-modal');
        const closeBtn = this.modal.querySelector('.modal-close-btn');
        document.body.addEventListener('click', (event) => {
            const readMoreBtn = event.target.closest('.read-more-btn');
            if (readMoreBtn) {
                const storyItem = readMoreBtn.closest('.story-item');
                if (storyItem) {
                    const title = storyItem.querySelector('.entry-title').textContent;
                    const metaHTML = storyItem.querySelector('.entry-meta').innerHTML;
                    const bodyHTML = storyItem.querySelector('.full-content').innerHTML;
                    this.open(title, metaHTML, bodyHTML);
                }
            }
        });
        closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (event) => { if (event.target === this.modal) this.close(); });
    },
    open(title, metaHTML, bodyHTML) {
        if (!this.modal) return;
        const modalTitle = this.modal.querySelector('#modal-title');
        const modalMeta = this.modal.querySelector('#modal-meta');
        const modalBody = this.modal.querySelector('#modal-body');
        modalTitle.textContent = title.trim();
        modalMeta.innerHTML = metaHTML;
        
        modalBody.innerHTML = `
            <div class="modal-text-content">${bodyHTML}</div>
            <div class="modal-actions lector-controls">
                <button class="action-button lector-play"><i class="fas fa-play"></i> Czytaj</button>
                <button class="action-button lector-pause" style="display:none;"><i class="fas fa-pause"></i> Pauza</button>
                <button class="action-button lector-resume" style="display:none;"><i class="fas fa-play"></i> Wznów</button>
                <button class="action-button lector-stop"><i class="fas fa-stop"></i> Stop</button>
            </div>
        `;

        const playBtn = this.modal.querySelector('.lector-play');
        const pauseBtn = this.modal.querySelector('.lector-pause');
        const resumeBtn = this.modal.querySelector('.lector-resume');
        const stopBtn = this.modal.querySelector('.lector-stop');

        playBtn.onclick = () => lektor.enqueue(bodyHTML);
        pauseBtn.onclick = () => lektor.pause();
        resumeBtn.onclick = () => lektor.resume();
        stopBtn.onclick = () => lektor.stop();
        
        // Logika pokazywania i ukrywania przycisków
        document.addEventListener('lector-started', () => {
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-flex';
            resumeBtn.style.display = 'none';
        });
         document.addEventListener('lector-paused', () => {
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'inline-flex';
        });
        document.addEventListener('lector-resumed', () => {
            pauseBtn.style.display = 'inline-flex';
            resumeBtn.style.display = 'none';
        });
        const stopOrFinishHandler = () => {
            playBtn.style.display = 'inline-flex';
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'none';
        };
        document.addEventListener('lector-stopped', stopOrFinishHandler);
        document.addEventListener('lector-finished', stopOrFinishHandler);

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => this.modal.classList.add('visible'), 10);
    },
    close() {
        if (!this.modal) return;
        lektor.stop(); // Zawsze zatrzymuj lektora przy zamykaniu
        this.modal.classList.remove('visible');
        document.body.style.overflow = '';
        setTimeout(() => this.modal.style.display = 'none', 300);
    }
};
