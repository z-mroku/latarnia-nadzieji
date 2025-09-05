
// Plik: /js/main.js

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ====== GLOBAL ======
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// ====== UTILS ======
function stripHtml(html){
  const tmp=document.createElement('div'); tmp.innerHTML=html||'';
  return (tmp.textContent||tmp.innerText||'').trim();
}

// ====== MENU ======
export async function fetchAndRenderMenu(container){
  try{
    const snap = await getDocs(query(collection(db,'menu'), orderBy('order','asc')));
    container.innerHTML = snap.docs.map(d=>{
      const m=d.data(); return `<li><a href="${m.url}">${m.text}</a></li>`;
    }).join('') || '<li><a>Brak menu</a></li>';
  }catch(e){
    console.error('Błąd wczytywania menu:', e);
    container.innerHTML = '<li><a>Błąd wczytywania menu</a></li>';
  }
}

// ====== OSTATNIA LATARNIA NADZIEI (agreguje wpisy, bez specjalnych) ======
export async function fetchLatarniaNadziei(container){
  try{
    const snap = await getDocs(query(collectionGroup(db,'entries'), orderBy('createdAt','desc')));
    const special = new Set(['Piciorys Chudego','Z punktu widzenia księżniczki','Pomoc','Galeria','Latarnia z Mroku']);
    const entries = snap.docs.map(doc=>{
      const data=doc.data();
      const section = doc.ref.parent.parent?.id || data.section || 'Inne';
      return { id: doc.id, section, ...data };
    }).filter(e=>!special.has(e.section));

    if(!entries.length){ container.innerHTML = "<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>"; return; }

    container.innerHTML = entries.slice(0,3).map(e=>{
      const skrot = stripHtml(e.text||'').slice(0,300);
      const url = `wpis.html?section=${encodeURIComponent(e.section)}&id=${e.id}`;
      return `<article class="story-item">
        <h3 class="fancy-title"><a href="${url}" style="text-decoration:none;color:inherit;">${e.title||'Bez tytułu'}</a></h3>
        <div class="entry-item-meta"><strong>W sekcji: ${e.section}</strong> • ${e.createdAt?e.createdAt.toDate().toLocaleDateString('pl-PL'):''}</div>
        <div class="wpis-skrot"><p>${skrot}...</p></div>
        <a href="${url}" class="speak-button" style="text-decoration:none;margin:15px auto 0;display:table;">Czytaj dalej</a>
      </article>`;
    }).join('');
  }catch(e){
    console.error('Błąd wczytywania Latarni:', e);
    container.innerHTML = "<p style='text-align:center;'>Błąd wczytywania wpisów.</p>";
  }
}

// ====== ISKIERKI ======
export async function fetchSparks(textEl){
  try{
    const snap=await getDocs(query(collection(db,'sparks'), orderBy('createdAt','desc')));
    sparksFromDB = snap.docs.map(d=>d.data().quote).filter(Boolean);
    if(!sparksFromDB.length){ textEl.innerText='Brak iskierek w bazie.'; return; }
    changeSpark(textEl);
  }catch(e){
    console.error('Błąd wczytywania iskierek:', e);
    if(textEl) textEl.innerText='Błąd ładowania iskierek.';
  }
}
export function changeSpark(textEl){
  if(!textEl || !sparksFromDB.length) return;
  const q = sparksFromDB[Math.floor(Math.random()*sparksFromDB.length)];
  textEl.style.opacity=0;
  setTimeout(()=>{ textEl.innerText=q; textEl.style.opacity=1; },300);
}

// ====== YOUTUBE / PLAYLISTA ======
function getVideoId(url){
  if(!url) return null;
  const r=/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const m=url.match(r); return m?m[1]:null;
}

// inject API once
(function injectYT(){
  if(document.getElementById('ytapi')) return;
  const s=document.createElement('script');
  s.id='ytapi'; s.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
})();

window.onYouTubeIframeAPIReady = function(){
  const host = document.getElementById('youtube-player');
  if(!host) return;
  player = new YT.Player('youtube-player',{
    height:'0', width:'0',
    playerVars:{playsinline:1, origin:window.location.origin},
    events:{onReady:onPlayerReady, onStateChange:onPlayerStateChange}
  });
};

