/**
 * BETA PLAYER v2.0 — app.js
 * Developer  : Surendhar S
 * Course     : B.E. Computer Science Engineering (CSE)
 * Batch      : 2025–2029
 * College    : Bannari Amman Institute of Technology, Erode, Tamil Nadu
 * Architecture: Server-side file storage + localStorage progress
 */

'use strict';

// ─── GLOBAL STATE ────────────────────────────────────────────────────────────
const BP = {
  v: { mode:'fit', dim:'off', rx:0, ry:0, rz:0, curv:1200,
       bright:100, contrast:100, sat:100, hue:0, speed:1, qual:'auto',
       frameStyle:'glow', shape:'', playing:false },
  a: { vol:1, muted:false, lastVol:1, mode:'normal',
       ctx:null, gain:null, analyser:null, src:null },
  s: { cues:[], file:'', enabled:true, offset:0, size:24,
       color:'#ffffff', bg:'#000000', opacity:0.85, font:'inter', fontCss:"'Inter',sans-serif" },
  c: { a:-1, b:-1, recorder:null, chunks:[] },
  loop: { state:0, a:-1, b:-1, active:false },
  media: { url:'', title:'', year:'', genre:'', poster:'', type:'video',
           size:0, filename:'', serverUrl:'', isServer:false },
  profile: { name:'', uid:'', bio:'', avatar:'', genre:'Action', registered:false, borderStyle:'circle', borderColor:'#06b6d4' },
  playlist: [],
  genreLists: {},
  libFilter: 'all',
  vizId: null,
  orbit: { dragging:false, sx:0, sy:0, active:false },
  hudTimer: null
};

const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);

// ─── BOOT SEQUENCE ───────────────────────────────────────────────────────────
const BOOT = [
  { d:0,    t:'> SYSTEM POWER ON...', c:'bl-dim' },
  { d:400,  t:'> INITIALIZING CODEC ENGINE v2.0...', c:'bl-dim' },
  { d:800,  t:'> CONNECTING TO LOCAL SERVER (localhost:3000)...', c:'bl-dim' },
  { d:1200, t:'> MOUNTING PLAYLIST FROM SERVER...', c:'bl-dim' },
  { d:1600, t:'> LOADING WEB AUDIO PROCESSOR...', c:'bl-dim' },
  { d:2000, t:'> COMPILING 3D/4D/5D ORBIT ENGINE...', c:'bl-dim' },
  { d:2500, t:'> RENDERING UI MODULES...', c:'bl-dim' },
  { d:3000, t:'> CHECKING RESUME SESSION...', c:'bl-dim' },
  { d:3500, t:'> ALL SYSTEMS NOMINAL', c:'bl-ok' },
  { d:4000, t:'▌ BETA PLAYER v2.0 READY', c:'bl-title' }
];

function runBoot() {
  const term = $('bootTerminal');
  BOOT.forEach(b => setTimeout(() => {
    const p = document.createElement('p');
    p.className = 'bl ' + b.c; p.textContent = b.t;
    term.appendChild(p); term.scrollTop = term.scrollHeight;
  }, b.d));
  setTimeout(() => { const bar = $('bootScanBar'); if(bar){bar.style.display='block';bar.classList.add('scanning');} }, 3800);
  setTimeout(() => { const t=$('bootMainTitle'); if(t) t.classList.add('glow-in'); }, 4100);
  setTimeout(() => dismissLoader(), 5200);
}

function dismissLoader() {
  const l = $('betaLoader'); if(!l) return;
  l.classList.add('loader-exit');
  setTimeout(() => { l.style.display='none'; }, 800);
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function checkNewUser() {
  try {
    const p = JSON.parse(localStorage.getItem('bp_profile') || 'null');
    if (p && p.name && p.registered) { BP.profile = p; applyProfileUI(); return false; }
  } catch {}
  return true;
}

function showOnboarding() { const o=$('onboardingOverlay'); if(o) o.classList.remove('hidden'); }

function submitOnboarding() {
  const name = ($('obName').value||'').trim();
  if (!name) { $('obError').textContent='Name is required!'; return; }
  BP.profile = {
    name, uid:'BP-'+Math.random().toString(36).substr(2,6).toUpperCase(),
    bio: ($('obBio').value||'').trim() || 'Beta Player user',
    genre: $('obGenre').value||'Action', registered:true, avatar:'',
    borderStyle:'circle', borderColor:'#06b6d4'
  };
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  applyProfileUI();
  $('onboardingOverlay').classList.add('hidden');
}

function applyProfileUI() {
  const p = BP.profile;
  if ($('avatarImg') && p.avatar)   $('avatarImg').src   = p.avatar;
  if ($('avPrev')   && p.avatar)   $('avPrev').src    = p.avatar;
  if ($('pName'))  $('pName').value  = p.name;
  if ($('pId'))    $('pId').value    = p.uid;
  if ($('pBio'))   $('pBio').value   = p.bio;
  if ($('pGenre')) $('pGenre').value = p.genre;
  if (p.borderStyle) setProfileBorder(p.borderStyle);
  if (p.borderColor) setProfileBorderColor(p.borderColor);
}

function saveProfile() {
  const name = ($('pName').value||'').trim() || BP.profile.name;
  BP.profile = { ...BP.profile, name, bio:($('pBio').value||'').trim(), genre:$('pGenre').value||BP.profile.genre };
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  applyProfileUI(); closeM('mProfile'); flash('PROFILE SAVED ✓');
}

function onAvatarChange(input) {
  const f = input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = e => {
    BP.profile.avatar = e.target.result;
    if($('avatarImg')) $('avatarImg').src = e.target.result;
    if($('avPrev'))    $('avPrev').src    = e.target.result;
  };
  r.readAsDataURL(f);
}

// ─── TIME FORMAT ─────────────────────────────────────────────────────────────
function fmt(s) {
  if (!isFinite(s)||s<0) return '0:00:00';
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtSize(b) {
  if (!b) return '—';
  if (b<1048576) return (b/1024).toFixed(1)+' KB';
  if (b<1073741824) return (b/1048576).toFixed(1)+' MB';
  return (b/1073741824).toFixed(2)+' GB';
}

// ─── SERVER API ──────────────────────────────────────────────────────────────
async function apiUpload(file) {
  const fd = new FormData();
  fd.append('media', file);

  // Show upload progress
  showUploadProgress();

  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded/e.total)*100);
        setUploadPct(pct);
      }
    };
    xhr.onload = () => {
      hideUploadProgress();
      if (xhr.status===200) res(JSON.parse(xhr.responseText));
      else rej(new Error('Upload failed: '+xhr.statusText));
    };
    xhr.onerror = () => { hideUploadProgress(); rej(new Error('Network error')); };
    xhr.open('POST', '/api/upload');
    xhr.send(fd);
  });
}

function showUploadProgress() { $('uploadProgress').classList.remove('hidden'); setUploadPct(0); }
function hideUploadProgress() { $('uploadProgress').classList.add('hidden'); }
function setUploadPct(pct) {
  $('upFill').style.width = pct+'%';
  $('upPct').textContent = pct+'%';
}

async function apiGetPlaylist() {
  try {
    const r = await fetch('/api/playlist');
    return await r.json();
  } catch { return []; }
}

async function apiSavePlaylist(pl) {
  try {
    await fetch('/api/playlist', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(pl)
    });
  } catch {}
}

// ─── MEDIA LOADING ───────────────────────────────────────────────────────────
function cleanTitle(raw) {
  return raw
    .replace(/(moviesda|isaimini|masstamilan|yts\.mx|yts|yify|filmyzilla|kuttymovies|hdhub4u|www\.[a-z0-9\-]+\.[a-z]{2,4})/gi,'')
    .replace(/\[.*?\]|\(.*?\)/g,' ')
    .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|3gp)$/i,'')
    .replace(/[.\-_]+/g,' ').replace(/\s+/g,' ').trim()
    .split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ') || 'Media File';
}

function guessMedia(name, mime) {
  const isAudio = mime ? mime.startsWith('audio/') : /\.(mp3|wav|flac|aac|m4a|ogg|opus|wma)$/i.test(name);
  const noExt = name.replace(/\.[^/.]+$/, '');
  const yrM = noExt.match(/(19\d{2}|20\d{2})/);
  const year = yrM ? yrM[1] : new Date().getFullYear().toString();
  const raw  = yrM ? noExt.substring(0, yrM.index) : noExt;
  const title = cleanTitle(raw);
  const txt = `${title} ${name}`.toLowerCase();
  let genre = 'Action';
  if (isAudio) genre='Soundtrack';
  else if (/comedy|funny|don|doctor/i.test(txt)) genre='Comedy';
  else if (/romance|love|heart|96/i.test(txt)) genre='Romance';
  else if (/scifi|space|alien|interstellar/i.test(txt)) genre='Sci-Fi';
  else if (/thriller|detective|crime/i.test(txt)) genre='Thriller';
  const poster = isAudio
    ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80'
    : 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80';
  return { isAudio, title, year, genre, poster };
}

