
// Plik: /js/admin.js (WERSJA OSTATECZNA "NA MEDAL" - NAPRAWIONA) // Główne poprawki: // - Usunięto duplikujące się deklaracje const (modalCloseBtn/modalCloseBtn2 itd.) które powodowały SyntaxError // - Uporządkowano showModalWithData aby korzystało z wcześniej zdefiniowanych elementów zamiast redeklarować // - Dodano defensywne sprawdzenia istnienia snapshotów i danych przed użyciem .data() // - Drobne poprawki bezpieczeństwa/robustness (optional chaining, guardy)

import { db, auth, storage } from './firebase-config.js'; import { collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; import { ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"; import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id); const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c])); const stripHtml  = (s = '') => String(s).replace(/<[^>]*>?/gm,''); const debounce = (fn, ms = 250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; }; const DRAFT_KEY = 'adminEntryDraft_v2';

function showTemp(el, txt, ok = true){ if (!el) return; el.textContent = txt; el.className = ok ? 'muted-small success' : 'muted-small danger'; setTimeout(()=>{ el.textContent=''; el.className='muted-small'; }, 3000); }

onAuthStateChanged(auth, user => { if (!user) { window.location.href = 'login.html'; return; } initPanel(user); });

async function initPanel(user){ // Definicje wszystkich elementów DOM const adminEmail = $('adminEmail'), logoutBtn = $('logoutBtn'); const menuForm = $('menuForm'), menuText = $('menuText'), menuUrl = $('menuUrl'), menuOrder = $('menuOrder'), addMenuBtn = $('addMenuBtn'), cancelMenuEditBtn = $('cancelMenuEditBtn'), menuListContainer = $('menuListContainer'), menuMsg = $('menuMsg'); const entryForm = $('entryForm'), sectionSelect = $('sectionSelect'), authorInput = $('authorInput'), themeSelect = $('themeSelect'), titleInput = $('titleInput'), contentInput = $('contentInput'), attachInput = $('attachInput'), publishBtn = $('publishBtn'), cancelEntryEditBtn = $('cancelEntryEditBtn'), formMsg = $('formMsg'), uploadPreview = $('uploadPreview'), iconPicker = $('iconPicker'), draftBadge = $('draftBadge'), clearDraftBtn = $('clearDraftBtn'); const filterSection = $('filterSection'), searchInput = $('searchInput'), sortSelect = $('sortSelect'), entriesList = $('entriesList'); const liveTitle = $('liveTitle'), liveMeta = $('liveMeta'), liveContent = $('liveContent'); const sparkForm = $('sparkForm'), sparkInput = $('sparkInput'), sparksList = $('sparksList'); const playlistForm = $('playlistForm'), songTitle = $('songTitle'), songLink = $('songLink'), playlistList = $('playlistList'); const galleryForm = $('galleryForm'), galleryDesc = $('galleryDesc'), galleryUpload = $('galleryUpload'), galleryProgressBar = $('galleryProgressBar'), galleryList = $('galleryList'); const readerStatus = $('readerStatus'), ttsListenBtn = $('ttsListenBtn'), ttsPreviewBtn = $('ttsPreviewBtn'), readerSelectionInfo = $('readerSelectionInfo'); const helpForm = $('helpForm'), helpWoj = $('helpWoj'), helpName = $('helpName'), helpAddress = $('helpAddress'), helpPhone = $('helpPhone'), helpDesc = $('helpDesc'), helpLink = $('helpLink'), addHelpBtn = $('addHelpBtn'), cancelHelpEditBtn = $('cancelHelpEditBtn'), helpMsg = $('helpMsg'), helpListContainer = $('helpListContainer'); const noteForm = $('noteForm'), noteTitle = $('noteTitle'), noteContent = $('noteContent'), addNoteBtn = $('addNoteBtn'), cancelNoteEditBtn = $('cancelNoteEditBtn'), noteMsg = $('noteMsg'), noteListContainer = $('noteListContainer'); const entryModal = $('entryModal'), entryModalTitle = $('entryModalTitle'), entryModalMeta = $('entryModalMeta'), entryModalBody = $('entryModalBody'), modalTtsBtn = $('modalTtsBtn'), modalCloseBtn = $('modalCloseBtn'), modalCloseBtn2 = $('modalCloseBtn2'), modalEditBtn = $('modalEditBtn');

adminEmail && (adminEmail.textContent = user.email || user.uid); logoutBtn?.addEventListener('click', () => signOut(auth).catch(console.error));

let editMenuId = null, editHelpId = null, selectedEntryIdForTTS = null, editGalleryId = null; let editEntryData = null; let entriesCache = []; let editorInstance;

// CZĘŚĆ 2/5: CKEDITOR, IKONY, PODGLĄD, MENU, POMOC

try { if (window.ClassicEditor && contentInput && !editorInstance) { editorInstance = await ClassicEditor.create(contentInput, { language: 'pl', toolbar: { items: [ 'heading', '|', 'bold', 'italic', 'underline', '|', 'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|', 'bulletedList', 'numberedList', 'outdent', 'indent', '|', 'alignment', '|', 'link', 'blockQuote', 'insertTable', 'mediaEmbed', '|', 'undo', 'redo', 'sourceEditing' ] } }); editorInstance.model.document.on('change', debounce(() => { updateLivePreview(); saveDraft(); }, 500)); } } catch(e){ console.error('Błąd inicjalizacji CKEditor 5:', e); }

function getEditorHtml(){ return editorInstance ? editorInstance.getData() : (contentInput?.value || ''); } function setEditorHtml(html=''){ if (editorInstance) editorInstance.setData(html); else if (contentInput) contentInput.value = html; }

function updateLivePreview(){ if (liveTitle) liveTitle.innerHTML = titleInput?.value || 'Tytuł podglądu'; if (liveMeta) { const who = authorInput?.value || 'Autor'; liveMeta.textContent = ${who} • ${new Date().toLocaleString('pl-PL')}; } if (liveContent) liveContent.innerHTML = getEditorHtml() || '<em>Treść podglądu...</em>'; } titleInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); }); authorInput?.addEventListener('input', () => { updateLivePreview(); saveDraft(); });

