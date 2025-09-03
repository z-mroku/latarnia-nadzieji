// Plik: /js/main.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, collectionGroup, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Zmienne globalne ---
let sparksFromDB = [], player, playlist = [], currentIndex = 0;

// --- Menu ---
export async function fetchAndRenderMenu(container){
    try{
        const snap = await getDocs(query(collection(db,"menu"),orderBy("order","asc")));
        container.innerHTML = snap.docs.map(d=>`<li><a href="${d.data().url}">${d.data().text}</a></li>`).join('') || '<li><a>Brak menu</a></li>';
    } catch(e){
        console.error("Błąd wczytywania menu:",e);
        container.innerHTML='<li><a>Błąd wczytywania menu</a></li>';
    }
}

// --- Latarnia nadziei ---
export async function fetchLatarniaNadziei(container){
    try{
        const snap = await getDocs(query(collectionGroup(db,"entries"),orderBy("createdAt","desc")));
        const specialSections = ['Piciorys Chudego','Z punktu widzenia księżniczki','Pomoc','Galeria','Latarnia z Mroku'];
        const entries = snap.docs.map(d=>({id:d.id,...d.data(),section:d.ref.parent.parent.id})).filter(e=>!specialSections.includes(e.section));
        if(!entries.length){ container.innerHTML="<p style='text-align:center;'>Brak wpisów w Ostatniej Latarni Nadziei.</p>"; return; }
        container.innerHTML = entries.slice(0,3).map(e=>{
            const skrot = e.text.replace(/<[^>]*>?/gm,'').substring(0,300);
            const url = `wpis.html?section=${encodeURIComponent(e.section)}&id=${e.id}`;
            return `<article class="story-item">
                        <h3 class="fancy-title"><a href="${url}">${e.title||'Bez tytułu'}</a></h3>
                        <div class="entry-item-meta"><strong>W sekcji: ${e.section}</strong> • ${e.createdAt?e.createdAt.toDate().toLocaleDateString('pl-PL'):''}</div>
                        <div class="wpis-skrot"><p>${skrot}...</p></div>
                        <a href="${url}" class="speak-button" style="display: table; margin: 15px auto 0;">Czytaj dalej</a>
                    </article>`;
        }).join('');
    } catch(e){ console.error("Błąd wczytywania Latarnia:",e); container.innerHTML="<p style='text-align:center;'>Błąd ładowania.</p>"; }
}

// --- Sparks ---
export async function fetchSparks(textEl){
    try{
        const snap = await getDocs(query(collection(db,"sparks"),orderBy("createdAt","desc")));
        sparksFromDB = snap.docs.map(d=>d.data().quote);
        if(sparksFromDB.length>0) changeSpark(textEl);
        else textEl.innerText="Brak iskierek w bazie.";
    } catch(e){ console.error("Błąd wczytywania sparks:",e); textEl.innerText="Błąd ładowania"; }
}
export function changeSpark(textEl){
    if(!sparksFromDB.length) return;
    const newSpark = sparksFromDB[Math.floor(Math.random()*sparksFromDB.length)];
    textEl.style.opacity=0;
    setTimeout(()=>{ textEl.innerText=newSpark; textEl.style.opacity=1; },300);
}

// --- YouTube ---
export function initYTPlayer(){
    const tag = document.createElement('script');
    tag.src="https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = ()=>player = new YT.Player('youtube-player',{
        height:'0', width:'0', playerVars:{'playsinline':1,'origin':window.location.origin},
        events:{'onReady':onPlayerReady,'onStateChange':onPlayerStateChange}
    });
}
async function onPlayerReady(){
    const songTitle = document.getElementById("current-song-title");
    try{
        const snap = await getDocs(query(collection(db,"playlist"),orderBy("createdAt","asc")));
        playlist = snap.docs.map(d=>({title:d.data().title,videoId:getVideoId(d.data().link)})).filter(s=>s.videoId);
        if(playlist.length>0) loadCurrentSong(false);
        else if(songTitle) songTitle.innerText="Brak utworów w playliście.";
    } catch(e){ console.error("Błąd playlisty:",e); if(songTitle)songTitle.innerText="Błąd ładowania playlisty"; }
}
function getVideoId(url){ const m=url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }
function onPlayerStateChange(e){
    const btn=document.getElementById('play-pause-btn'); const icon=btn?btn.querySelector('i'):null;
    if(icon) icon.className=(e.data===YT.PlayerState.PLAYING)?'fas fa-pause':'fas fa-play';
    if(e.data===YT.PlayerState.ENDED) nextSong();
}
export function togglePlayPause(){ if(!player||!playlist.length) return; (player.getPlayerState()===YT.PlayerState.PLAYING)?player.pauseVideo():player.playVideo(); }
function loadCurrentSong(autoplay=true){ if(!playlist.length||!player) return; const s=playlist[currentIndex]; const sTitle=document.getElementById("current-song-title"); if(sTitle){ sTitle.style.opacity=0; setTimeout(()=>{ sTitle.innerText=s.title; sTitle.style.opacity=1; },300); } if(autoplay) player.loadVideoById(s.videoId); else player.cueVideoById(s.videoId); }
export function nextSong(){ if(!playlist.length) return; currentIndex=(currentIndex+1)%playlist.length; loadCurrentSong(true); }
export function prevSong(){ if(!playlist.length) return; currentIndex=(currentIndex-1+playlist.length)%playlist.length; loadCurrentSong(true); }

// --- DISQUS ---
export function initializeDisqus(){
    (function(){ var d=document,s=d.createElement('script'); s.src='https://od-dna-do-swiatla.disqus.com/embed.js'; s.setAttribute('data-timestamp',+new Date()); (d.head||d.body).appendChild(s); })();
}