// Load from server URL (for playlist items stored on server)
async function loadFromServer(item, seekTo=0, autoResume=false) {
  const v = $('mainVideo');
  v.pause();
  if (BP.media.url && BP.media.url.startsWith('blob:')) URL.revokeObjectURL(BP.media.url);

  BP.media = {
    url: item.serverUrl, title: item.title, year: item.year || new Date().getFullYear(),
    genre: item.genre||'Action', poster: item.poster||'', type: item.type||'video',
    size: item.size||0, filename: item.filename, serverUrl: item.serverUrl, isServer:true
  };

  v.src = item.serverUrl;
  v.load();

  $('dropzone').classList.add('hidden');
  v.style.display = 'block';
  $('clickOverlay').style.display = 'block';

  updateNowPlaying();
  updateInspector();
  initAudio();

  if (item.type==='audio') showMusicStudio(item.title, item.genre||'Music', item.poster||'');
  else { $('musicStudio').classList.add('hidden'); stopViz(); }

  const tryPlay = () => {
    if (BP.a.ctx && BP.a.ctx.state==='suspended') BP.a.ctx.resume();
    v.play().then(() => {
      BP.v.playing = true;
      setPlayIcon(false);
      if (seekTo>0) setTimeout(() => { v.currentTime = seekTo; }, 150);
      if (autoResume) showHUD('▶', fmt(seekTo));
    }).catch(e => { console.warn('Autoplay blocked:', e); setPlayIcon(true); });
  };

  if (v.readyState >= 2) tryPlay();
  else v.addEventListener('canplay', tryPlay, { once:true });
}

// Load from local File object (new upload before server saves)
async function loadFromFile(file, seekTo=0, autoResume=false) {
  // First upload to server
  let serverInfo = null;
  try {
    serverInfo = await apiUpload(file);
  } catch(e) {
    console.warn('Server upload failed, using blob URL:', e);
  }

  const info = guessMedia(file.name, file.type);
  const v = $('mainVideo');
  v.pause();
  if (BP.media.url && BP.media.url.startsWith('blob:')) URL.revokeObjectURL(BP.media.url);

  const url = serverInfo ? serverInfo.url : URL.createObjectURL(file);
  BP.media = {
    url, title: info.title, year: info.year, genre: info.genre,
    poster: info.poster, type: info.isAudio ? 'audio' : 'video',
    size: file.size, filename: file.name,
    serverUrl: serverInfo ? serverInfo.url : '', isServer: !!serverInfo
  };

  v.src = url;
  v.load();

  $('dropzone').classList.add('hidden');
  v.style.display = 'block';
  $('clickOverlay').style.display = 'block';

  updateNowPlaying();
  updateInspector();
  initAudio();

  if (info.isAudio) showMusicStudio(info.title, info.genre, info.poster);
  else { $('musicStudio').classList.add('hidden'); stopViz(); }

  // Add to playlist
  const item = {
    id: Date.now(), title: info.title, year: info.year, genre: info.genre,
    poster: info.poster, type: info.isAudio ? 'audio' : 'video',
    size: file.size, filename: file.name,
    serverUrl: serverInfo ? serverInfo.url : ''
  };
  addToPlaylist(item);

  const tryPlay = () => {
    if (BP.a.ctx && BP.a.ctx.state==='suspended') BP.a.ctx.resume();
    v.play().then(() => {
      BP.v.playing = true;
      setPlayIcon(false);
      if (seekTo>0) setTimeout(() => { v.currentTime = seekTo; }, 150);
      if (autoResume) showHUD('▶', fmt(seekTo));
    }).catch(e => { console.warn('Autoplay blocked:', e); setPlayIcon(true); });
  };
  if (v.readyState>=2) tryPlay();
  else v.addEventListener('canplay', tryPlay, { once:true });
}

// File selected from input
async function onFileSelected(input) {
  const f = input.files[0]; if(!f) return;
  await loadFromFile(f);
  input.value = '';
}

// ─── AUTO-RESUME (fixed for autoplay policy) ─────────────────────────────────
async function checkResume() {
  try {
    const raw = localStorage.getItem('bp_session');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || s.time < 2 || !s.serverUrl) return;
    const item = { serverUrl: s.serverUrl, title: s.title||'Media', year: s.year||'',
      genre: s.genre||'Action', poster: s.poster||'', type: s.type||'video',
      size: s.size||0, filename: s.filename||'' };
    // Load video src without autoplay (browser policy)
    const v = $('mainVideo');
    BP.media = { url: s.serverUrl, title: s.title||'Media', year: s.year||'', genre: s.genre||'Action', poster: s.poster||'', type: s.type||'video', size: s.size||0, filename: s.filename||'', serverUrl: s.serverUrl, isServer: true };
    v.src = s.serverUrl; v.load();
    $('dropzone').classList.add('hidden');
    v.style.display='block'; $('clickOverlay').style.display='block';
    updateNowPlaying(); updateInspector();
    // Set time on loadedmetadata
    v.addEventListener('loadedmetadata', () => { v.currentTime = s.time; }, { once: true });
    // Try autoplay, fallback to show resume button
    v.addEventListener('canplay', () => {
      v.play().then(()=>{ BP.v.playing=true; setPlayIcon(false); showHUD('▶','RESUMED'); })
      .catch(()=>{ setPlayIcon(true); showResumeBtn(s.time, s.title||'Media'); });
    }, { once: true });
  } catch(e) { console.warn('Resume failed:', e); }
}

function showResumeBtn(time, title) {
  const rb=$('resumeBtn'); if(!rb) return;
  rb.classList.remove('hidden');
  const ri=rb.querySelector('#resumeInfo');
  if(ri) ri.textContent = '▶ Resume "'+title+'" at '+fmt(time);
  rb.onclick = () => { rb.classList.add('hidden'); const v=$('mainVideo'); v.currentTime=time; v.play().then(()=>{BP.v.playing=true;setPlayIcon(false);showHUD('▶','RESUMED');}); };
}

function saveProgress() {
  const v = $('mainVideo');
  if (!v||!BP.media.serverUrl||v.currentTime<2) return;
  localStorage.setItem('bp_session', JSON.stringify({
    serverUrl: BP.media.serverUrl,
    title: BP.media.title, year: BP.media.year,
    genre: BP.media.genre, poster: BP.media.poster,
    type: BP.media.type, size: BP.media.size,
    filename: BP.media.filename,
    time: v.currentTime, duration: v.duration||0,
    ts: Date.now()
  }));
}

// ─── PLAYLIST ─────────────────────────────────────────────────────────────────
function addToPlaylist(item) {
  const idx = BP.playlist.findIndex(p => p.filename === item.filename);
  if (idx>=0) BP.playlist[idx] = { ...BP.playlist[idx], ...item };
  else BP.playlist.unshift(item);
  persistPlaylist();
  renderPlaylist();
  renderLibrary();
}

async function persistPlaylist() {
  await apiSavePlaylist(BP.playlist);
  updateBkCount();
}

async function loadPlaylistFromServer() {
  BP.playlist = await apiGetPlaylist();
  renderPlaylist();
  renderLibrary();
  updateBkCount();
}

function updateBkCount() {
  if ($('bkCount')) $('bkCount').textContent = BP.playlist.length;
  if ($('ppCount')) $('ppCount').textContent = BP.playlist.length+' items';
  const nc = $('navCount');
  if (nc) {
    nc.textContent = BP.playlist.length;
    nc.style.display = BP.playlist.length > 0 ? 'flex' : 'none';
  }
}

function renderPlaylist(filter='') {
  const list = $('ppList'); if(!list) return;
  const items = BP.playlist.filter(i =>
    !filter || i.title.toLowerCase().includes(filter.toLowerCase())
  );
  if (!items.length) {
    list.innerHTML = '<div class="pp-empty">No movies yet.<br>Upload a file to get started!<br>Files are saved on the server.</div>';
    updateBkCount(); return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'pp-item' + (item.serverUrl===BP.media.serverUrl?' playing':'');
    div.innerHTML = `
      <img class="pp-thumb" src="${item.poster||'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100&q=60'}" alt="${item.title}" loading="lazy">
      <div class="pp-info">
        <div class="pp-name">${item.title}</div>
        <div class="pp-meta">${item.year||''} · ${item.type==='audio'?'Music':'Movie'}</div>
        <div class="pp-type">${item.genre||'Action'}</div>
      </div>
      <span class="pp-del" onclick="event.stopPropagation();removeFromPlaylist(${item.id})">🗑</span>`;
    div.onclick = () => { if(item.serverUrl) loadFromServer(item); else flash('⚠ File not on server—re-upload'); };
    list.appendChild(div);
  });
  updateBkCount();
}

function filterPlaylist(q) { renderPlaylist(q); }

function renderLibrary() {
  const grid = $('libraryGrid'); if(!grid) return;
  if (!BP.playlist.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">Upload a movie to see it here!</div>';
    return;
  }
  grid.innerHTML = '';
  BP.playlist.forEach(item => {
    const c = document.createElement('div');
    c.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all .18s;background:var(--bg3)';
    c.innerHTML = `
      <img src="${item.poster||''}" style="width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:var(--bg3)" loading="lazy">
      <div style="padding:8px">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:2px">${item.year||''} · ${item.genre||''}</div>
      </div>`;
    c.onmouseover = () => { c.style.borderColor='var(--ac)'; c.style.transform='scale(1.02)'; };
    c.onmouseout  = () => { c.style.borderColor='var(--border)'; c.style.transform=''; };
    c.onclick = () => { if(item.serverUrl) { loadFromServer(item); closeM('mLibrary'); } else flash('⚠ Re-upload file'); };
    grid.appendChild(c);
  });
}

function removeFromPlaylist(id) {
  if (!confirm('Remove from playlist?')) return;
  BP.playlist = BP.playlist.filter(p => p.id !== id);
  persistPlaylist(); renderPlaylist(); renderLibrary();
}