const icons = ['fa-solid fa-heart','fa-solid fa-music','fa-solid fa-star','fa-solid fa-book','fa-solid fa-hands-praying','fa-solid fa-headphones']; function buildIconPicker(){ if (!iconPicker) return; iconPicker.innerHTML = ''; icons.forEach(cls => { const b = document.createElement('button'); b.type = 'button'; b.title = cls; b.innerHTML = <i class="${cls}"></i>; b.addEventListener('click', ()=> { if (!titleInput) return; const start = titleInput.selectionStart ?? titleInput.value.length; const end = titleInput.selectionEnd ?? titleInput.value.length; const snippet = <i class="${cls} fa-fw"></i> ; titleInput.value = titleInput.value.substring(0, start) + snippet + titleInput.value.substring(end); titleInput.selectionStart = titleInput.selectionEnd = start + snippet.length; titleInput.focus(); updateLivePreview(); saveDraft(); }); iconPicker.appendChild(b); }); } buildIconPicker();

menuForm?.addEventListener('submit', async ev => { ev.preventDefault(); const data = { text: menuText.value.trim(), url: menuUrl.value.trim(), order: Number(menuOrder.value) || 0 }; if (!data.text || !data.url) return; try { if (editMenuId) { await updateDoc(doc(db, 'menu', editMenuId), data); } else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'menu'), data); } menuForm.reset(); editMenuId = null; addMenuBtn && (addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'); cancelMenuEditBtn && (cancelMenuEditBtn.style.display='none'); showTemp(menuMsg, 'Zapisano'); } catch (e) { showTemp(menuMsg, 'Błąd', false); console.error(e); } }); cancelMenuEditBtn?.addEventListener('click', () => { menuForm.reset(); editMenuId=null; addMenuBtn && (addMenuBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Dodaj'); cancelMenuEditBtn.style.display='none'; }); function renderMenu(list=[]){ if(!menuListContainer) return; menuListContainer.innerHTML = ''; list.forEach(it=>{ const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = <div><div style="font-weight:700">${escapeHtml(it.text)}</div><div class="muted-small">${escapeHtml(it.url)} • ${it.order}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>; menuListContainer.appendChild(div); }); menuListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => { const id = ev.currentTarget.dataset.id; const act = ev.currentTarget.dataset.action; if (act === 'edit') { const snap = await getDoc(doc(db, 'menu', id)); const d = snap.exists() ? snap.data() : null; if (!d) return showTemp(menuMsg, 'Brak pozycji', false); menuText.value = d.text || ''; menuUrl.value = d.url || ''; menuOrder.value = d.order || 0; editMenuId = id; addMenuBtn && (addMenuBtn.innerHTML = '<i class="fa-solid fa-save"></i> Zapisz'); cancelMenuEditBtn && (cancelMenuEditBtn.style.display='inline-block'); } else if (act === 'del' && confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'menu', id)); } })); } onSnapshot(query(collection(db, 'menu'), orderBy('order')), snap => { const items = snap.docs.map(d=>({id:d.id, ...d.data()})); renderMenu(items); populateSectionSelect(items); });

