
// Plik: /js/modules.js
import { lektor } from './lektor.js';

export const ModalModule = {
    modal: null,
    eventListeners: [], // Przechowujemy referencje, aby je później usunąć
    init() {
        if (document.getElementById('glass-modal')) return;
        const modalHtml = `<div id="glass-modal" class="modal-overlay"><div class="modal-content"><button class="modal-close-btn">&times;</button><h2 id="modal-title" class="modal-title"></h2><div id="modal-meta" class="modal-meta"></div><div id="modal-body" class="modal-body"></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('glass-modal');
        const closeBtn = this.modal.querySelector('.modal-close-btn');

        document.body.addEventListener('click', this.handleReadMore.bind(this));
        closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (event) => { if (event.target === this.modal) this.close(); });
    },
    handleReadMore(event) {
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

        const playBtn = this.modal.querySelector('.lector-play');
        const pauseBtn = this.modal.querySelector('.lector-pause');
        const resumeBtn = this.modal.querySelector('.lector-resume');
        const stopBtn = this.modal.querySelector('.lector-stop');
        const closeBtn = this.modal.querySelector('.modal-internal-close-btn');

        playBtn.onclick = () => lektor.enqueue(bodyHTML);
        pauseBtn.onclick = () => lektor.pause();
        resumeBtn.onclick = () => lektor.resume();
        stopBtn.onclick = () => lektor.stop();
        closeBtn.onclick = () => this.close();
        
        const lectorEventHandler = (event) => {
            const playBtn = this.modal?.querySelector('.lector-play');
            const pauseBtn = this.modal?.querySelector('.lector-pause');
            const resumeBtn = this.modal?.querySelector('.lector-resume');
            if (!playBtn || !pauseBtn || !resumeBtn) return;

            if (event.type === 'lector-started' || event.type === 'lector-resumed') {
                playBtn.style.display = 'none';
                pauseBtn.style.display = 'inline-flex';
                resumeBtn.style.display = 'none';
            } else if (event.type === 'lector-paused') {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-flex';
            } else if (event.type === 'lector-stopped' || event.type === 'lector-finished') {
                playBtn.style.display = 'inline-flex';
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'none';
            }
        };

        this.eventListeners = ['lector-started', 'lector-paused', 'lector-resumed', 'lector-stopped', 'lector-finished'];
        this.eventListeners.forEach(evt => {
            document.addEventListener(evt, lectorEventHandler);
        });

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => this.modal.classList.add('visible'), 10);
    },
    close() {
        if (!this.modal) return;
        lektor.stop();
        // Usuwamy listenery, aby uniknąć wycieków pamięci
        this.eventListeners.forEach(evt => document.removeEventListener(evt, this.lectorEventHandler));
        this.eventListeners = [];

        this.modal.classList.remove('visible');
        document.body.style.overflow = '';
        setTimeout(() => this.modal.style.display = 'none', 300);
    }
};