function clearPlaylist() {
  if (!confirm('Clear entire playlist?')) return;
  BP.playlist = [];
  persistPlaylist(); renderPlaylist(); renderLibrary();
  flash('🗑 PLAYLIST CLEARED');
}

function clearProgress() {
  localStorage.removeItem('bp_session');
  flash('🗑 RESUME CLEARED');
}

// ─── NOW PLAYING / INSPECTOR ─────────────────────────────────────────────────
function updateNowPlaying() {
  const pill = $('nowPlayingPill');
  if ($('npTitle')) $('npTitle').textContent = BP.media.title;
  if ($('npBadge')) $('npBadge').textContent = BP.media.type==='audio'?'🎵':'🎬';
  if (pill) pill.classList.remove('hidden');
}

function updateInspector() {
  const v = $('mainVideo');
  if ($('inspPoster')) $('inspPoster').src = BP.media.poster;
  if ($('inspTitle'))  $('inspTitle').textContent  = BP.media.title;
  if ($('inspYear'))   $('inspYear').textContent   = '('+BP.media.year+')';
  if ($('inspGenre'))  $('inspGenre').textContent  = BP.media.genre;
  if ($('inspPlot'))   $('inspPlot').textContent   = `"${BP.media.title}" (${BP.media.year}) · ${BP.media.genre}. Local playback via Beta Player.`;
  if ($('inspType'))   $('inspType').textContent   = BP.media.type==='audio'?'Music Track':'Cinema Video';
  if ($('inspFile'))   $('inspFile').textContent   = BP.media.filename;
  if ($('inspSize'))   $('inspSize').textContent   = fmtSize(BP.media.size);
  if ($('inspStore'))  $('inspStore').textContent  = BP.media.isServer?'Server (uploads/ folder)':'Blob URL (local)';
  v.addEventListener('loadedmetadata', () => {
    if ($('inspRes')) $('inspRes').textContent = v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : 'Audio Only';
    if ($('inspDur')) $('inspDur').textContent = fmt(v.duration);
    const kbps = BP.media.size>0&&v.duration>0 ? Math.round((BP.media.size*8)/v.duration/1000) : 0;
    if ($('inspBit')) $('inspBit').textContent = kbps>0?`~${kbps} kbps`:'N/A';
  }, { once:true });
}

// ─── AUDIO ENGINE ────────────────────────────────────────────────────────────
function initAudio() {
  if (BP.a.ctx) return;
  try {
    const AC = window.AudioContext||window.webkitAudioContext;
    BP.a.ctx = new AC();
    BP.a.gain = BP.a.ctx.createGain(); BP.a.gain.gain.value = BP.a.vol;
    BP.a.analyser = BP.a.ctx.createAnalyser(); BP.a.analyser.fftSize = 256;
    const v = $('mainVideo');
    BP.a.src = BP.a.ctx.createMediaElementSource(v);
    BP.a.src.connect(BP.a.gain);
    BP.a.gain.connect(BP.a.analyser);
    BP.a.analyser.connect(BP.a.ctx.destination);
  } catch(e) { console.warn('Audio ctx:', e); }
}

function setVol(val) {
  val = Math.max(0, Math.min(10, val));
  BP.a.vol = val;
  const v = $('mainVideo');
  if (v) v.volume = Math.min(1, val);
  if (BP.a.gain && BP.a.ctx) BP.a.gain.gain.setValueAtTime(val, BP.a.ctx.currentTime);
  const pct = Math.round(val*100);
  if ($('volSlider'))   $('volSlider').value   = val;
  if ($('volBigSlider')) $('volBigSlider').value = val;
  if ($('volPct'))      $('volPct').textContent = pct+'%';
  if ($('volBig'))      $('volBig').textContent = pct+'%';
  if ($('muteIcon'))    $('muteIcon').textContent = val===0?'🔇':'🔊';
  updateTogglesBar();
}

function toggleMute() {
  if (BP.a.vol>0) { BP.a.lastVol=BP.a.vol; setVol(0); showHUD('🔇','MUTED'); }
  else { setVol(BP.a.lastVol||1); showHUD('🔊',Math.round((BP.a.lastVol||1)*100)+'%'); }
}

function setAudioMode(mode) {
  BP.a.mode = mode;
  flash(mode==='headphones'?'🎧 HEADPHONES MODE':'🔈 NORMAL MODE');
  if ($('modeBadge')) $('modeBadge').textContent = mode==='headphones'?'🎧 Headphones':'🔈 Normal';
  [$('btnNormal'),$('btnHeadphones')].forEach(b => { if(b) b.classList.toggle('on', b.id==='btnHeadphones'?mode==='headphones':mode==='normal'); });
  updateTogglesBar();
}

function toggleAudioMode() { setAudioMode(BP.a.mode==='normal'?'headphones':'normal'); }

// ─── PLAY / PAUSE / STOP ─────────────────────────────────────────────────────
function togglePlay() {
  if (BP.a.ctx && BP.a.ctx.state==='suspended') BP.a.ctx.resume();
  const v = $('mainVideo');
  if (!v.src) return;
  if (v.paused) {
    v.play().then(() => { BP.v.playing=true; setPlayIcon(false); showHUD('▶','PLAYING'); }).catch(()=>{});
    if ($('vinylDisc')) $('vinylDisc').classList.remove('paused');
  } else {
    v.pause(); BP.v.playing=false; setPlayIcon(true); showHUD('⏸','PAUSED');
    if ($('vinylDisc')) $('vinylDisc').classList.add('paused');
  }
}

function setPlayIcon(paused) {
  if ($('playIcon')) $('playIcon').textContent = paused?'▶':'⏸';
}

function stopPlayback() {
  const v = $('mainVideo');
  v.pause(); v.currentTime=0; BP.v.playing=false;
  setPlayIcon(true); showHUD('⏹','STOPPED');
  localStorage.removeItem('bp_session');
}

function onVideoPlay()  { BP.v.playing=true;  setPlayIcon(false); }
function onVideoPause() { BP.v.playing=false; setPlayIcon(true);  }
function onVideoEnded() { BP.v.playing=false; setPlayIcon(true); showHUD('⏹','ENDED'); BP.loop.state=0; BP.loop.active=false; }
function onVideoError() { flash('⚠ VIDEO LOAD ERROR'); setPlayIcon(true); }

// ─── CENTER HUD ───────────────────────────────────────────────────────────────
function showHUD(icon, label, persist=false) {
  const hud = $('centerHUD'); if(!hud) return;
  if ($('hudIcon'))  $('hudIcon').textContent  = icon;
  if ($('hudLabel')) $('hudLabel').textContent = label;
  hud.classList.remove('hidden','fade');
  clearTimeout(BP.hudTimer);
  if (!persist) BP.hudTimer = setTimeout(() => hud.classList.add('fade'), 1400);
}

function flash(text) {
  const p = $('flashPip'); if(!p) return;
  $('flashTxt').textContent = text;
  p.classList.remove('hidden','fade');
  clearTimeout(p._t);
  p._t = setTimeout(() => p.classList.add('fade'), 900);
}

// ─── SCRUBBER ────────────────────────────────────────────────────────────────
function setupScrubber() {
  const tr = $('scrubTrack'); if(!tr) return;
  let drag = false;
  const seek = e => {
    const r = tr.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX-r.left)/r.width));
    const v = $('mainVideo'); if(v.duration) v.currentTime = pos*v.duration;
  };
  tr.addEventListener('mousedown',  e => { drag=true; seek(e); });
  tr.addEventListener('mousemove',  e => {
    if (drag) seek(e);
    const r = tr.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX-r.left)/r.width));
    const hv = $('scrubHover');
    if (hv) { hv.textContent = fmt(pos*($('mainVideo').duration||0)); hv.style.left=(e.clientX-r.left)+'px'; hv.style.display='block'; }
  });
  window.addEventListener('mousemove', e => { if(drag) seek(e); });
  window.addEventListener('mouseup',   () => { drag=false; });
  tr.addEventListener('touchstart', e => { e.preventDefault(); drag=true; seek(e.touches[0]); }, {passive:false});
  tr.addEventListener('touchmove',  e => { e.preventDefault(); if(drag) seek(e.touches[0]); }, {passive:false});
  window.addEventListener('touchend', () => { drag=false; });
}

function onScrubClick(e) {
  const tr = $('scrubTrack'); if(!tr) return;
  const r = tr.getBoundingClientRect();
  const pos = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  const v=$('mainVideo'); if(v.duration) v.currentTime=pos*v.duration;
}

function onScrubHover(e) {
  const tr=$('scrubTrack'),hv=$('scrubHover'); if(!tr||!hv) return;
  const r=tr.getBoundingClientRect();
  const pos=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  hv.textContent=fmt(pos*($('mainVideo').duration||0));
  hv.style.left=(e.clientX-r.left)+'px'; hv.style.display='block';
}

function onTimeUpdate() {
  const v=$('mainVideo'); if(!v) return;
  const cur=v.currentTime||0, dur=v.duration||0;
  if ($('scrubTime'))   $('scrubTime').textContent   = fmt(cur);
  if ($('scrubRemain')) $('scrubRemain').textContent = dur>0?'-'+fmt(dur-cur):'-0:00:00';
  if (dur>0) {
    const pct=(cur/dur)*100;
    if ($('scrubFill'))  $('scrubFill').style.width  = pct+'%';
    if ($('scrubThumb')) $('scrubThumb').style.left  = pct+'%';
    if (v.buffered&&v.buffered.length>0) {
      if ($('scrubBuf')) $('scrubBuf').style.width = ((v.buffered.end(v.buffered.length-1)/dur)*100)+'%';
    }
  }
  renderSubs();
  checkLoopAB();
  saveProgress();
}

