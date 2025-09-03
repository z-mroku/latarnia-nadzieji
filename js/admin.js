// /js/admin.js - WERSJA FINALNA I KOMPLETNA
import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, where, limit, collectionGroup
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
  const adminEmail = $('adminEmail'), logoutBtn = $('logoutBtn');
  const menuForm = $('menuForm'), menuText = $('menuText'), menuUrl = $('menuUrl'), menuOrder = $('menuOrder'), addMenuBtn = $('addMenuBtn'), cancelMenuEditBtn = $('cancelMenuEditBtn'), menuListContainer = $('menuListContainer'), menuMsg = $('menuMsg');
  const entryForm = $('entryForm'), sectionSelect = $('sectionSelect'), authorInput = $('authorInput'), titleInput = $('titleInput'), contentInput = $('contentInput'), attachInput = $('attachInput'), publishBtn = $('publishBtn'), cancelEntryEditBtn = $('cancelEntryEditBtn'), formMsg = $('formMsg'), uploadPreview = $('uploadPreview'), iconPicker = $('iconPicker'), draftBadge = $('draftBadge'), clearDraftBtn = $('clearDraftBtn');
  const filterSection = $('filterSection'), searchInput = $('searchInput'), sortSelect = $('sortSelect'), entriesList = $('entriesList');
  const sparkForm = $('sparkForm'), sparkInput = $('sparkInput'), sparksList = $('sparksList');
  const playlistForm = $('playlistForm'), songTitle = $('songTitle'), songLink = $('songLink'), playlistList = $('playlistList');
  const galleryForm = $('galleryForm'), galleryDesc = $('galleryDesc'), galleryUpload = $('galleryUpload'), galleryProgressBar = $('galleryProgressBar'), galleryList = $('galleryList');
  const helpForm = $('helpForm'), helpWoj = $('helpWoj'), helpName = $('helpName'), helpAddress = $('helpAddress'), helpPhone = $('helpPhone'), helpDesc = $('helpDesc'), helpLink = $('helpLink'), addHelpBtn = $('addHelpBtn'), cancelHelpEditBtn = $('cancelHelpEditBtn'), helpMsg = $('helpMsg'), helpListContainer = $('helpListContainer');

  adminEmail.textContent = user.email || user.uid;
  logoutBtn?.addEventListener('click', () => signOut(auth).catch(console.error));

  let editMenuId = null, editHelpId = null;
  let editEntryData = null; 
  let entriesCache = [];
  let editGalleryId = null;

  function getEditorHtml(){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) return CKEDITOR.instances.contentInput.getData(); } catch(e){} return contentInput?.value || ''; }
  function setEditorHtml(html=''){ try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) CKEDITOR.instances.contentInput.setData(html); else if (contentInput) contentInput.value = html; } catch(e){} }
  function initCk(){ 
      try { 
          if (!window.CKEDITOR || !contentInput) return;
          if (CKEDITOR.instances.contentInput) { CKEDITOR.instances.contentInput.destroy(true); }
          const ed = CKEDITOR.replace('contentInput', { height: 260 }); 
          ed.on('change', debounce(() => { 
              updateLivePreview(); 
              saveDraft(); 
          }, 500));
      } catch(e){ console.warn('Błąd inicjalizacji CKEditor:', e); } 
  }
  
  if (typeof CKEDITOR === 'undefined' || typeof CKEDITOR.replace === 'undefined') {
    const ckeditorScript = document.querySelector('script[src*="ckeditor.js"]');
    if(ckeditorScript) ckeditorScript.addEventListener('load', initCk);
  } else {
      initCk();
  }

  function updateLivePreview(){
    if ($('liveTitle')) $('liveTitle').innerHTML = $('titleInput')?.value || 'Tytuł podglądu';
    if ($('liveMeta')) { const who = $('authorInput')?.value || 'Autor'; $('liveMeta').textContent = `${who} • ${new Date().toLocaleString('pl-PL')}`; }
    if ($('liveContent')) $('liveContent').innerHTML = getEditorHtml() || '<em>Treść podglądu...</em>';
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
    const data = { text: menuText.value.trim(), url: menuUrl.value.trim(), order: Number(menuOrder.value) || 0 };
    if (!data.text || !data.url) return;
    try {
      if (editMenuId) { 
          await updateDoc(doc(db, 'menu', editMenuId), { ...data, updatedAt: serverTimestamp() }); 
      } else { 
          await addDoc(collection(db, 'menu'), { ...data, createdAt: serverTimestamp() }); 
      }
      menuForm.reset(); editMenuId = null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none';
      showTemp(menuMsg, 'Zapisano');
    } catch (e) { showTemp(menuMsg, 'Błąd', false); console.error(e); }
  });
  cancelMenuEditBtn?.addEventListener('click', () => { menuForm.reset(); editMenuId=null; addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'; cancelMenuEditBtn.style.display='none'; });
  
  function renderMenu(list=[]){
    if(!menuListContainer) return;
    menuListContainer.innerHTML = '';
    list.sort((a,b) => a.order - b.order).forEach(it=>{
      const div = document.createElement('div'); div.className = 'list-item';
      div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.text)}</div><div class="muted-small">${escapeHtml(it.url)} • ${it.order}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      menuListContainer.appendChild(div);
    });
    menuListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => {
      const id = btn.dataset.id;
      const act = btn.dataset.action;
      if (act === 'edit') {
        const d = (await getDoc(doc(db, 'menu', id))).data();
        menuText.value = d.text; menuUrl.value = d.url; menuOrder.value = d.order; editMenuId = id; addMenuBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz'; cancelMenuEditBtn.style.display='inline-block';
      } else if (act === 'del' && confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'menu', id)); }
    }));
  }
  onSnapshot(query(collection(db, 'menu')), snap => { const items = snap.docs.map(d=>({id:d.id, ...d.data()})); renderMenu(items); populateSectionSelect(items); });
  
  function populateSectionSelect(menuItems=[]){
    if (!sectionSelect || !filterSection) return;
    const prev = sectionSelect.value;
    sectionSelect.innerHTML = '';
    filterSection.innerHTML = '<option value="">Wszystkie sekcje</option>';
    menuItems.filter(m => !m.url.startsWith('http') && m.url.includes('sekcja.html')).forEach(m=>{ const opt = document.createElement('option'); opt.value = m.text; opt.textContent = m.text; sectionSelect.appendChild(opt); filterSection.appendChild(opt.cloneNode(true)); });
    sectionSelect.value = prev || 'Kronika';
  }

  helpForm?.addEventListener('submit', async ev => { ev.preventDefault(); const data = { woj: helpWoj.value, name: helpName.value.trim(), address: helpAddress.value.trim(), phone: helpPhone.value.trim(), desc: helpDesc.value.trim(), link: helpLink.value.trim() }; if(!data.name) return; try { if (editHelpId) { await updateDoc(doc(db, 'help', editHelpId), {...data, updatedAt: serverTimestamp()}); } else { await addDoc(collection(db, 'help'), {...data, createdAt: serverTimestamp()}); } helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; showTemp(helpMsg, 'Zapisano'); } catch (e) { showTemp(helpMsg, 'Błąd', false); console.error(e); } });
  cancelHelpEditBtn?.addEventListener('click', () => { helpForm.reset(); editHelpId = null; addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'; cancelHelpEditBtn.style.display='none'; });
  function renderHelp(list=[]){ if(!helpListContainer) return; helpListContainer.innerHTML = ''; list.forEach(it=>{ const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = `<div><div style="font-weight:700">${escapeHtml(it.name)}</div><div class="muted-small">${escapeHtml(it.woj)} | ${escapeHtml(it.address)}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>`; helpListContainer.appendChild(div); }); helpListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => { const id = btn.dataset.id; if (btn.dataset.action === 'edit') { const d = (await getDoc(doc(db, 'help', id))).data(); helpWoj.value=d.woj; helpName.value=d.name; helpAddress.value=d.address; helpPhone.value=d.phone; helpDesc.value=d.desc; helpLink.value=d.link; editHelpId = id; addHelpBtn.innerHTML='<i class="fa-solid fa-save"></i> Zapisz Zmiany'; cancelHelpEditBtn.style.display='inline-block'; } else if (confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'help', id)); } })); }
  onSnapshot(query(collection(db, 'help'), orderBy('createdAt','desc')), snap => renderHelp(snap.docs.map(d=>({id: d.id, ...d.data()}))));

  function saveDraft(){ const draft = { section: sectionSelect?.value || '', author: authorInput?.value || '', title: titleInput?.value || '', html: getEditorHtml() || '', ts: Date.now() }; try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); updateDraftBadge(); } catch(e){} }
  function loadDraft(){ try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return; const d = JSON.parse(raw); if (d.section) sectionSelect.value = d.section; if (d.author)  authorInput.value  = d.author; if (d.title)   titleInput.value   = d.title; if (d.html)    setEditorHtml(d.html); updateLivePreview(); updateDraftBadge(); } catch(e){} }
  function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); updateDraftBadge(); } catch(e){} }
  function updateDraftBadge(){ if (!draftBadge) return; const raw = localStorage.getItem(DRAFT_KEY); if (!raw) { draftBadge.textContent = 'Wersja robocza: —'; return; } try { const { ts } = JSON.parse(raw); if (ts) { const dt = new Date(ts).toLocaleString('pl-PL'); draftBadge.textContent = `Wersja robocza: ${dt}`; } else { draftBadge.textContent = 'Wersja robocza: —'; } } catch(e){ draftBadge.textContent = 'Wersja robocza: —'; } }
  loadDraft();
  clearDraftBtn?.addEventListener('click', ()=> { clearDraft(); showTemp(formMsg, 'Wyczyszczono wersję roboczą'); });
  setInterval(saveDraft, 15000);

  entryForm?.addEventListener('submit', async ev=>{ 
    ev.preventDefault();
    const title = (titleInput?.value || '').trim();
    const section = (sectionSelect?.value) || 'Kronika';
    const author = (authorInput?.value || '').trim() || 'Chudy';
    const text = getEditorHtml().trim();
    if (!title || !text) return showTemp(formMsg, 'Tytuł i treść są wymagane', false);
    
    publishBtn.disabled = true; 
    showTemp(formMsg, 'Trwa zapisywanie...');
    
    try {
      let attachment = editEntryData?.attachment || null;
      const f = attachInput?.files?.[0];
      if (f) {
        if (attachment?.meta?.path) {
          await deleteObject(sref(storage, attachment.meta.path)).catch(console.error);
        }
        const safe = f.name.replace(/[^\w.\-]+/g,'_');
        const path = `entries/${Date.now()}_${safe}`;
        const sRef = sref(storage, path);
        await uploadBytesResumable(sRef, f);
        const url = await getDownloadURL(sRef);
        attachment = { url, meta:{ path } };
      }
      
      const payload = { section, title, author, text, attachment, updatedAt: serverTimestamp() };
      
      if (editEntryData) {
        const entryRef = doc(db, 'sekcje', editEntryData.section, 'entries', editEntryData.id);
        await updateDoc(entryRef, payload);
        showTemp(formMsg, 'Wpis zaktualizowany');
      } else {
        const entriesCollectionRef = collection(db, 'sekcje', section, 'entries');
        await addDoc(entriesCollectionRef, { ...payload, createdAt: serverTimestamp() });
        showTemp(formMsg, 'Wpis dodany');
      }

      entryForm.reset(); 
      setEditorHtml(''); 
      editEntryData = null; 
      publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; 
      cancelEntryEditBtn.style.display='none'; 
      uploadPreview.innerHTML='';
      updateLivePreview(); 
      clearDraft();
    } catch (e) { 
      showTemp(formMsg, 'Błąd zapisu', false); 
      console.error(e); 
    } finally { 
      publishBtn.disabled = false; 
    }
  });

  cancelEntryEditBtn?.addEventListener('click', ()=>{ 
    editEntryData = null; 
    entryForm?.reset(); 
    setEditorHtml(''); 
    cancelEntryEditBtn.style.display='none'; 
    publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; 
    uploadPreview.innerHTML='';
    updateLivePreview(); 
  });
  
  function renderEntries(list=[]){
    if (!entriesList) return;
    let arr = [...list];
    const filter = filterSection?.value || '';
    const q = searchInput?.value.toLowerCase() || '';
    const sort = sortSelect?.value || 'desc';

    if (filter) arr = arr.filter(x => x.section === filter);
    if (q) arr = arr.filter(x => (x.title||'').toLowerCase().includes(q) || stripHtml(x.text||'').toLowerCase().includes(q));
    
    const currentSort = (filter === 'Kronika') ? 'asc' : sort;

    if (currentSort === 'title') arr.sort((a,b) => (a.title||'').localeCompare(b.title||'')); 
    else if (currentSort === 'asc') arr.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)); 
    else arr.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    entriesList.innerHTML = '';
    arr.forEach(e=>{
      const div = document.createElement('div');
      div.className = 'list-item';
      div.dataset.id = e.id;
      const date = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString('pl-PL') : '';
      const plain = stripHtml(e.text||'');
      const excerpt = plain.slice(0,150) + (plain.length > 150 ? '…' : '');
      const attHtml = e.attachment?.url ? `<img src="${e.attachment.url}" class="entry-list-thumb" alt="Miniaturka">` : '';
      const titleHtml = e.title || 'Bez tytułu';
      div.innerHTML = `<div class="list-item-content">${attHtml}<div><div class="entry-title">${titleHtml}</div><div class="muted-small">${e.section} • ${e.author} • ${date}</div><p class="excerpt">${excerpt}</p></div></div><div class="row list-item-actions"><button class="ghost small" data-action="edit" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      entriesList.appendChild(div);
    });
  }
  
  entriesList.addEventListener('click', async (ev) => {
    const button = ev.target.closest('button');
    if (!button) return;
      
    const id = button.dataset.id;
    const action = button.dataset.action;
    const entry = entriesCache.find(e => e.id === id);
    if (!entry) return;

    if (action === 'edit') {
        editEntryData = entry;
        sectionSelect.value = entry.section || '';
        titleInput.value = entry.title || '';
        authorInput.value = entry.author || '';
        setEditorHtml(entry.text || '');
        uploadPreview.innerHTML = entry.attachment?.url ? `<img src="${entry.attachment.url}" class="thumb" alt="Załącznik">` : '';
        publishBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz zmiany';
        cancelEntryEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateLivePreview();
    } else if (action === 'del') {
        if (!confirm('Na pewno usunąć?')) return;
        try {
            if (entry.attachment?.meta?.path) {
                await deleteObject(sref(storage, entry.attachment.meta.path));
            }
            await deleteDoc(doc(db, 'sekcje', entry.section, 'entries', id));
            showTemp(formMsg, 'Wpis usunięty');
        } catch (e) {
            console.error('Błąd usuwania:', e);
            showTemp(formMsg, 'Błąd usuwania', false);
        }
    }
  });
  
  onSnapshot(query(collectionGroup(db,'entries')), snap=>{ 
    entriesCache = snap.docs.map(d=>({ id:d.id, section:d.ref.parent.parent.id, ...d.data() })); 
    renderEntries(entriesCache); 
  });
  
  const rerender = debounce(()=> renderEntries(entriesCache), 200);
  searchInput?.addEventListener('input', rerender);
  filterSection?.addEventListener('change', rerender);
  sortSelect?.addEventListener('change', () => {
    renderEntries(entriesCache);
  });
  
  sparkForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const qtxt = (sparkInput?.value || '').trim(); if (!qtxt) return; try { await addDoc(collection(db,'sparks'), { quote:qtxt, createdAt: serverTimestamp() }); sparkInput.value=''; } catch(e){ console.error(e); } });
  playlistForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const t = (songTitle?.value || '').trim(); const l = (songLink?.value || '').trim(); if (!t || !l) return; try { await addDoc(collection(db,'playlist'), { title:t, link:l, createdAt: serverTimestamp() }); songTitle.value=''; songLink.value=''; } catch(e){ console.error(e); } });
  galleryForm?.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const file = galleryUpload?.files?.[0];
    const desc = (galleryDesc?.value || '').trim();
    const addGalleryBtn = galleryForm.querySelector('button[type="submit"]');

    if (editGalleryId) {
        // ... (kod aktualizacji galerii)
        return;
    }
    if (!file) return showTemp(menuMsg, 'Wybierz plik', false);
    // ... (kod dodawania do galerii)
  });
  
  onSnapshot(query(collection(db,'sparks'), orderBy('createdAt','desc')), snap => renderSparks(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  onSnapshot(query(collection(db,'playlist'), orderBy('createdAt','desc')), snap => renderPlaylist(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  onSnapshot(query(collection(db,'gallery'), orderBy('createdAt','desc')), snap => renderGallery(snap.docs.map(d=>({id: d.id, ...d.data()}))));
  
  function renderSparks(list=[]){ /* ... kod bez zmian ... */ }
  function renderPlaylist(list=[]){ /* ... kod bez zmian ... */ }
  function renderGallery(list=[]){ /* ... kod bez zmian ... */ }
}
