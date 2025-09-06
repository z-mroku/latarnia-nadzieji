import { db, auth, storage } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot,
  serverTimestamp, getDocs, collectionGroup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id);
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stripHtml = s => String(s || '').replace(/<[^>]*>?/gm,'');
const debounce = (fn, ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; };
const DRAFT_KEY = 'adminEntryDraft_v1';
function showTemp(el, txt, ok=true){ if(!el) return; el.textContent=txt; el.className=ok?'muted-small success':'muted-small danger'; setTimeout(()=>{el.textContent=''; el.className='muted-small';},2200); }

onAuthStateChanged(auth, user=>{ if(!user){ window.location.href='login.html'; return; } initPanel(user); });

async function initPanel(user){
  const adminEmail = $('adminEmail'), logoutBtn = $('logoutBtn');
  adminEmail.textContent = user.email || user.uid;
  logoutBtn?.addEventListener('click',()=>signOut(auth).catch(console.error));

  // formularze i pola
  const entryForm = $('entryForm'), sectionSelect=$('sectionSelect'), authorInput=$('authorInput'), themeSelect=$('themeSelect'), titleInput=$('titleInput'), contentInput=$('contentInput'), attachInput=$('attachInput'), publishBtn=$('publishBtn'), cancelEntryEditBtn=$('cancelEntryEditBtn'), formMsg=$('formMsg'), uploadPreview=$('uploadPreview'), draftBadge=$('draftBadge'), clearDraftBtn=$('clearDraftBtn');
  const galleryForm=$('galleryForm'), galleryDesc=$('galleryDesc'), galleryUpload=$('galleryUpload'), galleryProgressBar=$('galleryProgressBar'), galleryList=$('galleryList'), menuMsg=$('menuMsg');
  const sparksList=$('sparksList'), sparkForm=$('sparkForm'), sparkInput=$('sparkInput');
  const playlistForm=$('playlistForm'), songTitle=$('songTitle'), songLink=$('songLink'), playlistList=$('playlistList');
  const helpForm=$('helpForm'), helpWoj=$('helpWoj'), helpName=$('helpName'), helpAddress=$('helpAddress'), helpPhone=$('helpPhone'), helpDesc=$('helpDesc'), helpLink=$('helpLink'), addHelpBtn=$('addHelpBtn'), cancelHelpEditBtn=$('cancelHelpEditBtn'), helpListContainer=$('helpListContainer');
  const filterSection=$('filterSection'), searchInput=$('searchInput'), sortSelect=$('sortSelect'), entriesList=$('entriesList');
  const liveTitle=$('liveTitle'), liveMeta=$('liveMeta'), liveContent=$('liveContent');
  const ttsListenBtn=$('ttsListenBtn'), readerStatus=$('readerStatus'), readerSelectionInfo=$('readerSelectionInfo');
  const entryModal=$('entryModal'), entryModalTitle=$('entryModalTitle'), entryModalMeta=$('entryModalMeta'), entryModalBody=$('entryModalBody'), modalTtsBtn=$('modalTtsBtn'), modalCloseBtn=$('modalCloseBtn'), modalCloseBtn2=$('modalCloseBtn2'), modalEditBtn=$('modalEditBtn');

  let editEntryId=null, editGalleryId=null, entriesCache=[];

  function getEditorHtml(){ try { if(window.CKEDITOR && CKEDITOR.instances.contentInput) return CKEDITOR.instances.contentInput.getData(); } catch(e){} return contentInput?.value||''; }
  function setEditorHtml(html=''){ try { if(window.CKEDITOR && CKEDITOR.instances.contentInput) CKEDITOR.instances.contentInput.setData(html); else if(contentInput) contentInput.value=html; } catch(e){} }

  // inicjalizacja CKEditor
  try { if(window.CKEDITOR && contentInput && !CKEDITOR.instances.contentInput){ const ed=CKEDITOR.replace('contentInput',{height:260}); ed.on('change',()=>{ updateLivePreview(); saveDraft(); }); } } catch(e){ console.warn(e); }

  function updateLivePreview(){
    if(liveTitle) liveTitle.innerHTML=titleInput?.value||'Tytuł podglądu';
    if(liveMeta) liveMeta.textContent=`${authorInput?.value||'Autor'} • ${new Date().toLocaleString('pl-PL')}`;
    if(liveContent) liveContent.innerHTML=getEditorHtml()||'<em>Treść podglądu...</em>';
    if(uploadPreview && !uploadPreview.dataset.locked){
      uploadPreview.innerHTML='';
      const f=attachInput?.files?.[0];
      if(f){ const url=URL.createObjectURL(f); if(f.type.startsWith('image/')){ const img=document.createElement('img'); img.src=url; img.className='thumb'; uploadPreview.appendChild(img); } else uploadPreview.textContent=f.name; }
    }
  }
  titleInput?.addEventListener('input',()=>{ updateLivePreview(); saveDraft(); });
  authorInput?.addEventListener('input',()=>{ updateLivePreview(); saveDraft(); });
  attachInput?.addEventListener('change',updateLivePreview);

  // --- DRAFTY ---
  function saveDraft(){ try{ localStorage.setItem(DRAFT_KEY,JSON.stringify({section:sectionSelect?.value,author:authorInput?.value,theme:themeSelect?.value||'auto',title:titleInput?.value,html:getEditorHtml(),ts:Date.now()})); updateDraftBadge(); } catch(e){} }
  function loadDraft(){ try{ const raw=localStorage.getItem(DRAFT_KEY); if(!raw) return; const d=JSON.parse(raw); if(d.section) sectionSelect.value=d.section; if(d.author) authorInput.value=d.author; if(d.theme) themeSelect.value=d.theme; if(d.title) titleInput.value=d.title; if(d.html) setEditorHtml(d.html); updateLivePreview(); updateDraftBadge(); } catch(e){} }
  function clearDraft(){ try{ localStorage.removeItem(DRAFT_KEY); updateDraftBadge(); } catch(e){} }
  function updateDraftBadge(){ if(!draftBadge) return; const raw=localStorage.getItem(DRAFT_KEY); if(!raw){ draftBadge.textContent='Wersja robocza: —'; return; } try{ const {ts}=JSON.parse(raw); draftBadge.textContent=ts?`Wersja robocza: ${new Date(ts).toLocaleString('pl-PL')}`:'Wersja robocza: —'; } catch(e){ draftBadge.textContent='Wersja robocza: —'; } }
  loadDraft(); clearDraftBtn?.addEventListener('click',()=>{ clearDraft(); showTemp(formMsg,'Wyczyszczono wersję roboczą'); }); setInterval(saveDraft,15000);

  // --- ZAPIS / EDYCJA WPISU ---
  entryForm?.addEventListener('submit', async e=>{
    e.preventDefault();
    const title=(titleInput?.value||'').trim();
    const section=sectionSelect?.value||'Kronika';
    const author=(authorInput?.value||'').trim()||'Chudy';
    const theme=themeSelect?.value||'auto';
    const text=getEditorHtml().trim();
    if(!title||!text) return showTemp(formMsg,'Tytuł i treść są wymagane',false);
    publishBtn.disabled=true; showTemp(formMsg,'Trwa zapisywanie...');
    try {
      let attachment=null;
      const f=attachInput?.files?.[0];
      if(f){
        const safe=f.name.replace(/[^\w.\-]+/g,'_');
        const path=`entries/${Date.now()}_${safe}`;
        const sRef=sref(storage,path);
        const task=uploadBytesResumable(sRef,f);
        await task;
        const url=await getDownloadURL(sRef);
        attachment={url,meta:{path}};
      }
      const payload={section,title,author,text,attachment,theme,updatedAt:serverTimestamp()};
      if(editEntryId){
        const entryRef=doc(db,'sekcje',editEntryId.section,'entries',editEntryId.id);
        await updateDoc(entryRef,payload);
      } else {
        const entriesCollectionRef=collection(db,'sekcje',section,'entries');
        await addDoc(entriesCollectionRef,{...payload,createdAt:serverTimestamp()});
      }
      entryForm.reset(); setEditorHtml(''); editEntryId=null; publishBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; cancelEntryEditBtn.style.display='none'; updateLivePreview(); clearDraft(); showTemp(formMsg,'Zapisano');
    } catch(e){ showTemp(formMsg,'Błąd zapisu',false); console.error(e); } finally { publishBtn.disabled=false; }
  });
  cancelEntryEditBtn?.addEventListener('click',()=>{ editEntryId=null; entryForm?.reset(); setEditorHtml(''); cancelEntryEditBtn.style.display='none'; publishBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Opublikuj'; updateLivePreview(); });

  // --- WYŚWIETLANIE WPISÓW ---
  function renderEntries(list=[]){
    if(!entriesList) return;
    let arr=list.slice();
    const filter=filterSection?.value||'';
    const q=(searchInput?.value||'').toLowerCase();
    const sort=sortSelect?.value||'desc';
    if(filter) arr=arr.filter(x=>(x.section||'')===filter);
    if(q) arr=arr.filter(x=>{ const t=stripHtml(x.title||'').toLowerCase(); const s=stripHtml(x.text||'').toLowerCase(); return t.includes(q)||s.includes(q); });
    if(sort==='title') arr.sort((a,b)=>(stripHtml(a.title||'')).localeCompare(stripHtml(b.title||'')));
    else if(sort==='asc') arr.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
    else arr.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    entriesList.innerHTML='';
    arr.forEach(e=>{
      const div=document.createElement('div'); div.className='list-item'; div.dataset.id=e.id;
      const date=e.createdAt?.toDate?e.createdAt.toDate().toLocaleString('pl-PL'):'';
      const excerpt=stripHtml(e.text||'').slice(0,150)+(stripHtml(e.text||'').length>150?'…':'');
      const attHtml=e.attachment?.url?`<img src="${e.attachment.url}" class="entry-list-thumb" alt="Miniaturka">`:'';
      div.innerHTML=`<div class="list-item-content">${attHtml}<div><div class="entry-title" style="font-weight:700">${e.title||'Bez tytułu'}</div><div class="muted-small">${escapeHtml(e.section||'')} • ${escapeHtml(e.author||'')} • ${date}</div><div style="margin-top:8px;color:#cfe4ff" class="excerpt">${escapeHtml(excerpt)}</div><div style="margin-top:6px"><button class="btn-link" data-action="read" data-id="${e.id}">Czytaj dalej</button></div></div></div><div class="row" style="gap:6px"><button class="ghost small listen" data-id="${e.id}" title="Odsłuchaj"><i class="fa-solid fa-headphones-simple"></i></button><button class="ghost small" data-action="edit" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button><button class="ghost small danger" data-action="del" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
      entriesList.appendChild(div);
    });

    // kliknięcia
    entriesList.querySelectorAll('.list-item').forEach(item=>{
      item.addEventListener('click', ev=>{
        if(ev.target.closest('button')||ev.target.closest('a')) return;
        document.querySelectorAll('.list-item.selected').forEach(el=>el.classList.remove('selected'));
        item.classList.add('selected');
        const id=item.dataset.id; selectedEntryIdForTTS=id;
        ttsListenBtn.disabled=false;
        const titleEl=item.querySelector('.entry-title'); const tmp=document.createElement('div'); tmp.innerHTML=titleEl?titleEl.innerHTML:''; readerSelectionInfo.innerHTML=`Zaznaczono: "<strong>${tmp.textContent||tmp.innerText}</strong>"`;
      });
    });

    entriesList.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', async ev=>{
        ev.stopPropagation();
        const id=ev.currentTarget.dataset.id;
        const act=ev.currentTarget.dataset.action;
        const entry=entriesCache.find(e=>e.id===id);
        if(!entry){ console.warn('Nie znaleziono wpisu',id); return; }

        if(act==='read'){ openEntryModal(entry); return; }
        if(ev.currentTarget.classList.contains('listen')){ speakText(stripHtml((entry.title?entry.title+'. ':'')+(entry.text||'')),readerStatus); return; }
        if(act==='edit'){
          editEntryId={id:id,section:entry.section};
          sectionSelect.value=entry.section||''; titleInput.value=entry.title||''; authorInput.value=entry.author||''; themeSelect.value=entry.theme||'auto'; setEditorHtml(entry.text||'');
          if(entry.attachment?.url && uploadPreview) uploadPreview.innerHTML=`<img src="${entry.attachment.url}" class="thumb" alt="Podgląd">`; else uploadPreview.innerHTML='';
          publishBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany'; cancelEntryEditBtn.style.display='inline-block'; window.scrollTo({top:0,behavior:'smooth'}); updateLivePreview();
        }
        if(act==='del'){ if(!confirm('Na pewno usunąć?')) return; const entryRef=doc(db,'sekcje',entry.section,'entries',id); if(entry.attachment?.meta?.path) await deleteObject(sref(storage,entry.attachment.meta.path)).catch(()=>{}); await deleteDoc(entryRef); }
      });
    });
  }

  onSnapshot(query(collectionGroup(db,'entries'),orderBy('createdAt','desc')),snap=>{ entriesCache=snap.docs.map(d=>({id:d.id,...d.data()})); renderEntries(entriesCache); });
  const rerender=debounce(()=>renderEntries(entriesCache),200); searchInput?.addEventListener('input',rerender); filterSection?.addEventListener('change',rerender); sortSelect?.addEventListener('change',rerender);

  // --- TTS ---
  function speakText(text,statusEl){ if(!text) return; try{ const synth=window.speechSynthesis; synth.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='pl-PL'; if(statusEl){ u.onstart=()=>statusEl.textContent='Lektor: czyta...'; u.onend=()=>{ statusEl.textContent='Lektor: zakończono'; setTimeout(()=>statusEl.textContent='Lektor: gotowy',1200); } } synth.speak(u); } catch(e){ console.error(e); }
  }
  ttsListenBtn?.addEventListener('click',()=>{ if(!selectedEntryIdForTTS) return; const entry=entriesCache.find(e=>e.id===selectedEntryIdForTTS); if(!entry) return alert('Nie znaleziono wpisu'); speakText(stripHtml((entry.title?entry.title+'. ':'')+(entry.text||'')),readerStatus); });

  // --- MODAL ---
  function openEntryModal(entry){ if(!entry) return; entryModalTitle.textContent=entry.title||'Bez tytułu'; entryModalMeta.textContent=`${entry.section||''} • ${entry.author||''} • ${entry.createdAt?.toDate?entry.createdAt.toDate().toLocaleString('pl-PL'):''}`; entryModalBody.innerHTML=(entry.attachment?.url?`<p><img src="${entry.attachment.url}" style="max-width:100%;border-radius:8px;margin-bottom:10px"></p>`:'')+(entry.text||''); entryModal.classList.add('open'); modalTtsBtn.onclick=()=>speakText(stripHtml((entry.title?entry.title+'. ':'')+(entry.text||'')),readerStatus); modalEditBtn.onclick=async()=>{
    entryModal.classList.remove('open'); const snap=await getDoc(doc(db,'sekcje',entry.section,'entries',entry.id)); if(!snap.exists()) return alert('Wpis nie istnieje'); const data=snap.data(); editEntryId={id:entry.id,section:entry.section}; sectionSelect.value=data.section||''; titleInput.value=data.title||''; authorInput.value=data.author||''; themeSelect.value=data.theme||'auto'; setEditorHtml(data.text||''); if(data.attachment?.url && uploadPreview) uploadPreview.innerHTML=`<img src="${data.attachment.url}" class="thumb" alt="">`; publishBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Zapisz zmiany'; cancelEntryEditBtn.style.display='inline-block'; window.scrollTo({top:0,behavior:'smooth'}); updateLivePreview(); }; 
  function closeEntryModal(){ entryModal.classList.remove('open'); window.speechSynthesis?.cancel(); }
  modalCloseBtn?.addEventListener('click',closeEntryModal); modalCloseBtn2?.addEventListener('click',closeEntryModal);

  // --- GALERIA ---
  galleryForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!galleryUpload?.files?.length) return showTemp(menuMsg,'Brak pliku',false);
    const f=galleryUpload.files[0]; const desc=(galleryDesc?.value||'').trim(); const safe=f.name.replace(/[^\w.\-]+/g,'_'); const path=`gallery/${Date.now()}_${safe}`; const sRef=sref(storage,path); const task=uploadBytesResumable(sRef,f);
    task.on('state_changed',s=>{ const pct=Math.floor((s.bytesTransferred/s.totalBytes)*100); if(galleryProgressBar) galleryProgressBar.style.width=pct+'%'; });
    try{ await task; const url=await getDownloadURL(sRef); await addDoc(collection(db,'gallery'),{url,desc,meta:{path},createdAt:serverTimestamp()}); galleryForm.reset(); if(galleryProgressBar) galleryProgressBar.style.width='0%'; renderGallery(); showTemp(menuMsg,'Dodano'); } catch(e){ console.error(e); showTemp(menuMsg,'Błąd',false); }
  });
  async function renderGallery(){
    if(!galleryList) return; galleryList.innerHTML=''; const snap=await getDocs(query(collection(db,'gallery'),orderBy('createdAt','desc'))); snap.forEach(d=>{ const g=d.data(); const div=document.createElement('div'); div.className='list-item'; div.innerHTML=`<div><img src="${g.url}" class="thumb"><div>${escapeHtml(g.desc||'')}</div></div><div class="row"><button class="ghost small danger" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>`; galleryList.appendChild(div); div.querySelector('button').addEventListener('click',async()=>{ if(!confirm('Usuń?')) return; await deleteDoc(doc(db,'gallery',d.id)); if(g.meta?.path) await deleteObject(sref(storage,g.meta.path)).catch(()=>{}); renderGallery(); }); }); }
  renderGallery();

  // --- PLAYLISTA ---
  playlistForm?.addEventListener('submit',async e=>{
    e.preventDefault(); const title=(songTitle?.value||'').trim(); const link=(songLink?.value||'').trim(); if(!title||!link) return showTemp(playlistMsg,'Wypełnij tytuł i link',false);
    try{ await addDoc(collection(db,'playlist'),{title,link,createdAt:serverTimestamp()}); playlistForm.reset(); renderPlaylist(); showTemp(playlistMsg,'Dodano'); } catch(e){ console.error(e); showTemp(playlistMsg,'Błąd',false); }
  });
  async function renderPlaylist(){ if(!playlistList) return; playlistList.innerHTML=''; const snap=await getDocs(query(collection(db,'playlist'),orderBy('createdAt','desc'))); snap.forEach(d=>{ const p=d.data(); const div=document.createElement('div'); div.className='list-item'; div.innerHTML=`<div><div style="font-weight:700">${p.title}</div><div class="muted-small">${p.link}</div></div><div class="row"><button class="ghost small danger" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>`; playlistList.appendChild(div); div.querySelector('button').addEventListener('click',async()=>{ if(!confirm('Usuń z playlisty?')) return; await deleteDoc(doc(db,'playlist',d.id)); renderPlaylist(); }); }); }
  renderPlaylist();

  // --- SPARKS ---
  sparkForm?.addEventListener('submit',async e=>{ e.preventDefault(); const txt=(sparkInput?.value||'').trim(); if(!txt) return; try{ await addDoc(collection(db,'sparks'),{txt,createdAt:serverTimestamp()}); sparkForm.reset(); renderSparks(); } catch(e){ console.error(e); } });
  async function renderSparks(){ if(!sparksList) return; sparksList.innerHTML=''; const snap=await getDocs(query(collection(db,'sparks'),orderBy('createdAt','desc'))); snap.forEach(d=>{ const s=d.data(); const div=document.createElement('div'); div.className='list-item'; div.innerHTML=`<div>${escapeHtml(s.txt)}</div><div class="row"><button class="ghost small danger" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>`; sparksList.appendChild(div); div.querySelector('button').addEventListener('click',async()=>{ if(!confirm('Usuń spark?')) return; await deleteDoc(doc(db,'sparks',d.id)); renderSparks(); }); }); }
  renderSparks();

  // --- POMOC / OŚRODKI ---
  helpForm?.addEventListener('submit',async e=>{ e.preventDefault(); const data={woj:helpWoj?.value||'',name:helpName?.value||'',address:helpAddress?.value||'',phone:helpPhone?.value||'',desc:helpDesc?.value||'',link:helpLink?.value||'',createdAt:serverTimestamp()}; try{ await addDoc(collection(db,'help'),data); helpForm.reset(); renderHelp(); } catch(e){ console.error(e); } });
  async function renderHelp(){ if(!helpListContainer) return; helpListContainer.innerHTML=''; const snap=await getDocs(query(collection(db,'help'),orderBy('createdAt','desc'))); snap.forEach(d=>{ const h=d.data(); const div=document.createElement('div'); div.className='list-item'; div.innerHTML=`<div><strong>${escapeHtml(h.name)}</strong><br>${escapeHtml(h.woj)} • ${escapeHtml(h.address)} • ${escapeHtml(h.phone)}<br>${escapeHtml(h.desc)}<br>${escapeHtml(h.link)}</div><div class="row"><button class="ghost small danger" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>`; helpListContainer.appendChild(div); div.querySelector('button').addEventListener('click',async()=>{ if(!confirm('Usuń?')) return; await deleteDoc(doc(db,'help',d.id)); renderHelp(); }); }); }
  renderHelp();
}