function populateSectionSelect(menuItems=[]){ if (!sectionSelect || !filterSection) return; const prev = sectionSelect.value; sectionSelect.innerHTML = ''; filterSection.innerHTML = '<option value="">Wszystkie sekcje</option>'; menuItems.forEach(m=>{ const opt = document.createElement('option'); opt.value = m.text; opt.textContent = m.text; sectionSelect.appendChild(opt); if(filterSection) filterSection.appendChild(opt.cloneNode(true)); }); sectionSelect.value = prev || (sectionSelect.querySelector('option') ? sectionSelect.querySelector('option').value : ''); }

helpForm?.addEventListener('submit', async ev => { ev.preventDefault(); const data = { woj: helpWoj.value, name: helpName.value.trim(), address: helpAddress.value.trim(), phone: helpPhone.value.trim(), desc: helpDesc.value.trim(), link: helpLink.value.trim() }; if(!data.name) return; try { if (editHelpId) { await updateDoc(doc(db, 'help', editHelpId), data); } else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'help'), data); } helpForm.reset(); editHelpId = null; addHelpBtn && (addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'); cancelHelpEditBtn && (cancelHelpEditBtn.style.display='none'); showTemp(helpMsg, 'Zapisano'); } catch (e) { showTemp(helpMsg, 'Błąd', false); console.error(e); } }); cancelHelpEditBtn?.addEventListener('click', () => { helpForm.reset(); editHelpId = null; addHelpBtn && (addHelpBtn.innerHTML='<i class="fa-solid fa-plus"></i> Dodaj Ośrodek'); cancelHelpEditBtn.style.display='none'; }); function renderHelp(list=[]){ if(!helpListContainer) return; helpListContainer.innerHTML = ''; list.forEach(it=>{ const div = document.createElement('div'); div.className = 'list-item'; div.innerHTML = <div><div style="font-weight:700">${escapeHtml(it.name)}</div><div class="muted-small">${escapeHtml(it.woj)} | ${escapeHtml(it.address)}</div></div><div class="row"><button class="ghost small" data-action="edit" data-id="${it.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${it.id}"><i class="fa-solid fa-trash"></i></button></div>; helpListContainer.appendChild(div); }); helpListContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async ev => { const id = ev.currentTarget.dataset.id; if (ev.currentTarget.dataset.action === 'edit') { const snap = await getDoc(doc(db, 'help', id)); const d = snap.exists() ? snap.data() : null; if (!d) return showTemp(helpMsg, 'Brak pozycji', false); helpWoj.value=d.woj||''; helpName.value=d.name||''; helpAddress.value=d.address||''; helpPhone.value=d.phone||''; helpDesc.value=d.desc||''; helpLink.value=d.link||''; editHelpId = id; addHelpBtn && (addHelpBtn.innerHTML='<i class="fa-solid fa-save"></i> Zapisz Zmiany'); cancelHelpEditBtn && (cancelHelpEditBtn.style.display='inline-block'); } else if (confirm('Na pewno usunąć?')) { await deleteDoc(doc(db, 'help', id)); } })); } onSnapshot(query(collection(db, 'help'), orderBy('createdAt','desc')), snap => renderHelp(snap.docs.map(d=>({id: d.id, ...d.data()})))); // CZĘŚĆ 3/5: WERSJE ROBOCZE I FORMULARZ WPISÓW Z POPRAWKĄ

function saveDraft(){ const draft = { section: sectionSelect?.value || '', author: authorInput?.value || '', title: titleInput?.value || '', html: getEditorHtml() || '', ts: Date.now() }; try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); updateDraftBadge(); } catch(e){} } function loadDraft(){ try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return; const d = JSON.parse(raw); if (d.section) sectionSelect.value = d.section; if (d.author)  authorInput.value  = d.author; if (d.title)   titleInput.value   = d.title; if (d.html)    setEditorHtml(d.html); updateLivePreview(); updateDraftBadge(); } catch(e){} } function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); updateDraftBadge(); } catch(e){} } function updateDraftBadge(){ if (!draftBadge) return; const raw = localStorage.getItem(DRAFT_KEY); if (!raw) { draftBadge.textContent = 'Wersja robocza: —'; return; } try { const { ts } = JSON.parse(raw); if (ts) { const dt = new Date(ts).toLocaleString('pl-PL'); draftBadge.textContent = Wersja robocza: ${dt}; } } catch(e){ draftBadge.textContent = 'Wersja robocza: —'; } } clearDraftBtn?.addEventListener('click', ()=> { clearDraft(); resetForm(); showTemp(formMsg, 'Wyczyszczono wersję roboczą'); }); setInterval(saveDraft, 15000);

entryForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); publishBtn && (publishBtn.disabled = true); publishBtn && (publishBtn.textContent = 'Zapisywanie...');

const newSection = sectionSelect.value;
const payload = {
    section: newSection,
    author: authorInput.value.trim() || 'Chudy',
    title: titleInput.value.trim(),
    text: getEditorHtml(),
    theme: themeSelect?.value || 'auto',
    updatedAt: serverTimestamp()
};

if (!payload.title && !payload.text) {
    showTemp(formMsg, 'Tytuł i treść są wymagane.', false);
    publishBtn && (publishBtn.disabled = false);
    publishBtn && (publishBtn.textContent = 'Opublikuj');
    return;
}

try {
  if (editEntryData) {
      const entryId = editEntryData.id;
      const originalSection = editEntryData.section;

      if (originalSection !== newSection) {
          const oldDocRef = doc(db, 'sekcje', originalSection, 'entries', entryId);
          const snap = await getDoc(oldDocRef);
          const docToMoveData = snap.exists() ? snap.data() : {};
          const finalPayload = { ...docToMoveData, ...payload };
          const newDocRef = doc(db, 'sekcje', newSection, 'entries', entryId);
          await setDoc(newDocRef, finalPayload);
          await deleteDoc(oldDocRef);
          showTemp(formMsg, `Wpis przeniesiony z '${originalSection}' do '${newSection}'.`);
      } else {
          const entryRef = doc(db, 'sekcje', originalSection, 'entries', entryId);
          await updateDoc(entryRef, payload);
          showTemp(formMsg, 'Wpis zaktualizowany.');
      }
  } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'sekcje', newSection, 'entries'), payload);
      showTemp(formMsg, 'Wpis opublikowany.');
  }
  resetForm();

} catch (e) {
  console.error("Błąd zapisu:", e);
  showTemp(formMsg, 'Błąd zapisu.', false);
} finally {
  publishBtn && (publishBtn.disabled = false);
  publishBtn && (publishBtn.textContent = 'Opublikuj');
}

});