async function onPlayerReady(){
  const titleEl=document.getElementById('current-song-title');
  try{
    const snap=await getDocs(query(collection(db,'playlist'), orderBy('createdAt','asc')));
    playlist = snap.docs.map(d=>({ title:d.data().title, videoId:getVideoId(d.data().link) })).filter(x=>x.videoId);
    if(!playlist.length){ if(titleEl) titleEl.innerText='Brak utworów w playliście.'; return; }
    loadCurrentSong(false);
  }catch(e){
    console.error('Błąd wczytywania playlisty:', e);
    if(titleEl) titleEl.innerText='Błąd ładowania playlisty.';
  }
}
function onPlayerStateChange(ev){
  const btn=document.getElementById('play-pause-btn');
  const icon=btn?btn.querySelector('i'):null;
  if(icon) icon.className = (ev.data===YT.PlayerState.PLAYING)?'fas fa-pause':'fas fa-play';
  if(ev.data===YT.PlayerState.ENDED) nextSong();
}
export function togglePlayPause(){
  if(!player || !playlist.length) return;
  const st=player.getPlayerState();
  (st===YT.PlayerState.PLAYING)?player.pauseVideo():player.playVideo();
}
function loadCurrentSong(autoplay=true){
  const titleEl=document.getElementById('current-song-title');
  if(!player || !playlist.length || !titleEl) return;
  const song=playlist[currentIndex];
  titleEl.style.opacity=0;
  setTimeout(()=>{ titleEl.innerText=song.title; titleEl.style.opacity=1; },300);
  autoplay?player.loadVideoById(song.videoId):player.cueVideoById(song.videoId);
}
export function nextSong(){ if(!playlist.length) return; currentIndex=(currentIndex+1)%playlist.length; loadCurrentSong(true); }
export function prevSong(){ if(!playlist.length) return; currentIndex=(currentIndex-1+playlist.length)%playlist.length; loadCurrentSong(true); }

// ====== DISQUS ======
export function initializeDisqus(){
  (function(){
    const d=document, s=d.createElement('script');
    s.src='https://od-dna-do-swiatla.disqus.com/embed.js';
    s.setAttribute('data-timestamp', +new Date());
    (d.head||d.body).appendChild(s);
  })();
}

// ====== LATARNIA – dynamiczny widok w index ======
export async function loadLatarniaContent(){
  const main=document.getElementById('main-content');
  const dyn = document.getElementById('dynamic-content-container');
  if(!main || !dyn){ console.error("Brak kontenerów 'main-content' lub 'dynamic-content-container'"); return; }
  try{
    const res = await fetch('latarnia-template.html');
    if(!res.ok) throw new Error('Nie udało się załadować latarnia-template.html');
    const html=await res.text();
    main.style.display='none';
    dyn.innerHTML=html;
    dyn.style.display='flex';
    const back=document.getElementById('back-to-main-btn');
    if(back) back.addEventListener('click', ()=>{
      dyn.style.display='none'; main.style.display='block'; dyn.innerHTML='';
    });
  }catch(e){
    console.error('Błąd ładowania dynamicznej treści:', e);
    if(main) main.style.display='block';
  }
}

// ====== START ======
document.addEventListener('DOMContentLoaded', ()=>{
  const menu=document.getElementById('main-menu');
  const entriesContainer=document.getElementById('entries-container'); // używane tylko na index (latarnia)
  const sparkText=document.getElementById('sparkText');
  const sparkBtn=document.getElementById('sparkButton');
  const playPauseBtn=document.getElementById('play-pause-btn');
  const prevBtn=document.getElementById('prev-btn');
  const nextBtn=document.getElementById('next-btn');
  const loadLatarniaBtn=document.getElementById('load-latarnia-btn');

  if(menu) fetchAndRenderMenu(menu);
  if(entriesContainer) fetchLatarniaNadziei(entriesContainer);
  if(sparkText) fetchSparks(sparkText);
  if(document.getElementById('disqus_thread')) initializeDisqus();

  sparkBtn?.addEventListener('click', ()=>changeSpark(sparkText));
  playPauseBtn?.addEventListener('click', togglePlayPause);
  prevBtn?.addEventListener('click', prevSong);
  nextBtn?.addEventListener('click', nextSong);
  loadLatarniaBtn?.addEventListener('click', loadLatarniaContent);
});
