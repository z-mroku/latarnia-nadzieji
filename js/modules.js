// Plik: /js/modules.js
import { lektor } from '/js/lektor.js';

export const ModalModule = {
    modal: null,
    // Zmieniamy na przechowywanie samej funkcji handlera
    currentHandler: null, 
    
    init() {
        if (document.getElementById('glass-modal')) return;
        const modalHtml = `
            <div id="glass-modal" class="modal-overlay">
                <div class="modal-content">
                    <button class="modal-close-btn">&times;</button>
                    <h2 id="modal-title" class="modal-title"></h2>
                    <div id="modal-meta" class="modal-meta"></div>
                    <div id="modal-body" class="modal-body"></div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('glass-modal');
        const closeBtn = this.modal.querySelector('.modal-close-btn');

        // Używamy strzałki, żeby zachować kontekst 'this'
        document.body.addEventListener('click', (e) => this.handleReadMore(e));
        
        closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (event) => { 
            if (event.target === this.modal) this.close(); 
        });
    },

    handleReadMore(event) {
        const readMoreBtn = event.target.closest('.read-more-btn');
        if (readMoreBtn) {
            const storyItem = readMoreBtn.closest('.story-item');
            if (storyItem) {
                // Dodajemy zabezpieczenie na wypadek braku elementów
                const titleEl = storyItem.querySelector('.entry-title');
                const metaEl = storyItem.querySelector('.entry-meta');
                const contentEl = storyItem.querySelector('.full-content');
                
                if (titleEl && contentEl) {
                    this.open(
                        titleEl.textContent, 
                        metaEl ? metaEl.innerHTML : '', 
                        contentEl.innerHTML
                    );
                }
            }
        }
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
                <button class="action-button modal-internal-close-btn"><i class="fas fa-arrow-left"></i> Powrót</button>
            </div>
        `;

        // Definiujemy handler tak, aby był dostępny dla close()
        this.currentHandler = (event) => {
            const p = this.modal.querySelector('.lector-play');
            const pa = this.modal.querySelector('.lector-pause');
            const r = this.modal.querySelector('.lector-resume');
            if (!p || !pa || !r) return;

            if (event.type === 'lector-started' || event.type === 'lector-resumed') {
                p.style.display = 'none'; pa.style.display = 'inline-flex'; r.style.display = 'none';
            } else if (event.type === 'lector-paused') {
                pa.style.display = 'none'; r.style.display = 'inline-flex';
            } else if (event.type === 'lector-stopped' || event.type === 'lector-finished') {
                p.style.display = 'inline-flex'; pa.style.display = 'none'; r.style.display = 'none';
            }
        };

        // Rejestracja zdarzeń lektora
        const events = ['lector-started', 'lector-paused', 'lector-resumed', 'lector-stopped', 'lector-finished'];
        events.forEach(evt => document.addEventListener(evt, this.currentHandler));

        // Przypisanie akcji do przycisków
        this.modal.querySelector('.lector-play').onclick = () => lektor.enqueue(bodyHTML);
        this.modal.querySelector('.lector-pause').onclick = () => lektor.pause();
        this.modal.querySelector('.lector-resume').onclick = () => lektor.resume();
        this.modal.querySelector('.lector-stop').onclick = () => lektor.stop();
        this.modal.querySelector('.modal-internal-close-btn').onclick = () => this.close();

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => this.modal.classList.add('visible'), 10);
    },

    close() {
        if (!this.modal) return;
        lektor.stop();

        // Teraz usuwanie zadziała, bo currentHandler jest przypisany do obiektu
        if (this.currentHandler) {
            const events = ['lector-started', 'lector-paused', 'lector-resumed', 'lector-stopped', 'lector-finished'];
            events.forEach(evt => document.removeEventListener(evt, this.currentHandler));
            this.currentHandler = null;
        }

        this.modal.classList.remove('visible');
        document.body.style.overflow = '';
        setTimeout(() => {
            if (!this.modal.classList.contains('visible')) {
                this.modal.style.display = 'none';
            }
        }, 300);
    }
};
