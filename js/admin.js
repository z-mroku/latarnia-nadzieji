
// Plik: /js/admin.js (WERSJA OSTATECZNA Z SILNIKIEM MOTYWÓW)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, collectionGroup, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as sref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
  messagingSenderId: "244008044225",
  appId: "1:244008044225:web:67fbc7f5cfa89b627fb640",
  measurementId: "G-LNYWJD2YV7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);
    const DRAFT_KEY = 'adminEntryDraft_v_final_v7';
    const THEME_KEY = 'adminTheme_v1';
    const PAGE_SIZE = 10;
    
    const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const stripHtml = (s = '') => String(s).replace(/<[^>]*>?/gm, '');
    const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

    function toast(message, ok = true, timeout = 3500) {
        let t = $('#globalToast');
        if (!t) {
            t = document.createElement('div'); t.id = 'globalToast';
            document.body.appendChild(t);
        }
        const el = document.createElement('div');
        el.className = `toast-item ${ok ? 'ok' : 'error'}`;
        el.textContent = message;
        t.appendChild(el);
        setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 500); }, timeout);
    }
    
    function confirmAction({ title = 'Potwierdź działanie', text = 'Czy na pewno chcesz to zrobić?', confirmText = 'Potwierdź', confirmClass = 'danger' }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            const modalTitle = document.getElementById('customModalTitle');
            const modalText = document.getElementById('customModalText');
            const confirmBtn = document.getElementById('customConfirmBtn');
            const cancelBtn = document.getElementById('customCancelBtn');

            modalTitle.textContent = title;
            modalText.textContent = text;
            confirmBtn.textContent = confirmText;
            confirmBtn.className = `primary ${confirmClass}`;
            modal.classList.add('open');

            const close = (result) => {
                modal.classList.remove('open');
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                document.removeEventListener('keydown', escapeListener);
                resolve(result);
            };
            const escapeListener = (e) => { if (e.key === 'Escape') close(false); };
            confirmBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            document.addEventListener('keydown', escapeListener);
        });
    }

    onAuthStateChanged(auth, user => {
        if (user) {
            document.body.style.visibility = 'visible';
            initPanel(user).catch(console.error);
        } else {
            window.location.href = 'login.html';
        }
    });

    async function initPanel(user) {
        const adminEmail = $('adminEmail');
        if (adminEmail) adminEmail.textContent = user.email || user.uid;
        $('logoutBtn')?.addEventListener('click', () => signOut(auth).catch(console.error));
        const state = {
            editors: {}, editId: { menu: null, help: null, spark: null, playlist: null, note: null },
            entry: { data: null, cache: [], currentPage: 1, totalPages: 1 },
            menuItems: [],
            lazyModules: new Set(), selectedTTSId: null
        };
        initTheme();
        await initEditor(state);
        initEntryForm(state);
        initEntryListAndFilter(state);
        initLivePreview(state);
        initIconPicker(state);
        initTTS(state);
        initEntryModal(state);
        initLazyLoading(state);
    }
    
    function initTheme() {
        const themeToggle = $('themeToggle');
        const root = document.documentElement;
        const applyTheme = (theme) => {
            root.setAttribute('data-theme', theme);
            localStorage.setItem(THEME_KEY, theme);
            if (themeToggle) themeToggle.textContent = (theme === 'light' ? '🌞' : '🌙');
        };
        const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
        applyTheme(savedTheme);
        themeToggle?.addEventListener('click', () => applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
    }

    async function initEditor(state) {
        class FirebaseUploadAdapter {
            constructor(loader) { this.loader = loader; }
            upload() {
                return this.loader.file.then(file => new Promise(async (resolve, reject) => {
                    try {
                        const fileName = `entries_images/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
                        const storageRef = sref(storage, fileName);
                        const uploadTask = uploadBytesResumable(storageRef, file);
                        uploadTask.on('state_changed', null, reject, () => getDownloadURL(uploadTask.snapshot.ref).then(url => resolve({ default: url })));
                    } catch (e) { reject(e); }
                }));
            }
            abort() {}
        }
        function FirebaseUploadAdapterPlugin(editor) {
            editor.plugins.get('FileRepository').createUploadAdapter = (loader) => new FirebaseUploadAdapter(loader);
        }
        const editorConfig = {
            language: 'pl',
            extraPlugins: [FirebaseUploadAdapterPlugin],
            toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|', 'outdent', 'indent', '|', 'blockQuote', 'insertTable', '|', 'imageUpload', 'undo', 'redo'],
            image: { toolbar: ['imageTextAlternative', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side'] },
            table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] }
        };
        const simpleEditorConfig = {
            language: 'pl',
            toolbar: ['heading', '|', 'bold', 'italic', 'underline', '|', 'link', 'bulletedList', 'numberedList', 'blockQuote', '|', 'undo', 'redo'],
        };
        try {
            state.editors.main = await ClassicEditor.create($('contentInput'), editorConfig);
            state.editors.main.model.document.on('change', debounce(() => { updateLivePreview(state); saveDraft(state); }, 350));
            const helpEditorEl = $('helpDesc');
            if (helpEditorEl) state.editors.help = await ClassicEditor.create(helpEditorEl, simpleEditorConfig);
            const noteEditorEl = $('noteContent');
            if (noteEditorEl) state.editors.notes = await ClassicEditor.create(noteEditorEl, simpleEditorConfig);
        } catch (error) {
            console.error('Błąd krytyczny inicjalizacji CKEditor:', error);
            toast('Błąd krytyczny edytora! Odśwież stronę.', false, 10000);
        }
    }

    function initEntryForm(state) {
        const form = $('entryForm'), publishBtn = $('publishBtn'), cancelBtn = $('cancelEntryEditBtn'), clearDraftBtn = $('clearDraftBtn');
        form?.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            publishBtn.disabled = true;
            publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zapisuję...';
            const payload = {
                section: $('sectionSelect').value || 'Kronika',
                author: $('authorInput').value.trim() || 'Chudy',
                title: $('titleInput').value.trim(),
                text: state.editors.main.getData(),
                theme: $('themeSelect').value || 'auto',
                updatedAt: serverTimestamp()
            };

            if (!payload.title && stripHtml(payload.text).length < 10) {
                toast('Tytuł lub treść są wymagane.', false);
                publishBtn.disabled = false;
                publishBtn.textContent = 'Opublikuj';
                return;
            }

            try {
                const file = $('attachInput').files[0];
                if (file) {
                    const progress = $('entryUploadProgress');
                    progress.style.display = 'block';
                    progress.value = 0;
                    const filePath = `entries_attachments/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
                    const fileRef = sref(storage, filePath);
                    const uploadTask = uploadBytesResumable(fileRef, file);
                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', (snap) => { progress.value = (snap.bytesTransferred / snap.totalBytes) * 100; }, (err) => reject(err), async () => {
                            payload.attachment = { url: await getDownloadURL(uploadTask.snapshot.ref), meta: { path: filePath, name: file.name, type: file.type } };
                            progress.style.display = 'none';
                            resolve();
                        });
                    });
                }

                const sectionName = payload.section;
                const sectionRef = doc(db, 'sekcje', sectionName);
                const sectionSnap = await getDoc(sectionRef);

                if (!sectionSnap.exists()) {
                    await setDoc(sectionRef, {
                        name: sectionName,
                        createdAt: serverTimestamp()
                    });
                    toast(`Utworzono nową sekcję: ${sectionName}`, true);
                }

                if (state.entry.data) {
                    const oldSection = state.entry.data.section;
                    const newSection = payload.section;
                    const entryId = state.entry.data.id;
                    if (oldSection !== newSection) {
                        const oldDocRef = doc(db, 'sekcje', oldSection, 'entries', entryId);
                        const oldDocSnap = await getDoc(oldDocRef);
                        if (oldDocSnap.exists()) {
                            const existingData = oldDocSnap.data();
                            const newDocRef = doc(db, 'sekcje', newSection, 'entries', entryId);
                            await setDoc(newDocRef, { ...existingData, ...payload });
                            await deleteDoc(oldDocRef);
                            toast('Wpis przeniesiony i zaktualizowany');
                        }
                    } else {
                        await updateDoc(doc(db, 'sekcje', oldSection, 'entries', entryId), payload);
                        toast('Wpis zaktualizowany');
                    }
                } else {
                    payload.createdAt = serverTimestamp();
                    await addDoc(collection(sectionRef, 'entries'), payload);
                    toast('Wpis opublikowany');
                }
                resetEntryForm(state);
            } catch (e) {
                console.error('Błąd podczas publikacji:', e);
                toast(`Błąd publikacji: ${e.message}`, false, 10000);
            } finally {
                publishBtn.disabled = false;
                publishBtn.textContent = 'Opublikuj';
            }
        });

        cancelBtn?.addEventListener('click', () => resetEntryForm(state));
        clearDraftBtn?.addEventListener('click', async () => {
            if (await confirmAction({title: "Wyczyścić szkic?", text: "Spowoduje to usunięcie niezapisanej treści z edytora."})) {
                localStorage.removeItem(DRAFT_KEY);
                resetEntryForm(state);
                toast('Szkic usunięty');
            }
        });
        loadDraft(state);
        setInterval(() => saveDraft(state), 15000);
    }

    function resetEntryForm(state) {
        $('entryForm')?.reset();
        state.editors.main?.setData('');
        state.entry.data = null;
        $('cancelEntryEditBtn').style.display = 'none';
        $('publishBtn').textContent = 'Opublikuj';
        $('uploadPreview').innerHTML = '';
        localStorage.removeItem(DRAFT_KEY);
        updateDraftBadge();
        updateLivePreview(state);
    }
    function saveDraft(state) {
        if (!state.editors.main || state.entry.data) return;
        const draft = {
            section: $('sectionSelect').value, author: $('authorInput').value, title: $('titleInput').value,
            html: state.editors.main.getData(), ts: Date.now()
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        updateDraftBadge();
    }
    function loadDraft(state) {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (confirm(`Znaleziono niezapisany szkic z ${new Date(draft.ts).toLocaleString('pl-PL')}. Czy chcesz go wczytać?`)) {
            $('sectionSelect').value = draft.section;
            $('authorInput').value = draft.author;
            $('titleInput').value = draft.title;
            state.editors.main?.setData(draft.html || '');
            updateLivePreview(state);
        } else {
            localStorage.removeItem(DRAFT_KEY);
        }
        updateDraftBadge();
    }
    function updateDraftBadge() {
        const badge = $('draftBadge');
        if (!badge) return;
        const raw = localStorage.getItem(DRAFT_KEY);
        badge.style.display = raw ? 'inline-flex' : 'none';
        if (!raw) return;
        const { ts } = JSON.parse(raw);
        badge.textContent = ts ? `Szkic: ${new Date(ts).toLocaleTimeString('pl-PL')}` : 'Szkic';
    }
    
    function initEntryListAndFilter(state) {
        const rerender = debounce(() => renderEntries(state), 200);
        $('filterSection').addEventListener('change', rerender);
        $('searchInput').addEventListener('input', rerender);
        $('sortSelect').addEventListener('change', rerender);
        const listEl = $('entriesList');
        if (!listEl) return;
        listEl.addEventListener('click', async (e) => {
            const item = e.target.closest('.list-item');
            if (!item) return;
            const button = e.target.closest('button[data-action]');
            if (button) {
                e.stopPropagation();
                const id = item.dataset.id;
                const entry = state.entry.cache.find(en => en.id === id);
                if (!entry) return toast('Nie znaleziono wpisu.', false);
                const action = button.dataset.action;
                switch (action) {
                    case 'read': openEntryModal(entry); break;
                    case 'listen': speakText(entry); break;
                    case 'edit':
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        state.entry.data = entry;
                        $('sectionSelect').value = entry.section;
                        $('authorInput').value = entry.author;
                        $('titleInput').value = entry.title;
                        $('themeSelect').value = entry.theme;
                        state.editors.main.setData(entry.text || '');
                        $('uploadPreview').innerHTML = entry.attachment ? `<a href="${entry.attachment.url}" target="_blank">${entry.attachment.meta.name}</a>` : '';
                        $('publishBtn').textContent = 'Zapisz zmiany';
                        $('cancelEntryEditBtn').style.display = 'inline-block';
                        break;
                    case 'del':
                        if (await confirmAction({ title: 'Potwierdź usunięcie', text: `Czy na pewno chcesz usunąć wpis "${entry.title}"?`, confirmText: 'Usuń' })) {
                            try {
                                if (entry.attachment?.meta.path) await deleteObject(sref(storage, entry.attachment.meta.path));
                                await deleteDoc(doc(db, 'sekcje', entry.section, 'entries', id));
                                toast('Wpis usunięty.');
                            } catch (err) { toast('Błąd podczas usuwania.', false); console.error(err); }
                        }
                        break;
                }
            } else {
                document.querySelectorAll('.list-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                state.selectedTTSId = item.dataset.id;
                $('ttsListenBtn').disabled = false;
                $('readerSelectionInfo').innerHTML = `Zaznaczono: <strong>${escapeHtml(item.querySelector('.entry-title').textContent)}</strong>`;
            }
        });
        onSnapshot(query(collectionGroup(db, 'entries'), orderBy('createdAt', 'desc')), (snapshot) => {
            state.entry.cache = snapshot.docs.map(d => {
                const pathParts = d.ref.path.split('/');
                const section = pathParts.length > 2 ? pathParts[1] : 'Nieznana';
                return { id: d.id, section, ...d.data() };
            });
            renderEntries(state);
            populateSectionSelect(state.entry.cache, state.menuItems);
        });
        onSnapshot(query(collection(db, 'menu'), orderBy('order')), (snapshot) => {
            state.menuItems = snapshot.docs.map(d => d.data());
            populateSectionSelect(state.entry.cache, state.menuItems);
        });
    }

    function renderEntries(state, page = state.entry.currentPage) {
        const listEl = $('entriesList');
        if (!listEl) return;
        let filtered = [...state.entry.cache];
        const section = $('filterSection').value, search = $('searchInput').value.toLowerCase(), sort = $('sortSelect').value;
        if (section) filtered = filtered.filter(e => e.section === section);
        if (search) filtered = filtered.filter(e => (e.title?.toLowerCase() || '').includes(search) || stripHtml(e.text || '').toLowerCase().includes(search));
        filtered.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0, timeB = b.createdAt?.seconds || 0;
            if (sort === 'asc') return timeA - timeB;
            if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
            return timeB - timeA;
        });
        state.entry.totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        state.entry.currentPage = Math.min(Math.max(1, page), state.entry.totalPages);
        const start = (state.entry.currentPage - 1) * PAGE_SIZE, pageItems = filtered.slice(start, start + PAGE_SIZE);
        listEl.innerHTML = pageItems.length > 0 ? '' : '<div class="list-empty-state">Brak wpisów spełniających kryteria.</div>';
        pageItems.forEach(e => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.dataset.id = e.id;
            const date = (e.updatedAt || e.createdAt)?.toDate().toLocaleString('pl-PL') || '',
                  excerpt = stripHtml(e.text || '').slice(0, 150) + '...',
                  thumbUrl = e.text?.match(/<img[^>]+src="([^">]+)"/)?.[1] || e.attachment?.url,
                  thumb = thumbUrl ? `<img src="${thumbUrl}" class="entry-list-thumb">` : `<div class="entry-list-thumb-placeholder"><i class="fa-solid fa-image"></i></div>`;
            div.innerHTML = `
                <div class="entry-list-main">
                    ${thumb}
                    <div class="entry-list-content">
                        <div class="entry-title">${escapeHtml(e.title) || '<em>Bez tytułu</em>'}</div>
                        <div class="muted-small">${escapeHtml(e.section)} • ${escapeHtml(e.author)} • ${date}</div>
                        <div class="excerpt">${escapeHtml(excerpt)}</div>
                    </div>
                </div>
                <div class="entry-actions-corner">
                    <button class="ghost small" data-action="read" title="Czytaj"><i class="fa-solid fa-eye"></i></button>
                    <button class="ghost small" data-action="listen" title="Odsłuchaj"><i class="fa-solid fa-headphones-simple"></i></button>
                    <button class="ghost small" data-action="edit" title="Edytuj"><i class="fa-solid fa-pen"></i></button>
                    <button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            listEl.appendChild(div);
        });
        renderPagination(state, filtered.length);
    }

    function renderPagination(state, totalItems) {
        const controls = $('paginationControls');
        controls.innerHTML = '';
        if (state.entry.totalPages <= 1) return;
        const info = document.createElement('div');
        info.className = 'pagination-info';
        info.textContent = `Strona ${state.entry.currentPage}/${state.entry.totalPages} (${totalItems} wpisów)`;
        controls.appendChild(info);
        const buttons = document.createElement('div');
        buttons.className = 'row';
        const prev = document.createElement('button');
        prev.textContent = '‹';
        prev.disabled = state.entry.currentPage <= 1;
        prev.onclick = () => renderEntries(state, state.entry.currentPage - 1);
        const next = document.createElement('button');
        next.textContent = '›';
        next.disabled = state.entry.currentPage >= state.entry.totalPages;
        next.onclick = () => renderEntries(state, state.entry.currentPage + 1);
        buttons.appendChild(prev);
        buttons.appendChild(next);
        controls.appendChild(buttons);
    }
    
    function populateSectionSelect(entries, menuItems) {
        const sectionsFromEntries = entries.map(e => e.section);
        const sectionsFromMenu = menuItems.map(item => item.text);
        const allSections = [...new Set([...sectionsFromEntries, ...sectionsFromMenu])].sort();
        const select = $('sectionSelect'), filter = $('filterSection');
        if (!select || !filter) return;
        const currentValSelect = select.value;
        const currentValFilter = filter.value;
        select.innerHTML = '';
        filter.innerHTML = '<option value="">Wszystkie sekcje</option>';
        allSections.forEach(s => {
            if (!s || s === 'undefined') return;
            const option = new Option(s, s);
            select.add(option.cloneNode(true));
            filter.add(option);
        });
        select.value = currentValSelect;
        filter.value = currentValFilter;
    }
    
    function initLivePreview(state) {
        const inputs = ['titleInput', 'authorInput', 'sectionSelect'];
        inputs.forEach(id => {
            $(id)?.addEventListener('input', debounce(() => updateLivePreview(state), 200));
        });
    }
    function updateLivePreview(state) {
        $('liveTitle').innerHTML = $('titleInput').value || 'Tytuł podglądu';
        $('liveMeta').textContent = `${$('authorInput').value || 'Autor'} • ${new Date().toLocaleString('pl-PL')} • Sekcja: ${$('sectionSelect').value}`;
        $('liveContent').innerHTML = state.editors.main?.getData() || '<em>Treść podglądu...</em>';
    }
    function initIconPicker() {
        const picker = $('iconPicker');
        if (!picker) return;
        const icons = ['fa-solid fa-heart', 'fa-solid fa-music', 'fa-solid fa-star', 'fa-solid fa-book', 'fa-solid fa-hands-praying', 'fa-solid fa-headphones'];
        picker.innerHTML = '';
        icons.forEach(cls => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = cls;
            btn.innerHTML = `<i class="${cls}"></i>`;
            btn.addEventListener('click', () => {
                const input = $('titleInput'), snippet = `<i class="${cls} fa-fw"></i> `;
                const start = input.selectionStart, end = input.selectionEnd;
                input.value = input.value.substring(0, start) + snippet + input.value.substring(end);
                input.selectionStart = input.selectionEnd = start + snippet.length;
                input.focus();
                input.dispatchEvent(new Event('input'));
            });
            picker.appendChild(btn);
        });
    }

    function initTTS(state) {
        if ('speechSynthesis' in window) {
            const populateVoices = () => {
                const select = $('ttsVoiceSelect');
                if (!select) return;
                const currentVoice = select.value;
                select.innerHTML = '';
                speechSynthesis.getVoices().filter(v => v.lang.startsWith('pl')).forEach(v => {
                    select.add(new Option(`${v.name} (${v.lang})`, v.name));
                });
                if (currentVoice) select.value = currentVoice;
            };
            populateVoices();
            if (speechSynthesis.onvoiceschanged !== undefined) {
              speechSynthesis.onvoiceschanged = populateVoices;
            }
        }
        $('ttsPreviewBtn')?.addEventListener('click', () => {
            speakText({ title: $('titleInput').value, text: state.editors.main?.getData() });
        });
        $('ttsListenBtn')?.addEventListener('click', () => {
            if (!state.selectedTTSId) return toast('Zaznacz wpis z listy.', false);
            const entry = state.entry.cache.find(e => e.id === state.selectedTTSId);
            if (entry) speakText(entry);
        });
    }
    
    function speakText(entry) {
        if (!('speechSynthesis' in window)) return toast('Lektor nie jest dostępny.', false);
        const textToSpeak = stripHtml(`${entry.title || ''}. ${entry.text || ''}`).trim();
        if (!textToSpeak) return toast('Brak tekstu do odczytania.', false);
        
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'pl-PL';
        
        const selectedVoiceName = document.getElementById('ttsVoiceSelect').value;
        const voice = speechSynthesis.getVoices().find(v => v.name === selectedVoiceName);
        if (voice) utterance.voice = voice;
        
        const statusEl = document.getElementById('readerStatus');
        
        utterance.onstart = () => statusEl.textContent = 'Lektor: czyta...';
        utterance.onend = () => statusEl.textContent = 'Lektor: gotowy';
        utterance.onerror = (e) => {
            statusEl.textContent = 'Błąd lektora';
            console.error("SpeechSynthesis Error:", e);
            toast("Błąd silnika mowy przeglądarki. Spróbuj wybrać inny głos.", false);
        };
        
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (e) {
                console.error("SpeechSynthesis speak error:", e);
                toast("Wystąpił błąd podczas próby odczytania tekstu.", false);
                statusEl.textContent = 'Błąd lektora';
            }
        }, 100);
    }

    function initEntryModal() {
        const modal = document.getElementById('entryModal');
        modal?.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('#modalCloseBtn, #modalCloseBtn2')) {
                closeEntryModal();
            }
        });
        window.addEventListener('keydown', (e) => e.key === 'Escape' && closeEntryModal());
    }
    
    function openEntryModal(entry) {
        document.getElementById('entryModalTitle').innerHTML = entry.title || 'Brak tytułu';
        document.getElementById('entryModalMeta').textContent = `${entry.section} • ${entry.author} • ${entry.createdAt?.toDate().toLocaleString('pl-PL')}`;
        const attachmentHTML = entry.attachment ? `<div class="modal-attachment"><a href="${entry.attachment.url}" target="_blank">Pobierz załącznik: ${entry.attachment.meta.name}</a></div>` : '';
        document.getElementById('entryModalBody').innerHTML = attachmentHTML + (entry.text || '');
        document.getElementById('entryModal').classList.add('open');
        document.getElementById('modalTtsBtn').onclick = () => speakText(entry);
        document.getElementById('modalEditBtn').onclick = () => {
            closeEntryModal();
            const editBtn = document.querySelector(`.list-item[data-id="${entry.id}"] button[data-action="edit"]`);
            editBtn?.click();
        };
    }

    function closeEntryModal() {
        document.getElementById('entryModal')?.classList.remove('open');
        if ('speechSynthesis' in window) speechSynthesis.cancel();
    }

    function initLazyLoading(state) {
        const lazySections = document.querySelectorAll('.lazy-load-section');
        if (!('IntersectionObserver' in window)) {
            lazySections.forEach(section => loadModule(section.dataset.module, section, state));
            return;
        }
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const moduleName = entry.target.dataset.module;
                    if (!state.lazyModules.has(moduleName)) {
                        state.lazyModules.add(moduleName);
                        loadModule(moduleName, entry.target, state);
                        obs.unobserve(entry.target);
                    }
                }
            });
        }, { rootMargin: '200px' });
        lazySections.forEach(section => observer.observe(section));
    }
    function loadModule(name, element, state) {
        element.classList.remove('lazy-load-section');
        const content = element.querySelector('.module-content');
        if (content) content.style.display = 'block';
        const moduleInitializers = {
            sparks: initSparks, playlist: initPlaylist, gallery: initGallery,
            menu: initMenu, help: initHelp, notes: initNotes,
        };
        if (moduleInitializers[name]) {
            moduleInitializers[name](state);
        }
    }

    function genericFormReset(form, state, stateKey, btnText = 'Dodaj') {
        state.editId[stateKey] = null;
        if (form) form.reset();
        form?.classList.remove('is-editing');
        const cancelBtn = $(`cancel${stateKey.charAt(0).toUpperCase() + stateKey.slice(1)}EditBtn`);
        if (cancelBtn) cancelBtn.style.display = 'none';
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = btnText;
    }

    function initSparks(state) {
        const form = $('sparkForm'), input = $('sparkInput'), cancelBtn = $('cancelSparkEditBtn');
        const listContainer = $('sparksList');
        let sparkCache = [];
        onSnapshot(query(collection(db, 'sparks'), orderBy('createdAt', 'desc')), (snapshot) => {
            sparkCache = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            listContainer.innerHTML = sparkCache.length > 0 ? '' : '<div class="list-empty-state">Brak elementów.</div>';
            sparkCache.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.id = item.id;
                div.innerHTML = `<div><i class="fa-solid fa-star"></i> ${escapeHtml(item.quote)}</div><div class="row"><button class="ghost small" data-action="edit" title="Edytuj"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button></div>`;
                listContainer.appendChild(div);
            });
        });
        listContainer.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const itemEl = e.target.closest('.list-item');
            const itemId = itemEl?.dataset.id;
            const item = sparkCache.find(i => i.id === itemId);
            if (!item) return;
            const action = button.dataset.action;
            if (action === 'edit') {
                state.editId.spark = item.id;
                input.value = item.quote;
                form.classList.add('is-editing');
                cancelBtn.style.display = 'inline-block';
                form.querySelector('button[type="submit"]').textContent = 'Zapisz';
                input.focus();
            } else if (action === 'del') {
                if (await confirmAction({ text: `Usunąć iskierkę: "${item.quote.slice(0,30)}..."?` })) {
                    await deleteDoc(doc(db, 'sparks', item.id));
                    toast('Iskierka usunięta');
                }
            }
        });
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const quote = input.value.trim();
            if (!quote) return;
            try {
                if (state.editId.spark) {
                    await updateDoc(doc(db, 'sparks', state.editId.spark), { quote });
                    toast('Iskierka zaktualizowana');
                } else {
                    await addDoc(collection(db, 'sparks'), { quote, createdAt: serverTimestamp() });
                    toast('Dodano iskierkę');
                }
                genericFormReset(form, state, 'spark');
            } catch (err) { toast('Błąd', false); console.error(err); }
        });
        cancelBtn.addEventListener('click', () => genericFormReset(form, state, 'spark'));
    }

    function initPlaylist(state) {
        const form = $('playlistForm'), titleInput = $('songTitle'), linkInput = $('songLink'), cancelBtn = $('cancelPlaylistEditBtn');
        const listContainer = $('playlistList');
        let playlistCache = [];
        onSnapshot(query(collection(db, 'playlist'), orderBy('createdAt', 'desc')), (snapshot) => {
            playlistCache = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            listContainer.innerHTML = playlistCache.length > 0 ? '' : '<div class="list-empty-state">Brak elementów.</div>';
            playlistCache.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.id = item.id;
                div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(item.title)}</div><div class="muted-small">${escapeHtml(item.link)}</div></div><div class="row"><button class="ghost small" data-action="edit" title="Edytuj"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button></div>`;
                listContainer.appendChild(div);
            });
        });
        listContainer.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const itemEl = e.target.closest('.list-item');
            const itemId = itemEl?.dataset.id;
            const item = playlistCache.find(i => i.id === itemId);
            if (!item) return;
            const action = button.dataset.action;
            if (action === 'edit') {
                state.editId.playlist = item.id;
                titleInput.value = item.title;
                linkInput.value = item.link;
                form.classList.add('is-editing');
                cancelBtn.style.display = 'inline-block';
                form.querySelector('button[type="submit"]').textContent = 'Zapisz';
                titleInput.focus();
            } else if (action === 'del') {
                 if (await confirmAction({ text: `Usunąć piosenkę "${item.title}"?` })) {
                    await deleteDoc(doc(db, 'playlist', item.id));
                    toast('Piosenka usunięta');
                }
            }
        });
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const title = titleInput.value.trim(), link = linkInput.value.trim();
            if (!title || !link) return;
            try {
                if (state.editId.playlist) {
                    await updateDoc(doc(db, 'playlist', state.editId.playlist), { title, link });
                    toast('Playlista zaktualizowana');
                } else {
                    await addDoc(collection(db, 'playlist'), { title, link, createdAt: serverTimestamp() });
                    toast('Dodano do playlisty');
                }
                genericFormReset(form, state, 'playlist');
            } catch (err) { toast('Błąd', false); console.error(err); }
        });
        cancelBtn.addEventListener('click', () => genericFormReset(form, state, 'playlist'));
    }
    
    function initGallery(state) {
        const form = $('galleryForm'), uploadInput = $('galleryUpload'), descInput = $('galleryDesc'), progress = $('galleryProgressBar');
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const file = uploadInput.files[0];
            const desc = descInput.value.trim();
            if (!file || !desc) return toast('Wybierz plik i dodaj opis.', false);
            progress.style.display = 'block';
            progress.value = 0;
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            try {
                const filePath = `gallery/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
                const fileRef = sref(storage, filePath);
                const uploadTask = uploadBytesResumable(fileRef, file);
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snap) => { progress.value = (snap.bytesTransferred / snap.totalBytes) * 100; }, 
                        (err) => reject(err), 
                        async () => {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            const payload = {
                                section: 'Galeria',
                                author: $('authorInput').value.trim() || 'System',
                                title: desc,
                                text: `<figure class="image"><img src="${url}"></figure>`,
                                theme: 'auto',
                                createdAt: serverTimestamp(),
                                attachment: { url: url, meta: { path: filePath, name: file.name, type: file.type } }
                            };
                            await addDoc(collection(db, 'sekcje', 'Galeria', 'entries'), payload);
                            resolve();
                        }
                    );
                });
                toast(`Dodano zdjęcie do galerii.`);
            } catch(err) {
                toast('Błąd wysyłania pliku.', false);
                console.error(err);
            } finally {
                form.reset();
                progress.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    function initMenu(state) {
        const form = $('menuForm'), textInput = $('menuText'), urlInput = $('menuUrl'), orderInput = $('menuOrder'), themeSelect = $('menuTheme'), cancelBtn = $('cancelMenuEditBtn');
        const listContainer = $('menuListContainer');
        let menuCache = [];

        const populateThemeSelect = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'themes'), orderBy('name')));
                themeSelect.innerHTML = '';
                snap.docs.forEach(doc => {
                    const themeName = doc.data().name;
                    themeSelect.add(new Option(themeName, themeName));
                });
            } catch (e) {
                console.error("Błąd ładowania motywów", e);
                toast("Błąd ładowania listy motywów", false);
            }
        };
        populateThemeSelect();

        onSnapshot(query(collection(db, 'menu'), orderBy('order')), (snapshot) => {
            menuCache = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            listContainer.innerHTML = menuCache.length > 0 ? '' : '<div class="list-empty-state">Brak elementów.</div>';
            menuCache.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.id = item.id;
                div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(item.text)}</div><div class="muted-small">${escapeHtml(item.url)} • ${item.order} • Motyw: ${escapeHtml(item.theme || 'Domyślny')}</div></div><div class="row"><button class="ghost small" data-action="edit" title="Edytuj"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button></div>`;
                listContainer.appendChild(div);
            });
        });

        listContainer.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const itemEl = e.target.closest('.list-item');
            const itemId = itemEl?.dataset.id;
            const item = menuCache.find(i => i.id === itemId);
            if (!item) return;
            const action = button.dataset.action;
            if (action === 'edit') {
                state.editId.menu = item.id;
                textInput.value = item.text;
                urlInput.value = item.url;
                orderInput.value = item.order;
                themeSelect.value = item.theme || '';
                form.classList.add('is-editing');
                cancelBtn.style.display = 'inline-block';
                form.querySelector('button[type="submit"]').textContent = 'Zapisz';
                textInput.focus();
            } else if (action === 'del') {
                if (await confirmAction({ text: `Usunąć element menu "${item.text}"?` })) {
                    await deleteDoc(doc(db, 'menu', item.id));
                    toast('Element menu usunięty');
                }
            }
        });
        
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const sectionName = textInput.value.trim();
            const data = {
                text: sectionName,
                url: urlInput.value.trim(),
                order: Number(orderInput.value) || 0,
                theme: themeSelect.value
            };
            if (!data.text || !data.url) return;
            try {
                // Używamy nazwy sekcji jako ID dokumentu, aby zapewnić spójność
                await setDoc(doc(db, 'menu', sectionName), data, { merge: true });
                if (state.editId.menu && state.editId.menu !== sectionName) {
                    // Jeśli zmieniono nazwę (ID), usuń stary dokument
                    await deleteDoc(doc(db, 'menu', state.editId.menu));
                }
                toast('Zapisano zmiany w menu');
                genericFormReset(form, state, 'menu', 'Zapisz');
            } catch (err) { toast('Błąd', false); console.error(err); }
        });
        cancelBtn.addEventListener('click', () => genericFormReset(form, state, 'menu', 'Zapisz'));
    }

    function initHelp(state) {
        const form = $('helpForm'), cancelBtn = $('cancelHelpEditBtn');
        const listContainer = $('helpListContainer');
        const fields = {
            woj: $('helpWoj'), name: $('helpName'), address: $('helpAddress'),
            phone: $('helpPhone'), link: $('helpLink')
        };
        let helpCache = [];
        onSnapshot(query(collection(db, 'help'), orderBy('name')), (snapshot) => {
            helpCache = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            listContainer.innerHTML = helpCache.length > 0 ? '' : '<div class="list-empty-state">Brak elementów.</div>';
            helpCache.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.id = item.id;
                div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(item.name)}</div><div class="muted-small">${escapeHtml(item.woj)} | ${escapeHtml(item.address)}</div></div><div class="row"><button class="ghost small" data-action="edit" title="Edytuj"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button></div>`;
                listContainer.appendChild(div);
            });
        });
        listContainer.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const itemEl = e.target.closest('.list-item');
            const itemId = itemEl?.dataset.id;
            const item = helpCache.find(i => i.id === itemId);
            if (!item) return;
            const action = button.dataset.action;
            if (action === 'edit') {
                state.editId.help = item.id;
                for (const key in fields) {
                    fields[key].value = item[key] || '';
                }
                state.editors.help.setData(item.desc || '');
                form.classList.add('is-editing');
                cancelBtn.style.display = 'inline-block';
                form.querySelector('button[type="submit"]').textContent = 'Zapisz zmiany';
                fields.name.focus();
            } else if (action === 'del') {
                if (await confirmAction({ text: `Usunąć pomoc "${item.name}"?` })) {
                    await deleteDoc(doc(db, 'help', item.id));
                    toast('Usunięto pomoc');
                }
            }
        });
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const data = {};
            for(const key in fields) {
                data[key] = fields[key].value;
            }
            data.desc = state.editors.help.getData();
            if(!data.name) return toast("Nazwa jest wymagana.", false);
            try {
                if(state.editId.help) {
                    await updateDoc(doc(db, 'help', state.editId.help), data);
                    toast("Pomoc zaktualizowana");
                } else {
                    data.createdAt = serverTimestamp();
                    await addDoc(collection(db, 'help'), data);
                    toast("Dodano nową pomoc");
                }
                genericFormReset(form, state, 'help', 'Zapisz');
                state.editors.help.setData('');
            } catch(err) { toast('Błąd', false); console.error(err); }
        });
        cancelBtn.addEventListener('click', () => {
            genericFormReset(form, state, 'help', 'Zapisz');
            state.editors.help.setData('');
        });
    }

    function initNotes(state) {
        const form = $('noteForm'), titleInput = $('noteTitle');
        const listContainer = $('noteListContainer');
        let notesCache = [];
        onSnapshot(query(collection(db, 'notes'), orderBy('createdAt', 'desc')), (snapshot) => {
            notesCache = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
            listContainer.innerHTML = notesCache.length > 0 ? '' : '<div class="list-empty-state">Brak elementów.</div>';
            notesCache.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.id = item.id;
                div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(item.title)}</div><div class="muted-small">${stripHtml(item.content).slice(0, 100)}...</div></div><div class="row"><button class="ghost small danger" data-action="del" title="Usuń"><i class="fa-solid fa-trash"></i></button></div>`;
                listContainer.appendChild(div);
            });
        });
        listContainer.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action="del"]');
            if (!button) return;
            const itemEl = e.target.closest('.list-item');
            const itemId = itemEl?.dataset.id;
            const item = notesCache.find(i => i.id === itemId);
            if (!item) return;
            if (await confirmAction({ text: `Usunąć notatkę "${item.title}"?` })) {
                await deleteDoc(doc(db, 'notes', item.id));
                toast('Notatka usunięta');
            }
        });
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const data = {
                title: titleInput.value.trim(),
                content: state.editors.notes.getData()
            };
            if(!data.title || !data.content) return toast("Tytuł i treść są wymagane.", false);
            try {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'notes'), data);
                toast("Dodano notatkę");
                form.reset();
                state.editors.notes.setData('');
            } catch(err) { toast('Błąd', false); console.error(err); }
        });
    }
});

