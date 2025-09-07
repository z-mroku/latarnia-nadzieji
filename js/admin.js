// /js/admin.js
import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, where, limit, collectionGroup
  // ZMIANA: Dodano 'collectionGroup' do importów, aby móc odczytywać wpisy ze wszystkich podkolekcji 'entries'.
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id);
const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stripHtml  = (s = '') => String(s).replace(/<[^>]*>?/gm,'');
const debounce = (fn, ms = 250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; };
const DRAFT_KEY = 'adminEntryDraft_v1';

function showTemp(el, txt, ok = true){ if (!el) return; el.textContent = txt; el.className = ok ? 'muted-small success' : 'muted-small danger'; setTimeout(()=>{ el.textContent=''; el.className='muted-small'; }, 2200); }

onAuthStateChanged(auth, user => { if (!user) { window.location.href = 'login.html'; return; } initPanel(user); });

async function initPanel(user){
  // elements (some may be null depending on exact HTML structure)
  const adminEmail = $('adminEmail'), logoutBtn = $('logoutBtn');
  const menuForm = $('menuForm'), menuText = $('menuText'), menuUrl = $('menuUrl'), menuOrder = $('menuOrder'), addMenuBtn = $('addMenuBtn'), cancelMenuEditBtn = $('cancelMenuEditBtn'), menuListContainer = $('menuListContainer'), menuMsg = $('menuMsg');
  const entryForm = $('entryForm'), sectionSelect = $('sectionSelect'), authorInput = $('authorInput'), themeSelect = $('themeSelect'), titleInput = $('titleInput'), contentInput = $('contentInput'), attachInput = $('attachInput'), publishBtn = $('publishBtn'), cancelEntryEditBtn = $('cancelEntryEditBtn'), formMsg = $('formMsg'), uploadPreview = $('uploadPreview'), iconPicker = $('iconPicker'), draftBadge = $('draftBadge'), clearDraftBtn = $('clearDraftBtn');
  const filterSection = $('filterSection'), searchInput = $('searchInput'), sortSelect = $('sortSelect'), entriesList = $('entriesList');
  const liveTitle = $('liveTitle'), liveMeta = $('liveMeta'), liveContent = $('liveContent');
  const sparkForm = $('sparkForm'), sparkInput = $('sparkInput'), sparksList = $('sparksList');
  const playlistForm = $('playlistForm'), songTitle = $('songTitle'), songLink = $('songLink'), playlistList = $('playlistList');
  const galleryForm = $('galleryForm'), galleryDesc = $('galleryDesc'), galleryUpload = $('galleryUpload'), galleryProgressBar = $('galleryProgressBar'), galleryList = $('galleryList');
  const readerStatus = $('readerStatus'), ttsListenBtn = $('ttsListenBtn'), readerSelectionInfo = $('readerSelectionInfo');
  const helpForm = $('helpForm'), helpWoj = $('helpWoj'), helpName = $('helpName'), helpAddress = $('helpAddress'), helpPhone = $('helpPhone'), helpDesc = $('helpDesc'), helpLink = $('helpLink'), addHelpBtn = $('addHelpBtn'), cancelHelpEditBtn = $('cancelHelpEditBtn'), helpMsg = $('helpMsg'), helpListContainer = $('helpListContainer');
  const entryModal = $('entryModal'), entryModalTitle = $('entryModalTitle'), entryModalMeta = $('entryModalMeta'), entryModalBody = $('entryModalBody'), modalTtsBtn = $('modalTtsBtn'), modalCloseBtn = $('modalCloseBtn'), modalCloseBtn2 = $('modalCloseBtn2'), modalEditBtn = $('modalEditBtn');

  adminEmail.textContent = user.email || user.uid;
  logoutBtn?.addEventListener('click', () => signOut(auth).catch(console.error));

  // state
  let editMenuId = null, editHelpId = null, selectedEntryIdForTTS = null;
  // ZMIANA: editEntryId przechowuje teraz obiekt { id, section }, aby poprawnie edytować wpisy w nowej strukturze.
  let editEntryId = null; 
  let entriesCache = [];

  // CKEditor init (try immediately and on DOMContentLoaded to be safe)
  function getEditorHtml(){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) return CKEDITOR.instances.contentInput.getData(); } catch(e){} return contentInput?.value || ''; }
  function setEditorHtml(html=''){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) CKEDITOR.instances.contentInput.setData(html); else if (contentInput) contentInput.value = html; } catch(e){} }
  function initCk(){
    try {
      if (!window.CKEDITOR || !contentInput) return;
      if (CKEDITOR.instances.contentInput) return;
      const ed = CKEDITOR.replace('contentInput', { height: 260 });
      ed.on('change', () => { updateLivePreview(); saveDraft(); });
    } catch(e){ console.warn('initCk err', e); }
  }
  // call immediate and on DOMContentLoaded to ensure init
  initCk();
  document.addEventListener('DOMContentLoaded', initCk);

  function updateLivePreview(){
    if (liveTitle) liveTitle.innerHTML = titleInput?.value || 'Tytuł podglądu';
    if (liveMeta) { const who = authorInput?.value || 'Autor'; liveMeta.textContent = `${who} • ${new Date().toLocaleString('pl-PL')}`; }
    if (liveContent) liveContent.innerHTML = getEditorHtml() || '<em>Treść podglądu...</em>';
    if (uploadPreview){
      if (!uploadPreview.dataset.locked) {
        uploadPreview.innerHTML = '';
        const f = attachInput?.files?.[0];
        if (f){
          const url = URL.createObjectURL(f);
          if (f.type.startsWith('image/')){
            const img = document.createElement('img'); img.src = url; img.className = 'thumb'; uploadPreview.appendChild(img);
          } else { uploadPreview.textContent = f.name; }
        }
      }
    }
  }
  titleInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); });
  authorInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); });
  attachInput?.addEventListener('change', updateLivePreview);

  // icon picker (same as before)
  const icons = ['fa-solid fa-heart','fa-solid fa-music','fa-solid fa-star','fa-solid fa-book','fa-solid fa-hands-praying','fa-solid fa-headphones'];
  function buildIconPicker(){ if (!iconPicker) return; iconPicker.innerHTML = ''; icons.forEach(cls=>{ const b = document.createElement('button'); b.type = 'button'; b.title = cls; b.innerHTML = `<i class="${cls}"></i>`; b.addEventListener('click', ()=> { const snippet = `<i class="${cls} fa-fw"></i> `; if (!titleInput) return; const el = titleInput; const start = el.selectionStart ?? el.value.length; el.value = el.value.slice(0,start) + snippet + el.value.slice(el.selectionEnd ?? start); el.selectionStart = el.selectionEnd = start + snippet.length; el.focus(); updateLivePreview(); saveDraft(); }); iconPicker.appendChild(b); }); }
  buildIconPicker();

  // MENU logic unchanged (kept for compatibility)
  let menuEditId = null;
  menuForm?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const data = { text: menuText.value.trim(), url: menuUrl.value.trim(), order: Number(menuOrder.value) || 0, createdAt: serverTimestamp() };
    if (!data.text || !data.url) return;
    try {
      if (menuEditId) { await updateDoc(doc(db, 'menu', menuEditId), data); }
      else { await addDoc(collection(db, 'menu'), data); }
      menuForm.reset(); menuEditId = null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none';
      showTemp(menuMsg, 'Zapisano');
    } catch (e) { showTemp(menuMsg, 'Błąd', false); console.error(e); }
  });
  cancelMenuEditBtn?.addEventListener('click', () => { menuForm.reset(); menuEditId=null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none'; });

  function renderMenu(list=[]){
    if(!menuListContainer) return;
    menuListContainer.innerHTML = '';
    list.forEach(it=>{
      const div = document.createElement('div'); div.className = 'list-item';
      div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.text)}</div><div class="muted-small">${escapeHtml(it.url)} • ${it.order}</div></div>
        <div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      menuListContainer.appendChild(div);
    });
    menuListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => {
      const id = ev.currentTarget.dataset.id;
      const act = ev.currentTarget.dataset.action;
      if (act === 'edit') {
        const d = (await getDoc(doc(db, 'menu', id))).data();
        menuText.value = d.text; menuUrl.value = d.url; menuOrder.value = d.order; menuEditId = id; addMenuBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz'; cancelMenuEditBtn.style.display='inline-block';
      } else if (act === 'del' && confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'menu', id)); }
    }));
  }
  onSnapshot(query(collection(db, 'menu'), orderBy('order')), snap => { const items = snap.docs.map(d=>({id:d.id, ...d.data()})); renderMenu(items); populateSectionSelect(items); }, err => console.error('menu onSnapshot', err));

  function populateSectionSelect(menuItems=[]){
    if (!sectionSelect || !filterSection) return;
    const prev = sectionSelect.value;
    sectionSelect.innerHTML = '';
    filterSection.innerHTML = '<option value="">Wszystkie sekcje</option>';
    if (!menuItems.length){
      const opt = document.createElement('option'); opt.value = 'Kronika'; opt.textContent = 'Kronika'; sectionSelect.appendChild(opt); filterSection.appendChild(opt.cloneNode(true)); return;
    }
    menuItems.forEach(m=>{
      const opt = document.createElement('option'); opt.value = m.text; opt.textContent = m.text; sectionSelect.appendChild(opt); filterSection.appendChild(opt.cloneNode(true));
    });
    sectionSelect.value = prev || sectionSelect.value;
  }

  // HELP forms (unchanged)
  helpForm?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const data = { woj: helpWoj.value, name: helpName.value.trim(), address: helpAddress.value.trim(), phone: helpPhone.value.trim(), desc: helpDesc.value.trim(), link: helpLink.value.trim(), createdAt: serverTimestamp() };
    if(!data.name) return;
    try { if (editHelpId) { await updateDoc(doc(db, 'help', editHelpId), data); } else { await addDoc(collection(db, 'help'), data); } helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; showTemp(helpMsg, 'Zapisano'); } catch (e) { showTemp(helpMsg, 'Błąd', false); console.error(e); }
  });
  cancelHelpEditBtn?.addEventListener('click', () => { helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; });
  function renderHelp(list=[]){ if(!helpListContainer) return; helpListContainer.innerHTML = ''; list.forEach(it=>{ const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.name)}</div><div class="muted-small">${escapeHtml(it.woj)} | ${escapeHtml(it.address)}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>`; helpListContainer.appendChild(div); }); helpListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => { const id = ev.currentTarget.dataset.id; if (ev.currentTarget.dataset.action === 'edit') { const d = (await getDoc(doc(db, 'help', id))).data(); helpWoj.value=d.woj; helpName.value=d.name; helpAddress.value=d.address; helpPhone.value=d.phone; helpDesc.value=d.desc; helpLink.value=d.link; editHelpId = id; addHelpBtn.innerHTML='<i class="fa-solid fa-save"></i> Zapisz Zmiany'; cancelHelpEditBtn.style.display='inline-block'; } else if (confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'help', id)); } })); }
  onSnapshot(query(collection(db, 'help'), orderBy('createdAt','desc')), snap => renderHelp(snap.docs.map(d=>({id: d.id, ...d.data()}))));

  // DRAFTS
  function saveDraft(){ const draft = { section: sectionSelect?.value || '', author: authorInput?.value || '', theme: themeSelect?.value || 'auto', title: titleInput?.value || '', html: getEditorHtml() || '', ts: Date.now() }; try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); updateDraftBadge(); } catch(e){} }
  function loadDraft(){ try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return; const d = JSON.parse(raw); if (d.section) sectionSelect.value = d.section; if (d.author)  authorInput.value  = d.author; if (d.theme)   themeSelect.value  = d.theme; if (d.title)   titleInput.value   = d.title; if (d.html)    setEditorHtml(d.html); updateLivePreview(); updateDraftBadge(); } catch(e){} }
  function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); updateDraftBadge(); } catch(e){} }
  function updateDraftBadge(){ if (!draftBadge) return; const raw = localStorage.getItem(DRAFT_KEY); if (!raw) { draftBadge.textContent = 'Wersja robocza: —'; return; } try { const { ts } = JSON.parse(raw); if (!ts) { draftBadge.textContent = 'Wersja robocza: —'; return; } const dt = new Date(ts).toLocaleString('pl-PL'); draftBadge.textContent = `Wersja robocza: ${dt}`; } catch(e){ draftBadge.textContent = 'Wersja robocza: —'; } }
  loadDraft();
  clearDraftBtn?.addEventListener('click', ()=> { clearDraft(); showTemp(formMsg, 'Wyczyszczono wersję roboczą'); });
  setInterval(saveDraft, 15000);

  // ENTRIES: create / edit / render
  entryForm?.addEventListener('submit', async ev=>{ 
    ev.preventDefault();
    const title = (titleInput?.value || '').trim();
    const section = (sectionSelect?.value) || 'Kronika';
    const author = (authorInput?.value || '').trim() || 'Chudy';
    const theme = (themeSelect?.value || 'auto');
    const text = getEditorHtml().trim();
    if (!title || !text) return showTemp(formMsg, 'Tytuł i treść są wymagane', false);
    publishBtn.disabled = true; showTemp(formMsg, 'Trwa zapisywanie...');
    try {
      let attachment = null;
      const f = attachInput?.files?.[0];
      if (f) {
        // Logika uploadu pliku pozostaje bez zmian
        const safe = f.name.replace(/[^\w.\-]+/g,'_');
        const path = `entries/${Date.now()}_${safe}`;
        const sRef = sref(storage, path);
        const task = uploadBytesResumable(sRef, f);
        if (uploadPreview) {
          uploadPreview.dataset.locked = '1';
          uploadPreview.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div id="entryUploadThumb"></div><div style="flex:1"><div class="muted-small">Wysyłanie: ${escapeHtml(f.name)}</div><progress id="entryUploadProgress" value="0" max="100" style="width:100%"></progress></div></div>`;
          if (f.type.startsWith('image/')) { const img = document.createElement('img'); img.src = URL.createObjectURL(f); img.className = 'thumb'; uploadPreview.querySelector('#entryUploadThumb').appendChild(img); }
        }
        await new Promise((res,rej)=>{ task.on('state_changed', s => { const p = Math.round((s.bytesTransferred / s.totalBytes) * 100); const bar = document.getElementById('entryUploadProgress'); if (bar) bar.value = p; }, rej, res ); });
        const url = await getDownloadURL(sRef);
        attachment = { url, meta:{ path } };
        if (uploadPreview) { uploadPreview.innerHTML = attachment.url ? `<img src="${attachment.url}" class="thumb" alt="">` : ''; delete uploadPreview.dataset.locked; }
      }
      
      const payload = { section, title, author, text, attachment, theme, updatedAt: serverTimestamp() };
      
      // ZMIANA: Logika zapisu i aktualizacji wpisów
      if (editEntryId) {
        // Aktualizujemy wpis w jego oryginalnej lokalizacji
        const entryRef = doc(db, 'sekcje', editEntryId.section, 'entries', editEntryId.id);
        await updateDoc(entryRef, payload);
      } else {
        // Dodajemy nowy wpis do wybranej sekcji
        const entriesCollectionRef = collection(db, 'sekcje', section, 'entries');
        await addDoc(entriesCollectionRef, { ...payload, createdAt: serverTimestamp() });
      }

      entryForm.reset(); setEditorHtml(''); editEntryId=null; publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; cancelEntryEditBtn.style.display='none'; updateLivePreview(); clearDraft(); showTemp(formMsg, 'Zapisano');
    } catch (e) { showTemp(formMsg, 'Błąd zapisu', false); console.error(e); } finally { publishBtn.disabled = false; }
  });
  cancelEntryEditBtn?.addEventListener('click', ()=>{ editEntryId=null; entryForm?.reset(); setEditorHtml(''); cancelEntryEditBtn.style.display='none'; publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; updateLivePreview(); });

  function renderEntries(list=[]){
    if (!entriesList) return;
    let arr = list.slice();
    const filter = (filterSection?.value) || '';
    const q = (searchInput?.value || '').toLowerCase();
    const sort = (sortSelect?.value || 'desc');
    if (filter) arr = arr.filter(x => (x.section || '') === filter);
    if (q) arr = arr.filter(x => { const t = stripHtml(x.title||'').toLowerCase(); const s = stripHtml(x.text||'').toLowerCase(); return t.includes(q) || s.includes(q); });
    if (sort === 'title') arr.sort((a,b)=>(stripHtml(a.title||'')).localeCompare(stripHtml(b.title||''))); else if (sort==='asc') arr.sort((a,b)=>(a.createdAt?.seconds||0) - (b.createdAt?.seconds||0)); else arr.sort((a,b)=>(b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    
    entriesList.innerHTML = '';
    arr.forEach(e=>{
      const div = document.createElement('div'); div.className = 'list-item'; div.dataset.id = e.id;
      const date = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString('pl-PL') : '';
      const plain = stripHtml(e.text||'');
      const excerpt = plain.slice(0,150) + (plain.length>150 ? '…' : '');
      const attHtml = e.attachment?.url ? `<img src="${e.attachment.url}" class="entry-list-thumb" alt="Miniaturka">` : '';
      const titleHtml = e.title || 'Bez tytułu';
      div.innerHTML = `<div class="list-item-content">${attHtml}<div><div class="entry-title" style="font-weight:700">${titleHtml}</div><div class="muted-small">${escapeHtml(e.section||'')} • ${escapeHtml(e.author||'')} • ${date}</div><div style="margin-top:8px;color:#cfe4ff" class="excerpt">${escapeHtml(excerpt)}</div><div style="margin-top:6px"><button class="btn-link" data-action="read" data-id="${e.id}">Czytaj dalej</button></div></div></div><div class="row" style="gap:6px"><button class="ghost small listen" data-id="${e.id}" title="Odsłuchaj"><i class="fa-solid fa-headphones-simple"></i></button><button class="ghost small" data-action="edit" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      entriesList.appendChild(div);
    });

    // item click select
    entriesList.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        if (ev.target.closest('button') || ev.target.closest('a')) return;
        document.querySelectorAll('.list-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedEntryIdForTTS = item.dataset.id;
        ttsListenBtn.disabled = false;
        const titleEl = item.querySelector('.entry-title');
        const tmp = document.createElement('div'); tmp.innerHTML = titleEl ? titleEl.innerHTML : '';
        const plainTitle = tmp.textContent || tmp.innerText || '';
        readerSelectionInfo.innerHTML = `Zaznaczono: "<strong>${plainTitle}</strong>"`;
      });
    });

    // attach buttons behavior
    entriesList.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', async ev=>{
        ev.stopPropagation();
        const id = ev.currentTarget.dataset.id;
        const act = ev.currentTarget.dataset.action;
        
        // ZMIANA: Pobieramy pełny obiekt wpisu z pamięci podręcznej, aby uzyskać jego sekcję.
        const entry = entriesCache.find(e => e.id === id);
        if (!entry) {
          console.warn('Nie znaleziono wpisu w pamięci podręcznej dla ID:', id);
          return;
        }

        if (act === 'read') { openEntryModal(entry); return; }
        if (ev.currentTarget.classList.contains('listen')) {
          const txt = stripHtml((entry.title ? entry.title + '. ' : '') + (entry.text || '')).trim();
          speakText(txt, readerStatus);
          return;
        }
        if (act === 'edit') {
          try {
            const entryRef = doc(db, 'sekcje', entry.section, 'entries', id);
            const snap = await getDoc(entryRef);
            if (!snap.exists()) return alert('Wpis nie istnieje');
            const d = snap.data();
            
            // ZMIANA: Ustawiamy stan edycji z ID i nazwą sekcji.
            editEntryId = { id: id, section: entry.section };

            if (sectionSelect) sectionSelect.value = d.section || sectionSelect.value;
            if (titleInput) titleInput.value = d.title || '';
            if (authorInput) authorInput.value = d.author || '';
            if (themeSelect) themeSelect.value = d.theme || 'auto';
            setEditorHtml(d.text || '');
            if (d.attachment?.url && uploadPreview) uploadPreview.innerHTML = `<img src="${d.attachment.url}" class="thumb" alt="">`;
            publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany';
            cancelEntryEditBtn.style.display='inline-block';
            window.scrollTo({top:0,behavior:'smooth'});
            updateLivePreview();
          } catch (e) { console.error(e); alert('Błąd edycji'); }
        }
        if (act === 'del') {
          if (!confirm('Na pewno usunąć?')) return;
          try {
            const entryRef = doc(db, 'sekcje', entry.section, 'entries', id);
            const snap = await getDoc(entryRef);
            if (snap.exists()) {
              const d = snap.data();
              if (d.attachment?.meta?.path) await deleteObject(sref(storage, d.attachment.meta.path)).catch(()=>{});
            }
            await deleteDoc(entryRef);
          } catch(e) { console.error(e); alert('Błąd usuwania'); }
        }
      });
    });
  }

  // ZMIANA: Używamy zapytania collectionGroup, aby nasłuchiwać zmian we wszystkich podkolekcjach o nazwie 'entries'.
  onSnapshot(query(collectionGroup(db,'entries'), orderBy('createdAt','desc')), snap=>{ entriesCache = snap.docs.map(d=>({ id:d.id, ...d.data() })); renderEntries(entriesCache); }, err=>console.error('entries onSnapshot', err));
  
  const rerender = debounce(()=> renderEntries(entriesCache), 200);
  searchInput?.addEventListener('input', rerender);
  filterSection?.addEventListener('change', rerender);
  sortSelect?.addEventListener('change', rerender);

  // SPARKS, PLAYLIST, GALLERY remain similar - keep their listeners as before
  sparkForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const qtxt = (sparkInput?.value || '').trim(); if (!qtxt) return; try { await addDoc(collection(db,'sparks'), { quote:qtxt, createdAt: serverTimestamp() }); sparkInput.value=''; } catch(e){ console.error(e); } });
  playlistForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const t = (songTitle?.value || '').trim(); const l = (songLink?.value || '').trim(); if (!t || !l) return; try { await addDoc(collection(db,'playlist'), { title:t, link:l, createdAt: serverTimestamp() }); songTitle.value=''; songLink.value=''; } catch(e){ console.error(e); } });
  galleryForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const file = galleryUpload?.files?.[0]; const desc = (galleryDesc?.value || '').trim(); if (!file) return; const safe = file.name.replace(/[^\w.\-]+/g,'_'); const path = `gallery/${Date.now()}_${safe}`; const r = sref(storage, path); const task = uploadBytesResumable(r, file); task.on('state_changed', s=>{ const p = Math.round((s.bytesTransferred / s.totalBytes) * 100); if (galleryProgressBar) galleryProgressBar.value = p; }, console.error, async ()=>{ const url = await getDownloadURL(r); await addDoc(collection(db,'gallery'), { url, desc, meta:{ path }, createdAt: serverTimestamp() }); galleryForm.reset(); galleryProgressBar.value = 0; }); });
  onSnapshot(query(collection(db,'sparks'), orderBy('createdAt','desc')), snap => renderSparks(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  onSnapshot(query(collection(db,'playlist'), orderBy('createdAt','desc')), snap => renderPlaylist(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  onSnapshot(query(collection(db,'gallery'), orderBy('createdAt','desc')), snap => renderGallery(snap.docs.map(d=>({id: d.id, ...d.data()}))));

  function renderSparks(list=[]){ if(!sparksList) return; sparksList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = `<div><i class="fa-solid fa-star"></i> ${escapeHtml(s.quote)}</div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>`; sparksList.appendChild(el); }); sparksList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'sparks',id)); }); }); }
  function renderPlaylist(list=[]){ if(!playlistList) return; playlistList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = `<div><div style="font-weight:700">${escapeHtml(s.title)}</div><div class="muted-small">${escapeHtml(s.link)}</div></div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>`; playlistList.appendChild(el); }); playlistList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'playlist',id)); }); }); }
  function renderGallery(list=[]){ if(!galleryList) return; galleryList.innerHTML = ''; list.forEach(g=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><img src="${g.url}" class="thumb" alt=""><div style="font-weight:700">${escapeHtml(g.desc)}</div></div><div class="row"><button class="ghost small danger" data-id="${g.id}" data-path="${g.meta?.path}"><i class="fa-solid fa-trash"></i></button></div>`; galleryList.appendChild(el); }); galleryList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; const path = ev.currentTarget.dataset.path; if (!confirm('Usuń?')) return; try{ if (path) await deleteObject(sref(storage, path)).catch(()=>{}); await deleteDoc(doc(db,'gallery', id)); }catch(e){console.error(e);} }); }); }

  // TTS helper (global)
  function speakText(text, statusEl){
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pl-PL';
      if (statusEl) {
        u.onstart = ()=> statusEl.textContent = 'Lektor: czyta...';
        u.onend = ()=> { statusEl.textContent = 'Lektor: zakończono'; setTimeout(()=>statusEl.textContent='Lektor: gotowy', 1200); };
      }
      synth.speak(u);
    } catch(e) { console.error(e); }
  }

  ttsListenBtn?.addEventListener('click', async () => {
    if (!selectedEntryIdForTTS) return;
    // ZMIANA: Pobieramy dane z pamięci podręcznej zamiast odpytywać bazę danych
    const entry = entriesCache.find(e => e.id === selectedEntryIdForTTS);
    if (!entry) return alert('Nie znaleziono wpisu w pamięci podręcznej.');
    const txt = stripHtml((entry.title ? entry.title.replace(/<[^>]*>?/gm, '') + '. ' : '') + (entry.text || '')).trim();
    speakText(txt, readerStatus);
  });

  // OPEN ENTRY MODAL (full view + TTS + edit)
  function openEntryModal(entry) {
    if (!entry) {
        console.error("Próbowano otworzyć modal bez danych wpisu.");
        return;
    }
    showModalWithData(entry.id, entry);
  }

  function showModalWithData(id, d){
    entryModalTitle.textContent = d.title || 'Bez tytułu';
    const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('pl-PL') : '';
    entryModalMeta.textContent = `${d.section || ''} • ${d.author || ''} • ${date}`;
    entryModalBody.innerHTML = (d.attachment?.url ? `<p><img src="${d.attachment.url}" style="max-width:100%; border-radius:8px; margin-bottom:10px"></p>` : '') + (d.text || '');
    entryModal.classList.add('open');
    // set modal buttons
    modalTtsBtn.onclick = () => {
      const txt = stripHtml((d.title ? d.title + '. ' : '') + (d.text || ''));
      speakText(txt, readerStatus);
    };
    modalEditBtn.onclick = async () => {
      entryModal.classList.remove('open');
      try {
        // ZMIANA: Tworzymy poprawną ścieżkę do dokumentu w podkolekcji
        const entryRef = doc(db, 'sekcje', d.section, 'entries', id);
        const snap = await getDoc(entryRef);
        if (!snap.exists()) return alert('Wpis nie istnieje');
        const docData = snap.data();
        
        // ZMIANA: Ustawiamy stan edycji z ID i sekcją
        editEntryId = { id: id, section: d.section };
        
        if (sectionSelect) sectionSelect.value = docData.section || sectionSelect.value;
        if (titleInput) titleInput.value = docData.title || '';
        if (authorInput) authorInput.value = docData.author || '';
        if (themeSelect) themeSelect.value = docData.theme || 'auto';
        setEditorHtml(docData.text || '');
        if (docData.attachment?.url && uploadPreview) uploadPreview.innerHTML = `<img src="${docData.attachment.url}" class="thumb" alt="">`;
        publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany';
        cancelEntryEditBtn.style.display='inline-block';
        window.scrollTo({top:0,behavior:'smooth'});
        updateLivePreview();
      } catch(e){ console.error(e); alert('Błąd przy ładowaniu do edycji'); }
    };
  }
  function closeEntryModal(){ entryModal.classList.remove('open'); window.speechSynthesis?.cancel(); }
  modalCloseBtn?.addEventListener('click', closeEntryModal);
  modalCloseBtn2?.addEventListener('click', closeEntryModal);
  entryModal?.addEventListener('click', (ev)=>{ if (ev.target === entryModal) closeEntryModal(); });
  window.addEventListener('keydown', (ev)=> { if (ev.key === 'Escape') closeEntryModal(); });

  // initial live preview
  updateLivePreview();
}

/* End of admin.js */
