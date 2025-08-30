
// /js/admin.js - v10 Firebase, część 1: konfiguracja i helpery
import { db, auth, storage } from './firebase-config.js';
import { 
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- helpery ---
const $ = id => document.getElementById(id);
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce = (fn, ms = 250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; };
const DRAFT_KEY = 'adminEntryDraft_v1';

function showTemp(el, txt, ok = true){
  if (!el) return;
  el.textContent = txt;
  el.className = ok ? 'muted-small success' : 'muted-small danger';
  setTimeout(()=>{ el.textContent=''; el.className='muted-small'; }, 2200);
}

// --- autoryzacja ---
onAuthStateChanged(auth, user => { 
  if (!user) { window.location.href = 'login.html'; return; } 
  initPanel(user); 
});

// --- inicjalizacja panelu ---
async function initPanel(user){
  const adminEmail = $('adminEmail'), logoutBtn = $('logoutBtn');
  adminEmail.textContent = user.email || user.uid;
  logoutBtn?.addEventListener('click', () => signOut(auth).catch(console.error));

  // --- CKEditor ---
  const contentInput = $('contentInput'), liveTitle = $('liveTitle'), liveContent = $('liveContent'), titleInput = $('titleInput'), authorInput = $('authorInput'), attachInput = $('attachInput'), uploadPreview = $('uploadPreview');
  
  function getEditorHtml(){ 
    try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) return CKEDITOR.instances.contentInput.getData(); } catch(e){} 
    return contentInput?.value || ''; 
  }
  function setEditorHtml(html=''){ 
    try { if (window.CKEDITOR && CKEDITOR.instances.contentInput) CKEDITOR.instances.contentInput.setData(html); else if (contentInput) contentInput.value = html; } catch(e){} 
  }
  function initCk(){ 
    try { 
      if (!window.CKEDITOR || !contentInput || CKEDITOR.instances.contentInput) return; 
      const ed = CKEDITOR.replace('contentInput', { height: 260 }); 
      ed.on('change', () => { updateLivePreview(); saveDraft(); }); 
    } catch(e){ console.warn('initCk err', e); } 
  }
  initCk();
  document.addEventListener('DOMContentLoaded', initCk);

  function updateLivePreview(){
    if (liveTitle) liveTitle.innerHTML = titleInput?.value || 'Tytuł podglądu';
    if (liveContent) liveContent.innerHTML = getEditorHtml() || '<em>Treść podglądu...</em>';
    if (uploadPreview){
      uploadPreview.innerHTML='';
      const f = attachInput?.files?.[0];
      if (f){
        const url = URL.createObjectURL(f);
        if (f.type.startsWith('image/')){
          const img = document.createElement('img'); img.src=url; img.className='thumb'; uploadPreview.appendChild(img);
        } else { uploadPreview.textContent=f.name; }
      }
    }
  }

  titleInput?.addEventListener('input', ()=>{ updateLivePreview(); saveDraft(); });
  authorInput?.addEventListener('input', ()=>{ updateLivePreview(); saveDraft(); });
  attachInput?.addEventListener('change', updateLivePreview);

  // --- draft w localStorage ---
  const draftBadge = $('draftBadge'), clearDraftBtn = $('clearDraftBtn');
  function saveDraft(){
    const data = { title: titleInput?.value||'', author: authorInput?.value||'', content: getEditorHtml() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    if(draftBadge) draftBadge.style.display='inline-block';
  }
  function loadDraft(){
    const d = localStorage.getItem(DRAFT_KEY);
    if(!d) return;
    try{ const data=JSON.parse(d); titleInput.value=data.title||''; authorInput.value=data.author||''; setEditorHtml(data.content||''); updateLivePreview(); if(draftBadge) draftBadge.style.display='inline-block'; }catch(e){console.warn(e);}
  }
  clearDraftBtn?.addEventListener('click', ()=>{
    localStorage.removeItem(DRAFT_KEY);
    if(draftBadge) draftBadge.style.display='none';
  });
  loadDraft();
}
// /js/admin.js - v10 Firebase, część 2: CRUD menu, wpisów, galerii, playlist, iskierka

// --- kolekcje ---
const colMenu = collection(db, 'menu');
const colPosts = collection(db, 'posts');
const colGallery = collection(db, 'gallery');
const colPlaylist = collection(db, 'playlist');
const colIskierka = collection(db, 'iskierka');

// --- MENU CRUD ---
const menuList = $('menuList'), menuForm = $('menuForm'), menuInput = $('menuInput');
menuForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const val = menuInput.value.trim();
  if(!val) return showTemp(menuList, 'Wpisz nazwę menu', false);
  await addDoc(colMenu, { name: val, created: serverTimestamp() });
  menuInput.value=''; showTemp(menuList, 'Dodano menu');
});

onSnapshot(colMenu, query(colMenu, orderBy('created','desc')), snapshot=>{
  if(!menuList) return;
  menuList.innerHTML='';
  snapshot.forEach(doc=>{
    const li = document.createElement('li');
    li.textContent = doc.data().name;
    const del = document.createElement('button'); del.textContent='Usuń';
    del.addEventListener('click', async ()=>{ await deleteDoc(doc.ref); });
    li.appendChild(del); menuList.appendChild(li);
  });
});