// ─── SEEK / FRAME ────────────────────────────────────────────────────────────
function seekBy(s) {
  const v=$('mainVideo');
  v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+s));
  showHUD(s>0?'⏩':'⏪',(s>0?'+':'')+s+'s');
}

function stepFrame(dir) {
  const v=$('mainVideo'); v.pause(); v.currentTime+=dir*(1/30);
  setPlayIcon(true); showHUD(dir>0?'▶|':'|◀','FRAME');
}

function takeSnapshot() {
  const v=$('mainVideo');
  if (!v.src) { flash('⚠ NO VIDEO'); return; }
  const c=document.createElement('canvas');
  c.width=v.videoWidth||1280; c.height=v.videoHeight||720;
  c.getContext('2d').drawImage(v,0,0);
  const a=document.createElement('a');
  a.href=c.toDataURL('image/png'); a.download=`BetaPlayer_${Date.now()}.png`; a.click();
  flash('📸 SAVED!');
}

// ─── SPEED ───────────────────────────────────────────────────────────────────
function setSpd(val) {
  BP.v.speed = val;
  const v=$('mainVideo'); if(v) v.playbackRate=val;
  showHUD('⚡',val+'x SPEED');
  if ($('speedBadge')) $('speedBadge').textContent=val+'x Speed';
  $$('[data-spd]').forEach(b=>b.classList.toggle('on',+b.dataset.spd===val));
  localStorage.setItem('bp_speed', val);
}

// ─── QUALITY ─────────────────────────────────────────────────────────────────
function setQual(q) {
  BP.v.qual=q;
  const qf={'720p':'blur(0.3px)','480p':'blur(0.6px) contrast(1.05)','360p':'blur(1px)','240p':'blur(2px)'};
  applyFilters(qf[q]||'');
  if ($('qualBadge')) $('qualBadge').textContent=q;
  $$('[data-qual]').forEach(b=>b.classList.toggle('on',b.dataset.qual===q));
  flash('📺 Quality: '+q.toUpperCase());
}

// ─── VIDEO FILTERS ───────────────────────────────────────────────────────────
function applyFilters(extraFilter='') {
  const v=$('mainVideo'); if(!v) return;
  v.style.filter = `${extraFilter} brightness(${BP.v.bright}%) contrast(${BP.v.contrast}%) saturate(${BP.v.sat}%) hue-rotate(${BP.v.hue}deg)`.trim();
}

// ─── SCREEN MODES ────────────────────────────────────────────────────────────
function setMode(mode) {
  BP.v.mode=mode;
  const v=$('mainVideo');
  if (!v) return;
  if (mode==='mirror') { v.style.transform=v.style.transform.includes('scaleX(-1)')?'':'scaleX(-1)'; flash('🪞 MIRROR'); return; }
  const modeStyles = {
    'fit':    { width:'100%',height:'100%',objectFit:'contain',aspectRatio:'' },
    'theater':{ width:'100%',height:'100%',objectFit:'cover',aspectRatio:'' },
    'fill':   { width:'100%',height:'100%',objectFit:'cover',aspectRatio:'' },
    '21:9':   { width:'100%',height:'auto',objectFit:'contain',aspectRatio:'21/9' },
    'imax':   { width:'auto',height:'100%',objectFit:'contain',aspectRatio:'1.43/1' },
    '9:16':   { width:'auto',height:'100%',objectFit:'contain',aspectRatio:'9/16' },
    '1:1':    { width:'auto',height:'100%',objectFit:'contain',aspectRatio:'1/1' },
    '32:9':   { width:'100%',height:'auto',objectFit:'contain',aspectRatio:'32/9' },
    '4:3':    { width:'auto',height:'100%',objectFit:'contain',aspectRatio:'4/3' },
  };
  if (modeStyles[mode]) {
    const s=modeStyles[mode];
    v.style.width=s.width; v.style.height=s.height;
    v.style.objectFit=s.objectFit; v.style.aspectRatio=s.aspectRatio;
  }
  flash('📐 '+mode.toUpperCase());
}

function setCustomRatio() {
  const w=+$('cwW').value||16, h=+$('cwH').value||9;
  const v=$('mainVideo'); if(!v) return;
  v.style.aspectRatio=`${w}/${h}`;
  flash(`📐 ${w}:${h}`);
}

function toggleFullscreen() {
  if (!document.fullscreenElement)
    ($('videoWrap')||document.documentElement).requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
}

function togglePiP() {
  const v=$('mainVideo'); if(!v) return;
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(()=>{});
  else v.requestPictureInPicture().catch(()=>{});
}

// ─── 3D ORBIT ────────────────────────────────────────────────────────────────
function setDim(mode) {
  BP.v.dim=mode;
  BP.orbit.active = ['3d','4d','5d'].includes(mode);
  if ($('orbitHUD')) $('orbitHUD').classList.toggle('hidden', !BP.orbit.active);
  applyOrbit();
  flash(mode==='off'?'📺 2D':'👓 '+mode.toUpperCase());
  updateTogglesBar();
}

function applyOrbit() {
  const v=$('mainVideo'); if(!v) return;
  if (BP.v.dim==='off') { v.style.transform=''; return; }
  v.style.transform=`perspective(${BP.v.curv}px) rotateX(${BP.v.rx}deg) rotateY(${BP.v.ry}deg) rotateZ(${BP.v.rz}deg)`;
  if ($('oPitch')) $('oPitch').textContent=Math.round(BP.v.rx);
  if ($('oYaw'))   $('oYaw').textContent=Math.round(BP.v.ry);
  if ($('oRoll'))  $('oRoll').textContent=Math.round(BP.v.rz);
}

function reset3D() {
  BP.v.rx=0; BP.v.ry=0; BP.v.rz=0;
  ['slPitch','slYaw','slRoll'].forEach(id=>{const el=$(id);if(el)el.value=0;});
  ['sPitch','sYaw','sRoll'].forEach(id=>{const el=$(id);if(el)el.textContent='0°';});
  applyOrbit(); flash('🔄 3D RESET');
}

function setupOrbit() {
  const wrap = $('videoWrap'); if(!wrap) return;
  wrap.addEventListener('mousedown', e => {
    if (!BP.orbit.active||e.button!==0) return;
    BP.orbit.dragging=true; BP.orbit.sx=e.clientX; BP.orbit.sy=e.clientY;
    wrap.style.cursor='grabbing'; e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!BP.orbit.dragging||!BP.orbit.active) return;
    const dx=(e.clientX-BP.orbit.sx)*0.3, dy=(e.clientY-BP.orbit.sy)*0.3;
    BP.v.ry=Math.max(-60,Math.min(60,BP.v.ry+dx));
    BP.v.rx=Math.max(-60,Math.min(60,BP.v.rx+dy));
    BP.orbit.sx=e.clientX; BP.orbit.sy=e.clientY;
    applyOrbit();
  });
  window.addEventListener('mouseup', () => { BP.orbit.dragging=false; wrap.style.cursor=''; });
}

// ─── LOOP A-B ─────────────────────────────────────────────────────────────────
function cycleLoop() {
  const v=$('mainVideo'), lbl=$('loopLbl');
  if (BP.loop.state===0) {
    BP.loop.a=v.currentTime; BP.loop.state=1;
    if (lbl) lbl.textContent='B?'; flash('🔁 A='+fmt(BP.loop.a));
    if ($('btnLoop')) $('btnLoop').classList.add('active');
  } else if (BP.loop.state===1) {
    BP.loop.b=v.currentTime;
    if (BP.loop.b<=BP.loop.a) { BP.loop.state=0; if(lbl)lbl.textContent='A-B'; return; }
    BP.loop.active=true; BP.loop.state=2;
    if (lbl) lbl.textContent='ON'; flash('🔁 LOOP ON');
  } else {
    BP.loop.active=false; BP.loop.a=-1; BP.loop.b=-1; BP.loop.state=0;
    if (lbl) lbl.textContent='A-B'; if ($('btnLoop')) $('btnLoop').classList.remove('active');
    flash('🔁 LOOP OFF');
  }
  updateTogglesBar();
}

function checkLoopAB() {
  if (!BP.loop.active||BP.loop.a<0||BP.loop.b<0) return;
  const v=$('mainVideo');
  if (v.currentTime>=BP.loop.b) v.currentTime=BP.loop.a;
}