function resetForm(){ entryForm?.reset(); setEditorHtml(''); editEntryData=null; cancelEntryEditBtn && (cancelEntryEditBtn.style.display='none'); publishBtn && (publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Opublikuj'); updateLivePreview(); clearDraft(); } cancelEntryEditBtn?.addEventListener('click', resetForm); // CZĘŚĆ 4/5: LISTA WPISÓW I AKCJE

function renderEntries(list=[]){ if (!entriesList) return; const filter = (filterSection?.value) || ''; const q = (searchInput?.value || '').toLowerCase(); const sort = (sortSelect?.value || 'desc'); let arr = [...list];

if (filter) arr = arr.filter(x => x.section === filter);
if (q) arr = arr.filter(x => (stripHtml(x.title||'').toLowerCase().includes(q) || stripHtml(x.text||'').toLowerCase().includes(q)));

if (sort === 'title') arr.sort((a,b)=>(stripHtml(a.title||'')).localeCompare(stripHtml(b.title||''))); 
else if (sort === 'asc') arr.sort((a,b)=>(a.createdAt?.seconds||0) - (b.createdAt?.seconds||0)); 
else arr.sort((a,b)=>(b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

entriesList.innerHTML = '';
arr.forEach(e=>{
  const div = document.createElement('div'); div.className = 'list-item'; div.dataset.id = e.id;
  const date = (e.updatedAt || e.createdAt)?.toDate?.()?.toLocaleString('pl-PL') || '';
  const excerpt = stripHtml(e.text||'').slice(0,150) + '...';
  const attHtml = e.attachment?.url ? `<img src="${e.attachment.url}" class="entry-list-thumb" alt="Miniaturka">` : '';
  div.innerHTML = `<div class="list-item-content">${attHtml}<div><div class="entry-title" style="font-weight:700">${e.title || 'Bez tytułu'}</div><div class="muted-small">${e.section||''} • ${e.author||''} • ${date}</div><div style="margin-top:8px;color:#cfe4ff">${excerpt}</div><div style="margin-top:6px"><button class="btn-link" data-action="read" data-id="${e.id}">Czytaj dalej</button></div></div></div><div class="row" style="gap:6px"><button class="ghost small listen" data-id="${e.id}" title="Odsłuchaj"><i class="fa-solid fa-headphones-simple"></i></button><button class="ghost small" data-action="edit" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
  entriesList.appendChild(div);
});

entriesList.querySelectorAll('.list-item').forEach(item => { item.addEventListener('click', (ev) => { if (ev.target.closest('button')) return; document.querySelectorAll('.list-item.selected').forEach(el => el.classList.remove('selected')); item.classList.add('selected'); selectedEntryIdForTTS = item.dataset.id; ttsListenBtn && (ttsListenBtn.disabled = false); const titleEl = item.querySelector('.entry-title'); if(readerSelectionInfo) readerSelectionInfo.innerHTML = `Zaznaczono: "<strong>${titleEl?.textContent||''}</strong>"`; }); });

entriesList.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', async ev=>{
    ev.stopPropagation();
    const id = ev.currentTarget.dataset.id;
    const act = ev.currentTarget.dataset.action;
    const entry = entriesCache.find(e => e.id === id);
    if (!entry) return;

    if (act === 'read') { openEntryModal(entry); return; }
    if (ev.currentTarget.classList.contains('listen')) { const txt = stripHtml(`${entry.title}. ${entry.text}`); speakText(txt); return; }
    if (act === 'edit') {
      const entryRef = doc(db, 'sekcje', entry.section, 'entries', id);
      const snap = await getDoc(entryRef);
      if (!snap.exists()) return alert('Wpis nie istnieje w bazie danych!');
      const data = snap.data();
      
      editEntryData = { id: id, section: entry.section, createdAt: data.createdAt };
      
      sectionSelect.value = data.section || '';
      titleInput.value = data.title || '';
      authorInput.value = data.author || '';
      setEditorHtml(data.text || '');
      
      publishBtn && (publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany');
      cancelEntryEditBtn && (cancelEntryEditBtn.style.display='inline-block');
      window.scrollTo({top:0,behavior:'smooth'});
    }
    if (act === 'del') {
      if (!confirm('Na pewno usunąć?')) return;
      const entryRef = doc(db, 'sekcje', entry.section, 'entries', id);
      if (entry.attachment?.meta?.path) await deleteObject(sref(storage, entry.attachment.meta.path)).catch(()=>{});
      await deleteDoc(entryRef);
    }
  });
});

}

onSnapshot(query(collectionGroup(db,'entries'), orderBy('createdAt','desc')), snap=>{ entriesCache = snap.docs.map(d=>({ id:d.id, section:d.ref.parent.parent?.id || '', ...d.data() })); renderEntries(entriesCache); }); const rerender = debounce(()=> renderEntries(entriesCache), 200); searchInput?.addEventListener('input', rerender); filterSection?.addEventListener('change', rerender); sortSelect?.addEventListener('change', rerender); // CZĘŚĆ 5/5: MAŁE MODUŁY, MODAL I ZAKOŃCZENIE

sparkForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const qtxt = (sparkInput?.value || '').trim(); if (!qtxt) return; try { await addDoc(collection(db,'sparks'), { quote:qtxt, createdAt: serverTimestamp() }); sparkInput.value=''; } catch(e){ console.error(e); } }); playlistForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const t = (songTitle?.value || '').trim(); const l = (songLink?.value || '').trim(); if (!t || !l) return; try { await addDoc(collection(db,'playlist'), { title:t, link:l, createdAt: serverTimestamp() }); songTitle.value=''; songLink.value=''; } catch(e){ console.error(e); } }); galleryForm?.addEventListener('submit', async ev=>{ ev.preventDefault(); const file = galleryUpload?.files?.[0]; const desc = (galleryDesc?.value || '').trim(); if (!file || !desc) return; const addBtn = galleryForm.querySelector('button[type="submit"]'); addBtn && (addBtn.disabled = true); try { const safeName = file.name.replace(/[^\w.-]+/g,'_'); const storagePath = gallery/${Date.now()}_${safeName}; const fileRef = sref(storage, storagePath); const uploadTask = uploadBytesResumable(fileRef, file); uploadTask.on('state_changed', s => { const p = (s.bytesTransferred / s.totalBytes) * 100; if(galleryProgressBar) galleryProgressBar.value = p; }, console.error, async () => { const url = await getDownloadURL(uploadTask.snapshot.ref); await addDoc(collection(db, 'gallery'), { url, desc, path: storagePath, createdAt: serverTimestamp() }); galleryForm.reset(); if(galleryProgressBar) galleryProgressBar.value = 0; addBtn && (addBtn.disabled = false); }); } catch(e) { console.error(e); addBtn && (addBtn.disabled = false); } });

onSnapshot(query(collection(db,'sparks'), orderBy('createdAt','desc')), snap => renderSparks(snap.docs.map(d=>({id: d.id, ...d.data()})))); onSnapshot(query(collection(db,'playlist'), orderBy('createdAt','desc')), snap => renderPlaylist(snap.docs.map(d=>({id: d.id, ...d.data()})))); onSnapshot(query(collection(db,'gallery'), orderBy('createdAt','desc')), snap => renderGallery(snap.docs.map(d=>({id: d.id, ...d.data()}))));

function renderSparks(list=[]){ if(!sparksList) return; sparksList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = <div><i class="fa-solid fa-star"></i> ${escapeHtml(s.quote)}</div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>; sparksList.appendChild(el); }); sparksList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'sparks',id)); }); }); } function renderPlaylist(list=[]){ if(!playlistList) return; playlistList.innerHTML = ''; list.forEach(s=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = <div><div style="font-weight:700">${escapeHtml(s.title)}</div><div class="muted-small">${escapeHtml(s.link)}</div></div><div class="row"><button class="ghost small danger" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button></div>; playlistList.appendChild(el); }); playlistList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; if (confirm('Usuń?')) await deleteDoc(doc(db,'playlist',id)); }); }); } function renderGallery(list=[]){ if(!galleryList) return; galleryList.innerHTML = ''; list.forEach(g=>{ const el = document.createElement('div'); el.className='list-item'; el.innerHTML = <div style="display:flex;gap:10px;align-items:center"><img src="${g.url}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" alt="Miniaturka"><div style="font-weight:700">${escapeHtml(g.desc)}</div></div><div class="row"><button class="ghost small danger" data-id="${g.id}" data-path="${g.path}"><i class="fa-solid fa-trash"></i></button></div>; galleryList.appendChild(el); }); galleryList.querySelectorAll('button').forEach(btn=>{ btn.addEventListener('click', async ev=> { const id = ev.currentTarget.dataset.id; const path = ev.currentTarget.dataset.path; if (!confirm('Usuń?')) return; try{ if (path) await deleteObject(sref(storage, path)).catch(()=>{}); await deleteDoc(doc(db,'gallery', id)); }catch(e){console.error(e);} }); }); }

function speakText(text){ if (!text) return; try { const synth = window.speechSynthesis; if(synth.speaking) synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'pl-PL'; if (readerStatus) { u.onstart = ()=> readerStatus.textContent = 'Lektor: czyta...'; u.onend = ()=> { readerStatus.textContent = 'Lektor: zakończono'; setTimeout(()=>readerStatus.textContent='Lektor: gotowy', 1200); }; } synth.speak(u); } catch(e) { console.error(e); } } ttsListenBtn?.addEventListener('click', async () => { if (!selectedEntryIdForTTS) return; const entry = entriesCache.find(e => e.id === selectedEntryIdForTTS); if (!entry) return; const txt = stripHtml(${entry.title}. ${entry.text}); speakText(txt); }); ttsPreviewBtn?.addEventListener('click', () => { const txt = stripHtml(${titleInput.value}. ${getEditorHtml()}); speakText(txt); });

function openEntryModal(entry) { if (!entry) return; showModalWithData(entry.id, entry); } function showModalWithData(id, d){ if(!entryModal) return; entryModalTitle.textContent = d.title || 'Bez tytułu'; const date = (d.updatedAt || d.createdAt)?.toDate?.()?.toLocaleString('pl-PL') || ''; entryModalMeta.textContent = ${d.section || ''} • ${d.author || ''} • ${date}; entryModalBody.innerHTML = (d.attachment?.url ? <p><img src="${d.attachment.url}" style="max-width:100%"></p> : '') + (d.text || ''); entryModal.classList.add('open'); modalTtsBtn && (modalTtsBtn.onclick = () => { speakText(stripHtml(${d.title}. ${d.text})); }); modalEditBtn && (modalEditBtn.onclick = () => { closeEntryModal(); const editButton = entriesList?.querySelector(.list-item[data-id="${id}"] button[data-action="edit"]); if(editButton) editButton.click(); }); } function closeEntryModal(){ if(entryModal) entryModal.classList.remove('open'); window.speechSynthesis?.cancel(); } modalCloseBtn?.addEventListener('click', closeEntryModal); modalCloseBtn2?.addEventListener('click', closeEntryModal); entryModal?.addEventListener('click', (ev)=>{ if (ev.target === entryModal) closeEntryModal(); }); window.addEventListener('keydown', (ev)=> { if (ev.key === 'Escape') closeEntryModal(); });

} // Koniec funkcji initPanel


