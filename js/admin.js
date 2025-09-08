// /js/admin.js - WERSJA OSTATECZNA, SKŁADANA Z KAWAŁKÓW
import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot,
  serverTimestamp, getDocs, where, limit, collectionGroup, startAfter
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
  // Definicje elementów
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

  let editItemId = null;
  let editEntryId = null;
  let editGalleryId = null;
  let editHelpId = null;
  let entriesCache = [];

  function getEditorHtml(){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) return CKEDITOR.instances.contentInput.getData(); } catch(e){} return contentInput?.value || ''; }
  function setEditorHtml(html=''){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) CKEDITOR.instances.contentInput.setData(html); else if (contentInput) contentInput.value = html; } catch(e){} }
  function initCk(){ try { if (!window.CKEDITOR || !contentInput || CKEDITOR.instances.contentInput) return; const ed = CKEDITOR.replace('contentInput', { height: 260 }); ed.on('change', () => { updateLivePreview(); saveDraft(); }); } catch(e){ console.warn('initCk err', e); } }
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
          if (f.type.startsWith('image/')){ const img = document.createElement('img'); img.src = url; img.className = 'thumb'; uploadPreview.appendChild(img); } 
          else { uploadPreview.textContent = f.name; }
        }
      }
    }
  }
  titleInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); });
  authorInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); });
  attachInput?.addEventListener('change', updateLivePreview);

  const icons = ['fa-solid fa-heart','fa-solid fa-music','fa-solid fa-star','fa-solid fa-book','fa-solid fa-hands-praying','fa-solid fa-headphones'];
  function buildIconPicker(){ if (!iconPicker) return; iconPicker.innerHTML = ''; icons.forEach(cls=>{ const b = document.createElement('button'); b.type = 'button'; b.title = cls; b.innerHTML = `<i class="${cls}"></i>`; b.addEventListener('click', ()=> { const snippet = `<i class="${cls} fa-fw"></i> `; if (!titleInput) return; const el = titleInput; const start = el.selectionStart ?? el.value.length; el.value = el.value.slice(0,start) + snippet + el.value.slice(el.selectionEnd ?? start); el.selectionStart = el.selectionEnd = start + snippet.length; el.focus(); updateLivePreview(); saveDraft(); }); iconPicker.appendChild(b); }); }
  buildIconPicker();

  menuForm?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const textValue = menuText.value.trim();
    const urlValue = menuUrl.value.trim();
    const data = { 
      text: textValue, 
      url: urlValue, 
      name: textValue,
      order: Number(menuOrder.value) || 0,
      createdAt: serverTimestamp() 
    };
    if (!data.text || !data.url) return;

    const contentSections = ['Galeria', 'Piciorys Chudego', 'Z punktu widzenia księżniczki', 'Pomoc', 'Kronika'];
    const isContentSection = contentSections.some(name => textValue.toLowerCase().includes(name.toLowerCase())) || urlValue.startsWith('sekcja.html') || urlValue.startsWith('Galeria.html');
    const targetCollection = isContentSection ? 'sekcje' : 'menu';
    
    try {
      const docId = editItemId ? editItemId.id : textValue;
      const docRef = doc(db, targetCollection, docId);
      await setDoc(docRef, data, { merge: true });
      
      menuForm.reset(); editItemId = null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none';
      showTemp(menuMsg, `Zapisano w "${targetCollection}"`);
    } catch (e) { showTemp(menuMsg, 'Błąd zapisu', false); console.error(e); }
  });

  cancelMenuEditBtn?.addEventListener('click', () => { menuForm.reset(); editItemId=null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none'; });
  function renderCombinedList(menuList=[], sectionList=[]){
    if(!menuListContainer) return;
    const combined = [
      ...menuList.map(item => ({...item, collection: 'menu'})),
      ...sectionList.map(item => ({...item, collection: 'sekcje'}))
    ].sort((a,b) => a.order - b.order);

    menuListContainer.innerHTML = '';
    combined.forEach(it=>{
      const div = document.createElement('div'); div.className = 'list-item';
      div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.text)} <span class="badge" style="font-size: 0.7em;">${it.collection}</span></div><div class="muted-small">${escapeHtml(it.url)} • ${it.order}</div></div>
        <div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}" data-collection="${it.collection}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}" data-collection="${it.collection}"><i class="fa-solid fa-trash"></i></button></div>`;
      menuListContainer.appendChild(div);
    });

    menuListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => {
      const id = ev.currentTarget.dataset.id;
      const collectionName = ev.currentTarget.dataset.collection;
      const act = ev.currentTarget.dataset.action;
      if (act === 'edit') {
        const d = (await getDoc(doc(db, collectionName, id))).data();
        menuText.value = d.text; menuUrl.value = d.url; menuOrder.value = d.order;
        editItemId = { id: id, collection: collectionName };
        addMenuBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz'; cancelMenuEditBtn.style.display='inline-block';
      } else if (act === 'del' && confirm('Na pewno usunąć? (Usunięcie sekcji NIE usuwa jej wpisów. Wpisy trzeba usunąć osobno w karcie "Wpisy")')) {
        await deleteDoc(doc(db, collectionName, id));
      }
    }));
  }

  function populateSectionSelect(sections = []) {
    if (!sectionSelect || !filterSection) return;
    const currentVal = sectionSelect.value;
    const defaultValue = sections.find(s => s.name === 'Kronika')?.name || sections[0]?.name;
    
    sectionSelect.innerHTML = '';
    filterSection.innerHTML = '<option value="">Wszystkie sekcje</option>';
    sections.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      sectionSelect.appendChild(opt);
      filterSection.appendChild(opt.cloneNode(true));
    });
    if (sections.some(s => s.name === currentVal)) { sectionSelect.value = currentVal; }
    else if (defaultValue) { sectionSelect.value = defaultValue; }
  }

  onSnapshot(query(collection(db, 'menu'), orderBy('order')), menuSnap => {
    const menuItems = menuSnap.docs.map(d => ({id: d.id, ...d.data()}));
    onSnapshot(query(collection(db, 'sekcje'), orderBy('order')), sectionSnap => {
        const sectionItems = sectionSnap.docs.map(d => ({id: d.id, text: d.data().name, ...d.data()}));
        renderCombinedList(menuItems, sectionItems);
        populateSectionSelect(sectionItems);
    });
  });
  helpForm?.addEventListener('submit', async ev => { ev.preventDefault(); const data = { woj: helpWoj.value, name: helpName.value.trim(), address: helpAddress.value.trim(), phone: helpPhone.value.trim(), desc: helpDesc.value.trim(), link: helpLink.value.trim(), createdAt: serverTimestamp() }; if(!data.name) return; try { if (editHelpId) { await updateDoc(doc(db, 'help', editHelpId), data); } else { await addDoc(collection(db, 'help'), data); } helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; showTemp(helpMsg, 'Zapisano'); } catch (e) { showTemp(helpMsg, 'Błąd', false); console.error(e); } });
  cancelHelpEditBtn?.addEventListener('click', () => { helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; });
  function renderHelp(list=[]){ if(!helpListContainer) return; helpListContainer.innerHTML = ''; list.forEach(it=>{ const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.name)}</div><div class="muted-small">${escapeHtml(it.woj)} | ${escapeHtml(it.address)}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>`; helpListContainer.appendChild(div); }); helpListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => { const id = ev.currentTarget.dataset.id; if (ev.currentTarget.dataset.action === 'edit') { const d = (await getDoc(doc(db, 'help', id))).data(); helpWoj.value=d.woj; helpName.value=d.name; helpAddress.value=d.address; helpPhone.value=d.phone; helpDesc.value=d.desc; helpLink.value=d.link; editHelpId = id; addHelpBtn.innerHTML='<i class="fa-solid fa-save"></i> Zapisz Zmiany'; cancelHelpEditBtn.style.display='inline-block'; } else if (confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'help', id)); } })); }
  onSnapshot(query(collection(db, 'help'), orderBy('createdAt','desc')), snap => renderHelp(snap.docs.map(d=>({id: d.id, ...d.data()}))));

  function saveDraft(){ const draft = { section: sectionSelect?.value || '', author: authorInput?.value || '', theme: themeSelect?.value || 'auto', title: titleInput?.value || '', html: getEditorHtml() || '', ts: Date.now() }; try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); updateDraftBadge(); } catch(e){} }
  function loadDraft(){ try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return; const d = JSON.parse(raw); if (d.section) sectionSelect.value = d.section; if (d.author)  authorInput.value  = d.author; if (d.theme)   themeSelect.value  = d.theme; if (d.title)   titleInput.value   = d.title; if (d.html)    setEditorHtml(d.html); updateLivePreview(); updateDraftBadge(); } catch(e){} }
  function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); updateDraftBadge(); } catch(e){} }
  function updateDraftBadge(){ if (!draftBadge) return; const raw = localStorage.getItem(DRAFT_KEY); if (!raw) { draftBadge.textContent = 'Wersja robocza: —'; return; } try { const { ts } = JSON.parse(raw); if (ts) { const dt = new Date(ts).toLocaleString('pl-PL'); draftBadge.textContent = `Wersja robocza: ${dt}`; } else { draftBadge.textContent = 'Wersja robocza: —'; } } catch(e){ draftBadge.textContent = 'Wersja robocza: —'; } }
  loadDraft();
  clearDraftBtn?.addEventListener('click', ()=> { clearDraft(); showTemp(formMsg, 'Wyczyszczono wersję roboczą'); });
  setInterval(saveDraft, 15000);

  entryForm?.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const sectionName = (sectionSelect?.value || '').trim();
    if (!sectionName) return showTemp(formMsg, 'Musisz wybrać sekcję!', false);
    const title = (titleInput?.value || '').trim();
    const text = getEditorHtml().trim();
    if (!title || !text) return showTemp(formMsg, 'Tytuł i treść są wymagane', false);
    
    const sectionDocRef = doc(db, 'sekcje', sectionName);
    if (!(await getDoc(sectionDocRef)).exists()) {
        await setDoc(sectionDocRef, { name: sectionName, order: 100, createdAt: serverTimestamp() });
    }

    publishBtn.disabled = true;
    try {
      let attachment = null;
      const f = attachInput?.files?.[0];
      if (f) {
        const safe = f.name.replace(/[^\w.\-]+/g,'_');
        const path = `entries/${Date.now()}_${safe}`;
        const sRef = sref(storage, path);
        const task = uploadBytesResumable(sRef, f);
        await task;
        const url = await getDownloadURL(sRef);
        attachment = { url, storagePath: path };
      }
      const payload = { section: sectionName, title, author: (authorInput?.value || '').trim() || 'Chudy', text, attachment, theme: (themeSelect?.value || 'auto'), updatedAt: serverTimestamp() };
      if (editEntryId) {
        const entryRef = doc(db, 'sekcje', editEntryId.section, 'entries', editEntryId.id);
        await updateDoc(entryRef, payload);
      } else {
        const entriesCollectionRef = collection(db, 'sekcje', sectionName, 'entries');
        await addDoc(entriesCollectionRef, { ...payload, createdAt: serverTimestamp() });
      }
      entryForm.reset(); setEditorHtml(''); editEntryId=null;
      showTemp(formMsg, 'Zapisano');
    } catch (e) { showTemp(formMsg, 'Błąd zapisu', false); console.error(e); } finally { publishBtn.disabled = false; }
  });
  cancelEntryEditBtn?.addEventListener('click', ()=>{ editEntryId=null; entryForm?.reset(); setEditorHtml(''); });
  function renderEntries(list=[]){
    if (!entriesList) return;
    let arr = [...list];
    const filter = (filterSection?.value) || '';
    const q = (searchInput?.value || '').toLowerCase();
    const sort = (sortSelect?.value || 'desc');
    if (filter) arr = arr.filter(x => x.section === filter);
    if (q) arr = arr.filter(x => (stripHtml(x.title||'').toLowerCase().includes(q) || stripHtml(x.text||'').toLowerCase().includes(q)));
    if (sort === 'title') arr.sort((a,b)=>(stripHtml(a.title||'')).localeCompare(stripHtml(b.title||''))); 
    else if (sort==='asc') arr.sort((a,b)=>(a.createdAt?.seconds||0) - (b.createdAt?.seconds||0)); 
    else arr.sort((a,b)=>(b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    
    entriesList.innerHTML = '';
    arr.forEach(e=>{
      const div = document.createElement('div'); div.className = 'list-item';
      const date = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString('pl-PL') : '';
      const excerpt = stripHtml(e.text||'').slice(0,150) + '...';
      const attHtml = e.attachment?.url ? `<img src="${e.attachment.url}" class="entry-list-thumb" alt="Miniaturka">` : '';
      div.innerHTML = `<div class="list-item-content">${attHtml}<div><div class="entry-title" style="font-weight:700">${e.title || 'Bez tytułu'}</div><div class="muted-small">${escapeHtml(e.section||'')} • ${escapeHtml(e.author||'')} • ${date}</div><div style="margin-top:8px;color:#cfe4ff" class="excerpt">${escapeHtml(excerpt)}</div></div></div><div class="row" style="gap:6px"><button class="ghost small" data-action="edit" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      entriesList.appendChild(div);
    });

    entriesList.querySelectorAll('button[data-action="del"]').forEach(btn => {
        btn.addEventListener('click', async ev => {
            ev.stopPropagation();
            const id = ev.currentTarget.dataset.id;
            const entry = entriesCache.find(e => e.id === id);
            if (!entry || !entry.section) {
                alert('Błąd: Nie można zlokalizować wpisu w bazie danych. Może brakować pola "section".');
                return;
            }
            if (confirm('Na pewno usunąć ten wpis?')) {
                try {
                    const entryRef = doc(db, 'sekcje', entry.section, 'entries', id);
                    if (entry.attachment?.storagePath) {
                        await deleteObject(sref(storage, entry.attachment.storagePath)).catch(console.error);
                    }
                    await deleteDoc(entryRef);
                    showTemp(formMsg, 'Wpis usunięty.');
                } catch (err) { console.error("Błąd usuwania wpisu:", err); showTemp(formMsg, 'Błąd usuwania', false); }
            }
        });
    });

    entriesList.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', ev => {
            ev.stopPropagation();
            const id = ev.currentTarget.dataset.id;
            const entry = entriesCache.find(e => e.id === id);
            if (!entry) return;
            editEntryId = { id: id, section: entry.section };
            sectionSelect.value = entry.section || '';
            titleInput.value = entry.title || '';
            authorInput.value = entry.author || '';
            themeSelect.value = entry.theme || 'auto';
            setEditorHtml(entry.text || '');
            uploadPreview.innerHTML = entry.attachment?.url ? `<img src="${entry.attachment.url}" class="thumb" alt="Podgląd załącznika">` : '';
            publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany';
            cancelEntryEditBtn.style.display = 'inline-block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
  }

  onSnapshot(query(collectionGroup(db, 'entries'), orderBy('createdAt', 'desc')), snap => {
    entriesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEntries(entriesCache);
  });
  
  const rerender = debounce(() => renderEntries(entriesCache), 200);
  searchInput?.addEventListener('input', rerender);
  filterSection?.addEventListener('change', rerender);
  sortSelect?.addEventListener('change', rerender);
  sparkForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const qtxt = (sparkInput?.value || '').trim(); if (!qtxt) return; try { await addDoc(collection(db,'sparks'), { quote:qtxt, createdAt: serverTimestamp() }); sparkInput.value=''; } catch(e){ console.error(e); } });
  playlistForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const t = (songTitle?.value || '').trim(); const l = (songLink?.value || '').trim(); if (!t || !l) return; try { await addDoc(collection(db,'playlist'), { title:t, link:l, createdAt: serverTimestamp() }); songTitle.value=''; songLink.value=''; } catch(e){ console.error(e); } });
  
  galleryForm?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const file = galleryUpload?.files?.[0];
    const desc = (galleryDesc?.value || '').trim();
    const addGalleryBtn = galleryForm.querySelector('button[type="submit"]');
  
    if (editGalleryId) {
        addGalleryBtn.disabled = true;
        showTemp(formMsg, 'Aktualizowanie opisu...');
        const entryRef = doc(db, 'sekcje', 'Galeria', 'entries', editGalleryId);
        try {
            await updateDoc(entryRef, {
                text: desc,
                updatedAt: serverTimestamp()
            });
            galleryForm.reset();
            editGalleryId = null;
            galleryUpload.disabled = false;
            addGalleryBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Wyślij';
            showTemp(formMsg, 'Opis zaktualizowany');
        } catch (e) {
            console.error('Błąd aktualizacji galerii:', e);
            showTemp(formMsg, 'Błąd aktualizacji', false);
        } finally {
            addGalleryBtn.disabled = false;
        }
        return;
    }
  
    if (!file) return showTemp(formMsg, 'Wybierz plik', false);
    addGalleryBtn.disabled = true;
    try {
      galleryProgressBar && (galleryProgressBar.value = 0);
      showTemp(formMsg, 'Wysyłanie zdjęcia...');
      const safe = file.name.replace(/[^\w.\-]+/g,'_');
      const path = `sekcje_galeria/${Date.now()}_${safe}`;
      const r = sref(storage, path);
      const task = uploadBytesResumable(r, file);
  
      task.on('state_changed', s => {
        const p = Math.round((s.bytesTransferred / s.totalBytes) * 100);
        if (galleryProgressBar) galleryProgressBar.value = p;
      });
      
      await task;
      const url = await getDownloadURL(r);
      
      const sectionDocRef = doc(db, 'sekcje', 'Galeria');
      if (!(await getDoc(sectionDocRef)).exists()) {
          await setDoc(sectionDocRef, { name: "Galeria", order: 99, createdAt: serverTimestamp() });
      }
      
      await addDoc(collection(db, 'sekcje', 'Galeria', 'entries'), {
        url,
        text: desc,
        title: desc || file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        createdAt: serverTimestamp(),
        storagePath: path,
        section: 'Galeria'
      });
  
      galleryForm.reset();
      showTemp(formMsg, 'Dodano do galerii');
    } catch(e) {
      console.error('Błąd galerii:', e);
      showTemp(formMsg, 'Błąd dodawania', false);
    } finally {
      addGalleryBtn.disabled = false;
      if (galleryProgressBar) galleryProgressBar.value = 0;
    }
  });
  
  function renderGallery(list=[]){
    if (!galleryList) return;
    galleryList.innerHTML = '';
    list.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div style="display:flex; align-items:center; gap: 15px;">
          ${item.type === 'video' 
            ? `<div class="entry-list-thumb" style="background:#000; color:#fff; display:flex; align-items:center; justify-content:center; font-size: 2em;">🎥</div>` 
            : `<img src="${item.url}" class="entry-list-thumb" alt="">`}
          <div>
            <div style="font-weight:700">${escapeHtml(item.text || '(bez opisu)')}</div>
            <div class="muted-small">${escapeHtml(item.type)}</div>
          </div>
        </div>
        <div class="row">
          <button class="ghost small" data-action="edit" data-id="${item.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="ghost small danger" data-action="del" data-id="${item.id}" data-path="${item.storagePath}"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      galleryList.appendChild(div);
    });
  
    galleryList.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', async ev=>{
        const id = ev.currentTarget.dataset.id;
        const act = ev.currentTarget.dataset.action;
        const entryRef = doc(db, 'sekcje', 'Galeria', 'entries', id);
  
        if (act === 'edit') {
            const snap = await getDoc(entryRef);
            if (snap.exists()) {
                galleryDesc.value = snap.data().text || '';
                editGalleryId = id;
                galleryUpload.disabled = true;
                addGalleryBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz zmiany';
                galleryDesc.focus();
            }
        }
  
        if (act === 'del' && confirm('Na pewno usunąć element galerii?')) {
            const snap = await getDoc(entryRef);
            if(snap.exists() && snap.data().storagePath) {
                await deleteObject(sref(storage, snap.data().storagePath)).catch(()=>{});
            }
            await deleteDoc(entryRef);
        }
      });
    });
  }
  
  onSnapshot(query(collection(db, 'sekcje', 'Galeria', 'entries'), orderBy('createdAt','desc')), snap=>{
    const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderGallery(items);
  });

  onSnapshot(query(collection(db,'sparks'), orderBy('createdAt','desc')), snap => renderSparks(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  onSnapshot(query(collection(db,'playlist'), orderBy('createdAt','desc')), snap => renderPlaylist(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  function renderSparks(list=[]){ if(!sparksList) return; sparksList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = `<div><i class="fa-solid fa-star"></i> ${escapeHtml(s.quote)}</div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>`; sparksList.appendChild(el); }); sparksList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'sparks',id)); }); }); }
  function renderPlaylist(list=[]){ if(!playlistList) return; playlistList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = `<div><div style="font-weight:700">${escapeHtml(s.title)}</div><div class="muted-small">${escapeHtml(s.link)}</div></div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>`; playlistList.appendChild(el); }); playlistList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'playlist',id)); }); }); }

  function speakText(text, statusEl){ if (!text) return; try { const synth = window.speechSynthesis; synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'pl-PL'; if (statusEl) { u.onstart = ()=> statusEl.textContent = 'Lektor: czyta...'; u.onend = ()=> { statusEl.textContent = 'Lektor: zakończono'; setTimeout(()=>statusEl.textContent='Lektor: gotowy', 1200); }; } synth.speak(u); } catch(e) { console.error(e); } }
  
  // Pozostałe funkcje (modal, etc.)
  
  updateLivePreview();
}