// ─── CLIP DOWNLOADER ─────────────────────────────────────────────────────────
function setClipA() {
  BP.c.a=$('mainVideo').currentTime;
  if ($('clipA')) $('clipA').textContent=fmt(BP.c.a);
  flash('🎬 START: '+fmt(BP.c.a)); updateClipUI();
}
function setClipB() {
  BP.c.b=$('mainVideo').currentTime;
  if ($('clipB')) $('clipB').textContent=fmt(BP.c.b);
  flash('🏁 END: '+fmt(BP.c.b)); updateClipUI();
}
function updateClipUI() {
  if (BP.c.a>=0&&BP.c.b>BP.c.a) {
    if ($('clipDur')) $('clipDur').textContent=fmt(BP.c.b-BP.c.a);
    if ($('btnDownClip')) $('btnDownClip').disabled=false;
  }
}
function clearClip() {
  BP.c.a=-1; BP.c.b=-1;
  if ($('clipA')) $('clipA').textContent='—';
  if ($('clipB')) $('clipB').textContent='—';
  if ($('clipDur')) $('clipDur').textContent='—';
  if ($('btnDownClip')) $('btnDownClip').disabled=true;
}
async function downloadClip() {
  if (BP.c.a<0||BP.c.b<=BP.c.a) { flash('⚠ SET A & B FIRST'); return; }
  const v=$('mainVideo'); if(!v.src) { flash('⚠ NO VIDEO'); return; }
  const btn=$('btnDownClip'); if(btn){btn.textContent='🔴 RECORDING...';btn.disabled=true;}
  BP.c.chunks=[];
  const stream=v.captureStream?v.captureStream():v.mozCaptureStream();
  BP.c.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'});
  BP.c.recorder.ondataavailable=e=>{if(e.data.size>0)BP.c.chunks.push(e.data);};
  BP.c.recorder.onstop=()=>{
    const blob=new Blob(BP.c.chunks,{type:'video/webm'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${BP.media.title}_Clip.webm`; a.click();
    URL.revokeObjectURL(a.href);
    if(btn){btn.textContent='⬇ Download Clip';btn.disabled=false;}
    flash('💾 CLIP SAVED!');
  };
  v.currentTime=BP.c.a;
  await new Promise(r=>setTimeout(r,200));
  v.play(); BP.c.recorder.start();
  setTimeout(()=>{BP.c.recorder.stop();v.pause();},(BP.c.b-BP.c.a)*1000);
}

// ─── SUBTITLES ───────────────────────────────────────────────────────────────
function parseSRT(txt) {
  const cues=[]; const re=/\d+\s*\n(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n([\s\S]*?)(?=\n\s*\n|\n*$)/g;
  const toSec=s=>{const p=s.replace(',','.').split(':');return +p[0]*3600+ +p[1]*60+ +p[2];};
  let m;
  while((m=re.exec(txt))!==null) cues.push({start:toSec(m[1]),end:toSec(m[2]),text:m[3].replace(/<[^>]*>/g,'').trim()});
  return cues;
}

function loadSubFile(input) {
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    BP.s.cues=parseSRT(e.target.result); BP.s.file=f.name;
    if($('subFileInfo')) $('subFileInfo').textContent='Loaded: '+f.name;
    if($('sqpCurrent'))  $('sqpCurrent').textContent=f.name;
    if($('ccDot'))       $('ccDot').classList.remove('hidden');
    flash('💬 SUBS: '+f.name);
    updateTogglesBar();
  };
  r.readAsText(f); input.value='';
}

function clearSubs() {
  BP.s.cues=[]; BP.s.file='';
  if($('subFileInfo')) $('subFileInfo').textContent='No subtitle file loaded';
  if($('sqpCurrent'))  $('sqpCurrent').textContent='None loaded';
  if($('ccDot'))       $('ccDot').classList.add('hidden');
  if($('subOverlay'))  $('subOverlay').classList.add('hidden');
  flash('💬 SUBS CLEARED');
  updateTogglesBar();
}

function toggleSubs() {
  BP.s.enabled=!BP.s.enabled;
  flash(BP.s.enabled?'💬 SUBS ON':'💬 SUBS OFF');
  updateTogglesBar();
}

function renderSubs() {
  const v=$('mainVideo'), overlay=$('subOverlay'), box=$('subBox');
  if (!BP.s.enabled||!BP.s.cues.length) { if(overlay) overlay.classList.add('hidden'); return; }
  const t=v.currentTime+BP.s.offset;
  const cue=BP.s.cues.find(c=>t>=c.start&&t<=c.end);
  if (cue&&overlay&&box) { box.textContent=cue.text; overlay.classList.remove('hidden'); }
  else if (overlay) overlay.classList.add('hidden');
}

function applySubStyle() {
  [$('subBox'),$('subPreview')].forEach(el=>{
    if(!el) return;
    el.style.fontFamily = BP.s.fontCss || BP.s.font || 'Inter,sans-serif';
    el.style.fontSize = BP.s.size+'px';
    el.style.color = BP.s.color;
    el.style.backgroundColor = BP.s.bg && BP.s.bg!=='rgba(0,0,0,0)' ? `color-mix(in srgb, ${BP.s.bg} ${Math.round(BP.s.opacity*100)}%, transparent)` : 'transparent';
  });
}

// Subtitle quick panel (at bottom of video)
function toggleSubPanel() {
  const p=$('subQuickPanel'); if(p) p.classList.toggle('hidden');
}
function hideSubPanel() {
  const p=$('subQuickPanel'); if(p) p.classList.add('hidden');
}

// ─── VISUALIZER ──────────────────────────────────────────────────────────────
function showMusicStudio(title, artist, poster) {
  const ms=$('musicStudio'); if(!ms) return;
  ms.classList.remove('hidden');
  if($('trackTitle'))  $('trackTitle').textContent  = title;
  if($('trackArtist')) $('trackArtist').textContent = artist+' · Beta Player';
  if($('vinylCover'))  $('vinylCover').src          = poster;
  startViz();
}

function startViz() {
  stopViz();
  const canvas=$('specCanvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const len=BP.a.analyser?BP.a.analyser.frequencyBinCount:32;
  const data=new Uint8Array(len);
  function draw() {
    BP.vizId=requestAnimationFrame(draw);
    if(BP.a.analyser) BP.a.analyser.getByteFrequencyData(data);
    else for(let i=0;i<len;i++) data[i]=30+Math.sin(Date.now()/300+i)*20;
    ctx.fillStyle='rgba(8,9,15,.2)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const bw=(canvas.width/len)*1.5;
    for(let i=0;i<len;i++) {
      const h=(data[i]/255)*(canvas.height*.7);
      const gr=ctx.createLinearGradient(0,canvas.height,0,canvas.height-h);
      gr.addColorStop(0,'var(--ac)'); gr.addColorStop(1,'var(--ac2)');
      ctx.fillStyle=gr;
      ctx.fillRect(i*bw,canvas.height-h,bw-2,h);
    }
  }
  draw();
}
function stopViz() { if(BP.vizId){cancelAnimationFrame(BP.vizId);BP.vizId=null;} }

// ─── APPEARANCE ───────────────────────────────────────────────────────────────
function applyTheme(ac, ac2, bg) {
  document.documentElement.style.setProperty('--ac', ac);
  document.documentElement.style.setProperty('--ac2', ac2);
  document.documentElement.style.setProperty('--ac-glow', hexToRgba(ac, 0.3));
  document.documentElement.style.setProperty('--ac-bg', hexToRgba(ac, 0.08));
  document.documentElement.style.setProperty('--bg', bg);
  // Also update frame color to match
  document.documentElement.style.setProperty('--frame-color', ac);
  saveAppearance();
  flash('🎨 THEME APPLIED');
}

function setAccentColor(hex) {
  document.documentElement.style.setProperty('--ac', hex);
  document.documentElement.style.setProperty('--ac-glow', hexToRgba(hex, 0.3));
  document.documentElement.style.setProperty('--ac-bg', hexToRgba(hex, 0.08));
  if ($('accentPreview')) $('accentPreview').style.background = hex;
  if ($('accentHex'))     $('accentHex').textContent = hex;
  if ($('accentPicker'))  $('accentPicker').value = hex;
  saveAppearance(); flash('🎨 ACCENT: '+hex);
}

function setAccent2Color(hex) {
  document.documentElement.style.setProperty('--ac2', hex);
  if ($('accent2Preview')) $('accent2Preview').style.background = hex;
  if ($('accent2Hex'))     $('accent2Hex').textContent = hex;
  if ($('accent2Picker'))  $('accent2Picker').value = hex;
  saveAppearance();
}

function setFrameColor(hex) {
  document.documentElement.style.setProperty('--frame-color', hex);
  if ($('frameColorPreview')) $('frameColorPreview').style.background = hex;
  if ($('frameColorHex'))     $('frameColorHex').textContent = hex;
  if ($('frameColorPicker'))  $('frameColorPicker').value = hex;
  applyFrameStyle(BP.v.frameStyle);
  saveAppearance();
}

function setFrameStyle(style) {
  BP.v.frameStyle = style; applyFrameStyle(style); saveAppearance();
}

function applyFrameStyle(style) {
  const v=$('mainVideo'); if(!v) return;
  v.classList.remove('has-frame');
  const fc = getComputedStyle(document.documentElement).getPropertyValue('--frame-color').trim() || '#06b6d4';
  const styles = {
    'glow':   `0 0 0 2px ${fc}, 0 0 24px color-mix(in srgb, ${fc} 40%, transparent)`,
    'solid':  `0 0 0 2px ${fc}`,
    'dashed': 'none',
    'double': `0 0 0 2px ${fc}, 0 0 0 5px transparent, 0 0 0 7px ${fc}`,
    'thick':  `0 0 0 5px ${fc}`,
    'none':   'none'
  };
  v.style.boxShadow = styles[style]||'none';
  if (style==='dashed') { v.style.outline=`2px dashed ${fc}`; v.style.outlineOffset='4px'; }
  else { v.style.outline=''; v.style.outlineOffset=''; }
}

function hexToRgba(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Screen shapes
const SHAPES = [
  {id:'shape-sq',cls:'shape-sq',l:'Square'},
  {id:'shape-sm',cls:'shape-sm',l:'Slight Round'},
  {id:'shape-md',cls:'shape-md',l:'Rounded'},
  {id:'shape-lg',cls:'shape-lg',l:'Soft Round'},
  {id:'shape-xl',cls:'shape-xl',l:'Large Round'},
  {id:'shape-pill',cls:'shape-pill',l:'Pill'},
  {id:'shape-circ',cls:'shape-circ',l:'Circle'},
  {id:'shape-sqrc',cls:'shape-sqrc',l:'Squircle'},
  {id:'shape-hex',cls:'shape-hex',l:'Hexagon'},
  {id:'shape-oct',cls:'shape-oct',l:'Octagon'},
  {id:'shape-dia',cls:'shape-dia',l:'Diamond'},
  {id:'shape-prl',cls:'shape-prl',l:'Parallelogram'},
  {id:'shape-art',cls:'shape-art',l:'Arch Top'},
  {id:'shape-arb',cls:'shape-arb',l:'Arch Bot'},
  {id:'shape-tpr',cls:'shape-tpr',l:'Top Round'},
  {id:'shape-btr',cls:'shape-btr',l:'Bot Round'},
  {id:'shape-ltr',cls:'shape-ltr',l:'Left Round'},
  {id:'shape-rtr',cls:'shape-rtr',l:'Right Round'},
  {id:'shape-ntl',cls:'shape-ntl',l:'Notch TL'},
  {id:'shape-ntr',cls:'shape-ntr',l:'Notch TR'},
  {id:'shape-lf',cls:'shape-lf',l:'Leaf'},
  {id:'shape-egg',cls:'shape-egg',l:'Egg'},
  {id:'shape-cld',cls:'shape-cld',l:'Cloud'},
  {id:'shape-flm',cls:'shape-flm',l:'Film Frame'},
  {id:'shape-tv',cls:'shape-tv',l:'Classic TV'},
  {id:'shape-crv',cls:'shape-crv',l:'Curved'},
  {id:'shape-imx',cls:'shape-imx',l:'IMAX Curve'},
  {id:'shape-arr',cls:'shape-arr',l:'Arrow →'},
  {id:'shape-arl',cls:'shape-arl',l:'Arrow ←'},
  {id:'shape-str',cls:'shape-str',l:'Star'},
  {id:'shape-dbl',cls:'shape-dbl',l:'Double Ring'},
  {id:'shape-mon',cls:'shape-mon',l:'Monitor'},
  {id:'shape-ban',cls:'shape-ban',l:'Banner'},
  {id:'shape-shield',cls:'shape-shield',l:'Shield'},
  {id:'shape-wave',cls:'shape-wave',l:'Wave'},
  {id:'shape-trapez',cls:'shape-trapez',l:'Trapezoid'},
  {id:'shape-penta',cls:'shape-penta',l:'Pentagon'},
  {id:'shape-cross',cls:'shape-cross',l:'Cross'},
  {id:'shape-inf',cls:'shape-inf',l:'Infinity'},
  {id:'shape-bowtie',cls:'shape-bowtie',l:'Bowtie'},
  {id:'shape-starburst',cls:'shape-starburst',l:'Starburst'},
];

function buildShapes() {
  const g=$('shapeGrid'); if(!g) return;
  g.innerHTML='';
  SHAPES.forEach(s=>{
    const b=document.createElement('button');
    b.className='shape-btn'+(BP.v.shape===s.id?' on':'');
    b.dataset.shape=s.id;
    b.innerHTML=`<div class="shp-prev ${s.cls}"></div><small>${s.l}</small>`;
    b.onclick=()=>applyShape(s.id);
    g.appendChild(b);
  });
}

function applyShape(id) {
  const v=$('mainVideo'); if(!v) return;
  SHAPES.forEach(s=>v.classList.remove(s.cls));
  v.classList.add(SHAPES.find(s=>s.id===id)?.cls||'');
  BP.v.shape=id;
  $$('.shape-btn').forEach(b=>b.classList.toggle('on',b.dataset.shape===id));
  localStorage.setItem('bp_shape',id);
  flash('⬛ Shape: '+SHAPES.find(s=>s.id===id)?.l);
}

// ─── BACKUP ───────────────────────────────────────────────────────────────────
function exportBackup() {
  const data={v:'2.0',app:'Beta Player',at:new Date().toISOString(),
    profile:BP.profile,playlist:BP.playlist.map(i=>({...i,file:undefined})),
    genreLists:BP.genreLists};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='BetaPlayer_Backup.json'; a.click(); URL.revokeObjectURL(a.href);
  flash('💾 BACKUP EXPORTED');
}

function importBackup(input) {
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    try {
      const d=JSON.parse(e.target.result);
      if(d.playlist){BP.playlist=d.playlist;persistPlaylist();renderPlaylist();renderLibrary();}
      if(d.profile){BP.profile=d.profile;applyProfileUI();}
      if(d.genreLists){BP.genreLists=d.genreLists;saveGenreLists();renderGenreListsModal();renderGenreSidebar();}
      flash('📥 BACKUP RESTORED');
    } catch { flash('⚠ INVALID BACKUP'); }
  };
  r.readAsText(f); input.value='';
}

// ─── PLAYLIST PANEL TOGGLE ───────────────────────────────────────────────────
function togglePlaylistPanel() {
  const p=$('playlistPanel'); if(p) p.classList.toggle('collapsed');
}

// ─── MODAL HELPERS ───────────────────────────────────────────────────────────
function openM(id)  { const m=$(id); if(m) m.classList.remove('hidden'); if(id==='mAppearance') buildShapes(); }
function closeM(id) { const m=$(id); if(m) m.classList.add('hidden'); }
function closeAll() { $$('.modal-back').forEach(m=>m.classList.add('hidden')); hideSubPanel(); }
function onBdClick(e,id) { if(e.target===e.currentTarget) closeM(id); }

function switchTab(el, paneId) {
  const modal=el.closest('.modal-back');
  if(modal) {
    modal.querySelectorAll('.m-tab').forEach(t=>t.classList.remove('on'));
    modal.querySelectorAll('.m-pane').forEach(p=>p.classList.remove('on'));
  }
  el.classList.add('on');
  const pane=$(paneId); if(pane) pane.classList.add('on');
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────
function onDragOver(e) { e.preventDefault(); $('dropzone').classList.add('drag-active'); }
function onDragLeave()  { $('dropzone').classList.remove('drag-active'); }
function onDrop(e) {
  e.preventDefault(); $('dropzone').classList.remove('drag-active');
  const f=e.dataTransfer.files[0]; if(!f) return;
  if(/\.(srt|vtt|ass)$/i.test(f.name)) {
    const r=new FileReader();
    r.onload=ev=>{BP.s.cues=parseSRT(ev.target.result);BP.s.file=f.name;flash('💬 SUBS: '+f.name);};
    r.readAsText(f);
  } else { loadFromFile(f); }
}

// ─── APPEARANCE PERSISTENCE ──────────────────────────────────────────────────
function saveAppearance() {
  const styles = getComputedStyle(document.documentElement);
  localStorage.setItem('bp_appearance', JSON.stringify({
    ac: styles.getPropertyValue('--ac').trim(),
    ac2: styles.getPropertyValue('--ac2').trim(),
    frameColor: styles.getPropertyValue('--frame-color').trim(),
    frameStyle: BP.v.frameStyle
  }));
}

function loadAppearance() {
  try {
    const r=JSON.parse(localStorage.getItem('bp_appearance')||'null');
    if(!r) return;
    if(r.ac)  { document.documentElement.style.setProperty('--ac',r.ac); document.documentElement.style.setProperty('--ac-glow',hexToRgba(r.ac,0.3)); document.documentElement.style.setProperty('--ac-bg',hexToRgba(r.ac,0.08)); }
    if(r.ac2) document.documentElement.style.setProperty('--ac2',r.ac2);
    if(r.frameColor) document.documentElement.style.setProperty('--frame-color',r.frameColor);
    if(r.frameStyle) { BP.v.frameStyle=r.frameStyle; }
  } catch {}
  const shape=localStorage.getItem('bp_shape');
  if(shape) { BP.v.shape=shape; const v=$('mainVideo'); if(v){SHAPES.forEach(s=>v.classList.remove(s.cls));v.classList.add(SHAPES.find(s=>s.id===shape)?.cls||'');} }
  const spd=localStorage.getItem('bp_speed');
  if(spd) { BP.v.speed=+spd; const v=$('mainVideo');if(v)v.playbackRate=+spd; if($('speedBadge'))$('speedBadge').textContent=spd+'x Speed'; }
}

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
function setupKeyboard() {
  window.addEventListener('keydown', e => {
    const tag=document.activeElement.tagName.toLowerCase();
    if(['input','textarea','select'].includes(tag)) return;
    const ob=$('onboardingOverlay');
    if(ob&&!ob.classList.contains('hidden')) return;

    switch(e.code) {
      case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':  case 'KeyJ': e.preventDefault(); seekBy(-10); break;
      case 'ArrowRight': case 'KeyL': e.preventDefault(); seekBy(+10); break;
      case 'ArrowUp':    e.preventDefault(); setVol(Math.min(10,BP.a.vol+0.25)); showHUD('🔊',Math.round(BP.a.vol*100)+'%'); break;
      case 'ArrowDown':  e.preventDefault(); setVol(Math.max(0,BP.a.vol-0.25)); showHUD('🔉',Math.round(BP.a.vol*100)+'%'); break;
      case 'KeyM': e.preventDefault(); toggleMute(); break;
      case 'KeyF': e.preventDefault(); toggleFullscreen(); break;
      case 'KeyS': e.preventDefault(); stopPlayback(); break;
      case 'KeyV': e.preventDefault(); openM('mScreenModes'); break;
      case 'KeyC': e.preventDefault(); toggleSubPanel(); break;
      case 'KeyP': e.preventDefault(); togglePlaylistPanel(); break;
      case 'KeyA': e.preventDefault(); openM('mAudio'); break;
      case 'KeyI': e.preventDefault(); openM('mInspector'); break;
      case 'KeyB': e.preventDefault(); openM('mBackup'); break;
      case 'KeyX': e.preventDefault(); openM('mClip'); break;
      case 'KeyG': e.preventDefault(); openM('mAppearance'); break;
      case 'KeyQ': e.preventDefault(); openM('m3D'); break;
      case 'KeyN': e.preventDefault(); toggleAudioMode(); break;
      case 'KeyT': e.preventDefault(); takeSnapshot(); break;
      case 'KeyR': e.preventDefault(); cycleLoop(); break;
      case 'KeyO': e.preventDefault(); $('mainFileInput').click(); break;
      case 'KeyH': case 'Slash': e.preventDefault(); openM('mKeys'); break;
      case 'Comma': e.preventDefault(); stepFrame(-1); break;
      case 'Period': e.preventDefault(); stepFrame(1); break;
      case 'BracketLeft':  e.preventDefault(); setSpd(Math.max(0.25,+(BP.v.speed-0.25).toFixed(2))); break;
      case 'BracketRight': e.preventDefault(); setSpd(Math.min(6,+(BP.v.speed+0.25).toFixed(2))); break;
      case 'Digit1': e.preventDefault(); setSpd(1); break;
      case 'Digit2': e.preventDefault(); setSpd(2); break;
      case 'Digit3': e.preventDefault(); setSpd(0.5); break;
      case 'Escape': closeAll(); break;
    }
  });
}

// ─── CLICK OVERLAY (play/pause — works on touchpad too) ─────────────────────
function setupClickOverlay() {
  const co=$('clickOverlay');
  if (!co) return;

  let clickTimer=null, lastTap=0;

  // Single click = play/pause
  co.addEventListener('click', e => {
    const now=Date.now();
    if (now-lastTap<300) { // double tap = fullscreen
      clearTimeout(clickTimer); lastTap=0; toggleFullscreen(); return;
    }
    lastTap=now;
    clickTimer=setTimeout(()=>{ lastTap=0; togglePlay(); },200);
  });

  // Touch support for touchpad/mobile
  co.addEventListener('touchend', e => {
    e.preventDefault();
    const now=Date.now();
    if (now-lastTap<300) { clearTimeout(clickTimer); lastTap=0; toggleFullscreen(); return; }
    lastTap=now;
    clickTimer=setTimeout(()=>{ lastTap=0; togglePlay(); },200);
  });

  // Initially hidden — shown when video loads
  co.style.display = 'none';
}

// ─── NEW: RIGHT-CLICK CONTEXT MENU ────────────────────────────────────────────
function setupContextMenu() {
  const co = $('clickOverlay'); const menu = $('ctxMenu'); if(!co||!menu) return;
  co.addEventListener('contextmenu', e => {
    e.preventDefault();
    menu.style.cssText = `display:block;left:${Math.min(e.clientX, window.innerWidth-180)}px;top:${Math.min(e.clientY, window.innerHeight-320)}px`;
  });
  document.addEventListener('click', () => { if(menu) menu.style.display='none'; });
  document.addEventListener('keydown', e => { if(e.key==='Escape' && menu) menu.style.display='none'; });
}

function ctxAction(fn) { const m=$('ctxMenu'); if(m) m.style.display='none'; fn(); }

// ─── NEW: MOUSE SCROLL = VOLUME ───────────────────────────────────────────────
function setupScrollVolume() {
  const wrap = $('videoWrap'); if(!wrap) return;
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    const nv = Math.max(0, Math.min(10, BP.a.vol + delta));
    setVol(nv);
    showHUD(delta>0?'🔊':'🔉', Math.round(nv*100)+'%');
  }, { passive: false });
}

// ─── NEW: GENRE PLAYLISTS ─────────────────────────────────────────────────────
function loadGenreLists() {
  try { BP.genreLists = JSON.parse(localStorage.getItem('bp_genre_lists')||'{}'); } catch { BP.genreLists = {}; }
}
function saveGenreLists() { localStorage.setItem('bp_genre_lists', JSON.stringify(BP.genreLists)); }

function createGenreList(name) {
  name = name.trim(); if(!name) return;
  if(!BP.genreLists[name]) BP.genreLists[name] = [];
  saveGenreLists(); renderGenreListsModal(); renderGenreSidebar();
  flash('📋 Created: '+name);
}

function deleteGenreList(name) {
  if(!confirm('Delete playlist "'+name+'"?')) return;
  delete BP.genreLists[name]; saveGenreLists();
  renderGenreListsModal(); renderGenreSidebar(); flash('🗑 Deleted: '+name);
}

function addItemToGenreList(listName, itemId) {
  if(!BP.genreLists[listName]) BP.genreLists[listName]=[];
  if(!BP.genreLists[listName].includes(itemId)) BP.genreLists[listName].push(itemId);
  saveGenreLists(); renderGenreListsModal(); flash('➕ Added to '+listName);
}

function removeItemFromGenreList(listName, itemId) {
  if(!BP.genreLists[listName]) return;
  BP.genreLists[listName] = BP.genreLists[listName].filter(id=>id!==itemId);
  saveGenreLists(); renderGenreListsModal();
}

function renderGenreListsModal() {
  const container = $('glContainer'); if(!container) return;
  const names = Object.keys(BP.genreLists);
  if(!names.length) { container.innerHTML='<div style="text-align:center;color:var(--text3);padding:32px">No playlists yet. Create one below!</div>'; return; }
  container.innerHTML='';
  names.forEach(name => {
    const items = (BP.genreLists[name]||[]).map(id=>BP.playlist.find(p=>p.id===id)).filter(Boolean);
    const div=document.createElement('div'); div.className='gl-block';
    div.innerHTML=`<div class="gl-hdr"><span class="gl-name">📂 ${name}</span><span class="gl-cnt">${items.length} films</span><button class="btn btn-d" style="padding:4px 10px;font-size:11px" onclick="deleteGenreList('${name}')">🗑</button></div>
    <div class="gl-items">${items.length?items.map(it=>`<div class="gl-item" onclick="loadFromServer(${JSON.stringify(it).replace(/"/g,'&quot;')})"><img src="${it.poster||''}" class="gl-thumb" loading="lazy"><div class="gl-info"><div class="gl-title">${it.title}</div><div class="gl-year">${it.year||''}</div></div><button onclick="event.stopPropagation();removeItemFromGenreList('${name}',${it.id})" style="opacity:.5;font-size:12px;padding:2px 6px" class="btn btn-d">✕</button></div>`).join(''):'<div style="color:var(--text3);font-size:12px;padding:12px">Empty — add movies from your library!</div>'}</div>
    <div class="gl-add-row"><span style="font-size:12px;color:var(--text2)">Add movie:</span><select class="fi fi-sel" style="flex:1;padding:6px" onchange="if(this.value){addItemToGenreList('${name}',+this.value);this.value=''}"><option value="">Select movie...</option>${BP.playlist.map(p=>`<option value="${p.id}">${p.title}</option>`).join('')}</select></div>`;
    container.appendChild(div);
  });
}

function renderGenreSidebar() {
  const sb=$('genreSidebar'); if(!sb) return;
  sb.innerHTML = Object.keys(BP.genreLists).map(name=>`<button class="mn-btn" onclick="openM('mGenreLists');setTimeout(()=>highlightGenre('${name}'),100)" title="${name}">📂<span class="lbl">${name.substring(0,8)}</span></button>`).join('');
}

function highlightGenre(name) {
  // Optionally scroll to or highlight the named genre list block
  const container=$('glContainer'); if(!container) return;
  const blocks=container.querySelectorAll('.gl-block');
  blocks.forEach(b=>{
    const title=b.querySelector('.gl-name');
    if(title && title.textContent.includes(name)) {
      b.scrollIntoView({behavior:'smooth', block:'nearest'});
      b.style.outline='2px solid var(--ac)';
      setTimeout(()=>{ b.style.outline=''; }, 1500);
    }
  });
}

// ─── NEW: SUBTITLE FONTS (30+) ────────────────────────────────────────────────
const SUB_FONTS = [
  { id:'inter',      name:'Inter',          css:"'Inter',sans-serif" },
  { id:'orbitron',   name:'Orbitron',       css:"'Orbitron',sans-serif" },
  { id:'jetbrains',  name:'JetBrains Mono', css:"'JetBrains Mono',monospace" },
  { id:'roboto',     name:'Roboto',         css:"'Roboto',sans-serif" },
  { id:'lato',       name:'Lato',           css:"'Lato',sans-serif" },
  { id:'montserrat', name:'Montserrat',     css:"'Montserrat',sans-serif" },
  { id:'opensans',   name:'Open Sans',      css:"'Open Sans',sans-serif" },
  { id:'raleway',    name:'Raleway',        css:"'Raleway',sans-serif" },
  { id:'poppins',    name:'Poppins',        css:"'Poppins',sans-serif" },
  { id:'nunito',     name:'Nunito',         css:"'Nunito',sans-serif" },
  { id:'ubuntu',     name:'Ubuntu',         css:"'Ubuntu',sans-serif" },
  { id:'exo',        name:'Exo 2',          css:"'Exo 2',sans-serif" },
  { id:'rajdhani',   name:'Rajdhani',       css:"'Rajdhani',sans-serif" },
  { id:'russo',      name:'Russo One',      css:"'Russo One',sans-serif" },
  { id:'audiowide',  name:'Audiowide',      css:"'Audiowide',sans-serif" },
  { id:'righteous',  name:'Righteous',      css:"'Righteous',cursive" },
  { id:'oswald',     name:'Oswald',         css:"'Oswald',sans-serif" },
  { id:'playfair',   name:'Playfair Display',css:"'Playfair Display',serif" },
  { id:'merriweather',name:'Merriweather',  css:"'Merriweather',serif" },
  { id:'cinzel',     name:'Cinzel',         css:"'Cinzel',serif" },
  { id:'dancing',    name:'Dancing Script', css:"'Dancing Script',cursive" },
  { id:'pacifico',   name:'Pacifico',       css:"'Pacifico',cursive" },
  { id:'lobster',    name:'Lobster',        css:"'Lobster',cursive" },
  { id:'satisfy',    name:'Satisfy',        css:"'Satisfy',cursive" },
  { id:'caveat',     name:'Caveat',         css:"'Caveat',cursive" },
  { id:'sourcecodepro',name:'Source Code Pro',css:"'Source Code Pro',monospace" },
  { id:'firacode',   name:'Fira Code',      css:"'Fira Code',monospace" },
  { id:'cousine',    name:'Cousine',        css:"'Cousine',monospace" },
  { id:'georgia',    name:'Georgia',        css:"Georgia,serif" },
  { id:'verdana',    name:'Verdana',        css:"Verdana,sans-serif" },
  { id:'impact',     name:'Impact',         css:"Impact,sans-serif" },
  { id:'arial',      name:'Arial',          css:"Arial,sans-serif" },
  { id:'tahoma',     name:'Tahoma',         css:"Tahoma,sans-serif" },
];

function buildSubFonts() {
  const grid=$('subFontGrid'); if(!grid) return;
  grid.innerHTML='';
  SUB_FONTS.forEach(f=>{
    const btn=document.createElement('button');
    btn.className='sub-font-btn'+(BP.s.font===f.id?' on':'');
    btn.style.fontFamily=f.css;
    btn.textContent=f.name;
    btn.onclick=()=>{
      BP.s.font=f.id; BP.s.fontCss=f.css;
      $$('.sub-font-btn').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      applySubStyle(); flash('💬 Font: '+f.name);
    };
    grid.appendChild(btn);
  });
}

// ─── NEW: SUBTITLE COLORS (40+) ───────────────────────────────────────────────
const SUB_COLOR_PALETTE = [
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1',
  '#ffff00','#fbbf24','#f97316','#ef4444','#dc2626',
  '#10b981','#22c55e','#84cc16','#a3e635','#4ade80',
  '#06b6d4','#38bdf8','#60a5fa','#818cf8','#a78bfa',
  '#c084fc','#e879f9','#f472b6','#fb7185','#f43f5e',
  '#ff6b6b','#ffa502','#ff7675','#fd79a8','#e17055',
  '#00cec9','#55efc4','#81ecec','#74b9ff','#a29bfe',
  '#636e72','#2d3436','#b2bec3','#dfe6e9','#000000',
  '#1a1a2e','#16213e','#0f3460','#533483','#e94560',
];

function buildSubColors() {
  const grid=$('subColorGrid'); if(!grid) return;
  grid.innerHTML='';
  SUB_COLOR_PALETTE.forEach(c=>{
    const btn=document.createElement('button');
    btn.className='sub-color-chip'+(BP.s.color===c?' on':'');
    btn.style.cssText=`background:${c};border-color:${BP.s.color===c?'#fff':'transparent'}`;
    btn.title=c;
    btn.onclick=()=>{
      BP.s.color=c;
      $$('.sub-color-chip').forEach(b=>{b.classList.remove('on');b.style.borderColor='transparent';});
      btn.classList.add('on'); btn.style.borderColor='#fff';
      if($('subColorPicker')) $('subColorPicker').value=c;
      applySubStyle(); flash('💬 Color: '+c);
    };
    grid.appendChild(btn);
  });
}

function buildSubBgColors() {
  const grid=$('subBgGrid'); if(!grid) return;
  const bgColors=['#000000','#1a1a1a','#0f172a','#1e1b4b','#1c1917','rgba(0,0,0,0)','#ffffff20','#00000080','#00000099'];
  grid.innerHTML='';
  bgColors.forEach(c=>{
    const btn=document.createElement('button');
    btn.className='sub-color-chip';
    btn.style.cssText=`background:${c};border:2px solid #444;position:relative`;
    if(c==='rgba(0,0,0,0)'||c.endsWith('0)')) { btn.innerHTML='<span style="font-size:9px;color:#fff">None</span>'; }
    btn.onclick=()=>{ BP.s.bg=c; applySubStyle(); flash('💬 BG: '+c); };
    grid.appendChild(btn);
  });
}

// ─── NEW: PROFILE BORDER STYLES ───────────────────────────────────────────────
const PROFILE_BORDERS = [
  { id:'circle',  label:'Circle',      css:'border-radius:50%' },
  { id:'rounded', label:'Rounded',     css:'border-radius:16px' },
  { id:'square',  label:'Square',      css:'border-radius:0' },
  { id:'hex',     label:'Hexagon',     css:'clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)' },
  { id:'oct',     label:'Octagon',     css:'clip-path:polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)' },
  { id:'diamond', label:'Diamond',     css:'clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%)' },
  { id:'star',    label:'Star',        css:'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' },
  { id:'squircle',label:'Squircle',    css:'border-radius:40% 60% 60% 40%/40% 40% 60% 60%' },
];

function setProfileBorder(id) {
  BP.profile.borderStyle = id;
  const b = PROFILE_BORDERS.find(p=>p.id===id);
  const imgs = [$('avatarImg'), $('avPrev')];
  imgs.forEach(img => { if(!img) return; img.style.cssText = (b ? b.css : 'border-radius:50%') + ';width:100%;height:100%;object-fit:cover;border:3px solid var(--profileBorderColor,var(--ac))'; });
  $$('.pb-btn').forEach(btn=>btn.classList.toggle('on', btn.dataset.border===id));
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  flash('👤 Border: ' + (b?.label||'Default'));
}

function setProfileBorderColor(hex) {
  document.documentElement.style.setProperty('--profileBorderColor', hex);
  BP.profile.borderColor = hex;
  const imgs = [$('avatarImg'), $('avPrev')];
  imgs.forEach(img => { if(img) img.style.borderColor = hex; });
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
}

function buildProfileBorders() {
  const grid=$('profileBorderGrid'); if(!grid) return;
  grid.innerHTML='';
  PROFILE_BORDERS.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='pb-btn btn'+(BP.profile.borderStyle===b.id?' on':'');
    btn.dataset.border=b.id;
    btn.textContent=b.label;
    btn.onclick=()=>setProfileBorder(b.id);
    grid.appendChild(btn);
  });
}