// --- Wpisy CRUD ---
const postsList = $('postsList'), postForm = $('postForm'), postTitle = $('titleInput'), postAuthor = $('authorInput'), postContent = () => window.CKEDITOR.instances.contentInput.getData();
postForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const title=postTitle.value.trim(), author= $('authorInput')?.value.trim(), content=postContent();
  if(!title || !content) return showTemp(postsList,'Uzupełnij tytuł i treść',false);
  const attachFile = $('attachInput')?.files?.[0];
  let attachURL='';
  if(attachFile){
    const sRef = sref(storage, `attachments/${Date.now()}_${attachFile.name}`);
    const uploadTask = uploadBytesResumable(sRef, attachFile);
    await new Promise((res,rej)=>{ uploadTask.on('state_changed',null,rej,()=>res()); });
    attachURL = await getDownloadURL(sRef);
  }
  await addDoc(colPosts,{title,author,content,attachURL,created:serverTimestamp()});
  postTitle.value=''; $('authorInput').value=''; $('attachInput').value=''; setEditorHtml(''); updateLivePreview(); showTemp(postsList,'Dodano wpis');
});

onSnapshot(colPosts, query(colPosts, orderBy('created','desc')), snapshot=>{
  if(!postsList) return;
  postsList.innerHTML='';
  snapshot.forEach(doc=>{
    const d = doc.data();
    const li = document.createElement('li');
    li.innerHTML=`<strong>${escapeHtml(d.title)}</strong> ${escapeHtml(d.author||'')} <small>${d.created?.toDate?.()}</small>`;
    const del = document.createElement('button'); del.textContent='Usuń';
    del.addEventListener('click', async ()=>{ 
      if(d.attachURL) await deleteObject(sref(storage,d.attachURL)).catch(()=>{}); 
      await deleteDoc(doc.ref); 
    });
    li.appendChild(del); postsList.appendChild(li);
  });
});

// --- GALERIA CRUD ---
const galleryList = $('galleryList'), galleryForm = $('galleryForm'), galleryInput = $('galleryInput');
galleryForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const file = galleryInput.files[0]; if(!file) return showTemp(galleryList,'Wybierz plik',false);
  const sRef = sref(storage, `gallery/${Date.now()}_${file.name}`);
  await uploadBytesResumable(sRef, file).then(()=>getDownloadURL(sRef)).then(async url=>{
    await addDoc(colGallery,{url,created:serverTimestamp()});
    galleryInput.value=''; showTemp(galleryList,'Dodano zdjęcie');
  });
});

onSnapshot(colGallery, query(colGallery, orderBy('created','desc')), snapshot=>{
  if(!galleryList) return;
  galleryList.innerHTML='';
  snapshot.forEach(doc=>{
    const d=doc.data();
    const li=document.createElement('li');
    const img=document.createElement('img'); img.src=d.url; img.className='thumb';
    const del=document.createElement('button'); del.textContent='Usuń';
    del.addEventListener('click', async ()=>{
      await deleteObject(sref(storage,d.url)).catch(()=>{});
      await deleteDoc(doc.ref);
    });
    li.appendChild(img); li.appendChild(del); galleryList.appendChild(li);
  });
});

// --- PLAYLIST CRUD ---
const playlistList = $('playlistList'), playlistForm = $('playlistForm'), playlistInput = $('playlistInput');
playlistForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const url = playlistInput.value.trim();
  if(!url) return showTemp(playlistList,'Podaj URL',false);
  await addDoc(colPlaylist,{url,created:serverTimestamp()});
  playlistInput.value=''; showTemp(playlistList,'Dodano utwór');
});

onSnapshot(colPlaylist, query(colPlaylist, orderBy('created','desc')), snapshot=>{
  if(!playlistList) return;
  playlistList.innerHTML='';
  snapshot.forEach(doc=>{
    const d=doc.data();
    const li=document.createElement('li');
    li.innerHTML=escapeHtml(d.url);
    const del = document.createElement('button'); del.textContent='Usuń';
    del.addEventListener('click', async ()=>{ await deleteDoc(doc.ref); });
    li.appendChild(del); playlistList.appendChild(li);
  });
});

// --- ISKIERKA CRUD ---
const iskierkaList = $('iskierkaList'), iskierkaForm = $('iskierkaForm'), iskierkaInput = $('iskierkaInput');
iskierkaForm?.addEventListener('submit', async e=>{
  e.preventDefault();
  const text = iskierkaInput.value.trim();
  if(!text) return showTemp(iskierkaList,'Wpisz treść',false);
  await addDoc(colIskierka,{text,created:serverTimestamp()});
  iskierkaInput.value=''; showTemp(iskierkaList,'Dodano iskierkę');
});

onSnapshot(colIskierka, query(colIskierka, orderBy('created','desc')), snapshot=>{
  if(!iskierkaList) return;
  iskierkaList.innerHTML='';
  snapshot.forEach(doc=>{
    const d=doc.data();
    const li = document.createElement('li');
    li.textContent=d.text;
    const del = document.createElement('button'); del.textContent='Usuń';
    del.addEventListener('click', async ()=>{ await deleteDoc(doc.ref); });
    li.appendChild(del); iskierkaList.appendChild(li);
  });
});