// ─── NEW: TOGGLES BAR ─────────────────────────────────────────────────────────
function buildTogglesBar() {
  const bar=$('togglesBar'); if(!bar) return;
  updateTogglesBar();
}

function updateTogglesBar() {
  setToggle('tgLoop', BP.loop.active);
  setToggle('tgSubs', BP.s.enabled && BP.s.cues.length>0);
  setToggle('tgMute', BP.a.vol===0);
  setToggle('tgHp',   BP.a.mode==='headphones');
  setToggle('tg3D',   BP.v.dim!=='off');
}

function setToggle(id, state) {
  const el=$(id); if(!el) return;
  el.classList.toggle('tg-on', state);
}

// ─── NEW: ICON COLOR CUSTOMIZATION ───────────────────────────────────────────
function setNavIconColor(icon, color) {
  document.documentElement.style.setProperty('--mn-'+icon+'-color', color);
  flash('🎨 Icon color set');
}

// ─── BOOT ENTRY POINT ───────────────────────────────────────────────────────
async function boot() {
  loadAppearance();

  const isNew = checkNewUser();
  runBoot();
  if (isNew) setTimeout(() => showOnboarding(), 5300);

  setupKeyboard();
  setupScrubber();
  setupOrbit();
  setupClickOverlay();
  applySubStyle();
  buildShapes();

  // New feature setups
  setupContextMenu();
  setupScrollVolume();
  loadGenreLists();
  buildSubFonts();
  buildSubColors();
  buildSubBgColors();
  buildTogglesBar();
  buildProfileBorders();
  renderGenreSidebar();

  // Load playlist from server
  await loadPlaylistFromServer();

  // Auto-resume (server-based, works after refresh)
  if (!isNew) {
    setTimeout(async () => {
      await checkResume();
    }, 5500);
  }

  console.log('%c🎬 BETA PLAYER v2.0', 'font-size:20px;font-weight:bold;color:#06b6d4');
  console.log('%cDeveloper: Surendhar S | B.E. CSE | 2025-2029 Batch', 'color:#818cf8');
  console.log('%cBannari Amman Institute of Technology, Erode, Tamil Nadu', 'color:#94a3b8');
}

document.addEventListener('DOMContentLoaded', boot);