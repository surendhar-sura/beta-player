/**
 * BETA PLAYER v2.0 — app.js
 * Developer   : Surendhar S
 * Course      : B.E. Computer Science Engineering (CSE)
 * Batch       : 2025–2029
 * College     : Bannari Amman Institute of Technology, Erode, Tamil Nadu
 * Architecture: Local-First Client Storage (IndexedDB + localStorage)
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
       color:'#ffffff', bg:'#000000', opacity:0.85, font:'inter',
       fontCss:"'Inter',sans-serif", inbuildIndex:-1, inbuildTracks:[] },
  c: { a:-1, b:-1, recorder:null, chunks:[], timer:null, recording:false, maxSec:600 },
  loop: { state:0, a:-1, b:-1, active:false },
  media: { url:'', title:'', year:'', genre:'', poster:'', type:'video',
           size:0, filename:'', isLocalDb:false, localId:null },
  screenLocked: false,
    profile: { name:'Surendhar S', uid:'BP-777', bio:'Beta Player User', avatar:'', genre:'Action',
             registered:true, borderStyle:'circle', borderColor:'#06b6d4', borderWidth:3 },
  playlist: [],
  genreLists: {},
  libFilter: 'all',
  vizId: null,
  orbit: { dragging:false, sx:0, sy:0, active:false },
  hudTimer: null
};

const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);

// ─── LOCAL INDEXEDDB STORAGE (Client-Side Private Storage) ───────────────────
const LOCAL_DB = {
  db: null,
  init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      const req = indexedDB.open('BetaPlayerLocalDB', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      req.onsuccess = e => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => resolve(null);
    });
  },
  async saveFile(id, file) {
    if (!this.db) await this.init();
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.put({ id, file, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        console.warn('saveFile error:', e);
        resolve(false);
      }
    });
  },
  async getFile(id) {
    if (!this.db) await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.file : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        console.warn('getFile error:', e);
        resolve(null);
      }
    });
  },
  async deleteFile(id) {
    if (!this.db) await this.init();
    if (!this.db) return;
    try {
      const tx = this.db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
    } catch {}
  },
  async clearAll() {
    if (!this.db) await this.init();
    if (!this.db) return;
    try {
      const tx = this.db.transaction('files', 'readwrite');
      tx.objectStore('files').clear();
    } catch {}
  }
};

// ─── UNIQUE USER IDENTIFIER GENERATOR ─────────────────────────────────────────
function generateUniqueUserId() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'BP-' + rand;
}

// ─── BOOT SEQUENCE (15-20s Cinematic Loading with Percentage & Diagnostics) ───
let bootAnimationId = null;

function runBoot() {
  const loader = $('betaLoader');
  const bar = $('bootScanProgress');
  const txt = $('bootPercentText');
  const term = $('bootTerminal');
  if (!loader) return;

  const totalTime = 18000; // 18 seconds (15-20s duration)
  const startTime = Date.now();

  const logSteps = [
    { pct: 0,  msg: '<p class="bl">[00.0s] ⚡ KERNEL: Initializing Beta Cinema Engine v2.0...</p>' },
    { pct: 14, msg: '<p class="bl">[02.5s] 🔊 AUDIO: Calibrating 1000% WebAudio Gain Matrix & Compressor...</p>' },
    { pct: 28, msg: '<p class="bl">[05.0s] 💾 STORAGE: Synchronizing IndexedDB Offline Cinema Vault...</p>' },
    { pct: 42, msg: '<p class="bl">[07.5s] 🎬 VIDEO: Configuring 4K HDR Hardware-Accelerated Decoders...</p>' },
    { pct: 56, msg: '<p class="bl">[10.0s] 👤 IDENTITY: Auto-generating Permanent Unique User Identity...</p>' },
    { pct: 70, msg: '<p class="bl">[12.5s] 🎛 SHELL: Initializing Floating VLC Cinema Control Architecture...</p>' },
    { pct: 85, msg: '<p class="bl">[15.0s] 🔒 SECURITY: Arming Distraction-Proof Screen Lock Guard...</p>' },
    { pct: 98, msg: '<p class="bl bl-ok">[17.6s] 🚀 READY: All Subsystems Online. Launching Beta Player!</p>' }
  ];

  let nextStepIdx = 0;

  const updateProgress = () => {
    const elapsed = Date.now() - startTime;
    const pct = Math.min(100, Math.round((elapsed / totalTime) * 100));

    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = pct + '%';

    while (nextStepIdx < logSteps.length && pct >= logSteps[nextStepIdx].pct) {
      if (term) {
        term.innerHTML += logSteps[nextStepIdx].msg;
        term.scrollTop = term.scrollHeight;
      }
      nextStepIdx++;
    }

    if (pct < 100) {
      bootAnimationId = requestAnimationFrame(updateProgress);
    } else {
      localStorage.setItem('bp_visited', '1');
      setTimeout(() => dismissLoader(), 250);
    }
  };

  bootAnimationId = requestAnimationFrame(updateProgress);
}

function dismissLoader() {
  if (bootAnimationId) cancelAnimationFrame(bootAnimationId);
  const l = $('betaLoader'); if (!l) return;
  l.classList.add('loader-exit');
  setTimeout(() => { l.style.display = 'none'; }, 200);
}

// ─── PROFILE SYSTEM WITH LOCAL STORAGE & INDEXEDDB PERSISTENCE ──
function loadProfile() {
  try {
    const raw = localStorage.getItem('bp_profile');
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        BP.profile = { ...BP.profile, ...p };
      }
    }
  } catch (e) {
    console.warn('Error reading bp_profile from localStorage:', e);
  }

  // Ensure default unique ID is permanently generated for every user
  if (!BP.profile.uid || BP.profile.uid === 'BP-777' || BP.profile.uid === 'BP-USER') {
    BP.profile.uid = generateUniqueUserId();
    try {
      localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
    } catch (e) {}
  }

  // Restore from IndexedDB backup if available
  if (window.indexedDB) {
    try {
      const req = indexedDB.open('BetaPlayerLocalDB', 1);
      req.onupgradeneeded = ev => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'key' });
        }
      };
      req.onsuccess = ev => {
        const db = ev.target.result;
        if (db.objectStoreNames.contains('user_profile')) {
          const tx = db.transaction('user_profile', 'readonly');
          const getReq = tx.objectStore('user_profile').get('profile');
          getReq.onsuccess = () => {
            if (getReq.result && getReq.result.data) {
              const idb = getReq.result.data;
              if (idb.avatar && (!BP.profile.avatar || BP.profile.avatar.length < 50)) {
                BP.profile.avatar = idb.avatar;
              }
              if (idb.name) BP.profile.name = idb.name;
              if (idb.bio)  BP.profile.bio  = idb.bio;
              applyProfileUI();
            }
          };
        }
      };
    } catch (e) {}
  }

  applyProfileUI();
}

function checkNewUser() {
  loadProfile();
  if (localStorage.getItem('bp_onboarded') === '1') return false;
  if (BP.profile && BP.profile.name && BP.profile.name !== 'Surendhar S') {
    localStorage.setItem('bp_onboarded', '1');
    return false;
  }
  return true;
}

function showOnboarding() {
  if (localStorage.getItem('bp_onboarded') === '1') return;
  const o = $('onboardingOverlay');
  if (o) o.classList.remove('hidden');
}

function dismissOnboarding() {
  localStorage.setItem('bp_onboarded', '1');
  const o = $('onboardingOverlay');
  if (o) o.classList.add('hidden');
}

function submitOnboarding() {
  const name = ($('obName').value || '').trim() || 'Beta User';
  BP.profile = {
    ...BP.profile,
    name,
    uid: 'BP-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    bio: ($('obBio').value || '').trim() || 'Cinema Lover',
    genre: $('obGenre').value || 'Action',
    registered: true
  };
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  localStorage.setItem('bp_onboarded', '1');
  saveProfileToIndexedDB(BP.profile);
  applyProfileUI();
  dismissOnboarding();
  flash('👋 Welcome to Beta Player, ' + name + '!');
}

function applyProfileUI() {
  const p = BP.profile;
  if (!p) return;
  if ($('avatarImg') && p.avatar) $('avatarImg').src = p.avatar;
  if ($('avPrev') && p.avatar)    $('avPrev').src = p.avatar;
  if ($('pName'))  $('pName').value  = p.name || 'Surendhar S';
  if ($('pId'))    $('pId').value    = p.uid || 'BP-777';
  if ($('pBio'))   $('pBio').value   = p.bio || '';
  if ($('pGenre') && p.genre) $('pGenre').value = p.genre;
  if (p.borderStyle) setProfileBorder(p.borderStyle);
  applyProfileCustomStyles();
}

function saveProfile() {
  const name = ($('pName').value || '').trim() || BP.profile.name;
  BP.profile = {
    ...BP.profile,
    name,
    bio: ($('pBio').value || '').trim(),
    genre: $('pGenre') ? $('pGenre').value : BP.profile.genre
  };
  try {
    localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
    localStorage.setItem('bp_onboarded', '1');
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
  saveProfileToIndexedDB(BP.profile);
  applyProfileUI();
  closeM('mProfile');
  flash('PROFILE SAVED TO LOCAL DEVICE ✓');
}

function onAvatarChange(input) {
  const f = input.files[0];
  if (!f) return;

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Compress and scale to max 220px using canvas for lightweight permanent storage
      const canvas = document.createElement('canvas');
      const maxDim = 220;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      BP.profile.avatar = dataUrl;
      try {
        localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
        localStorage.setItem('bp_onboarded', '1');
      } catch (err) {
        console.warn('LocalStorage error saving avatar:', err);
      }
      saveProfileToIndexedDB(BP.profile);
      applyProfileUI();
      flash('📷 PROFILE PHOTO SAVED TO LOCAL DEVICE ✓');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
}

function saveProfileToIndexedDB(profileData) {
  if (!window.indexedDB) return;
  try {
    const req = indexedDB.open('BetaPlayerLocalDB', 1);
    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('user_profile')) {
        db.createObjectStore('user_profile', { keyPath: 'key' });
      }
    };
    req.onsuccess = ev => {
      const db = ev.target.result;
      if (db.objectStoreNames.contains('user_profile')) {
        const tx = db.transaction('user_profile', 'readwrite');
        tx.objectStore('user_profile').put({ key: 'profile', data: profileData });
      }
    };
  } catch (e) {}
}

function exportProfileToFile() {
  const data = JSON.stringify(BP.profile, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const cleanName = (BP.profile.name || 'User').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `BetaPlayer_Profile_${cleanName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  flash('💾 PROFILE EXPORTED AS LOCAL FILE');
}

function importProfileFromFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported && typeof imported === 'object') {
        BP.profile = { ...BP.profile, ...imported };
        try {
          localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
          localStorage.setItem('bp_onboarded', '1');
        } catch(e) {}
        saveProfileToIndexedDB(BP.profile);
        applyProfileUI();
        flash('📂 PROFILE RESTORED FROM FILE ✓');
      }
    } catch (err) {
      alert('Invalid profile JSON file.');
    }
  };
  reader.readAsText(file);
}

// ─── SCREEN LOCK (Distraction-Proof Child/Cinema Lock) ─────────────────────────
let lockHintTimer = null;

function toggleScreenLock() {
  BP.screenLocked = !BP.screenLocked;
  const shell = $('shell');
  const floatBtn = $('floatingLockBtn');
  const btnLock = $('btnLock');

  // Close any popovers
  const qsp = $('quickSettingsPop');
  if (qsp) qsp.classList.add('hidden');

  if (BP.screenLocked) {
    if (shell) shell.classList.add('screen-locked');
    // Ensure lock button is completely hidden during movie playing so nothing covers the screen!
    if (floatBtn) floatBtn.classList.add('hidden');
    if (btnLock) { btnLock.textContent = '🔒'; btnLock.classList.add('active'); }
    flash('🔒 SCREEN LOCKED — Press "L" or tap to unlock');
  } else {
    if (shell) shell.classList.remove('screen-locked');
    if (floatBtn) floatBtn.classList.add('hidden');
    if (btnLock) { btnLock.textContent = '🔒'; btnLock.classList.remove('active'); }
    clearTimeout(lockHintTimer);
    flash('🔓 SCREEN UNLOCKED — Full controls restored');
  }
}

function showLockedHint() {
  flash('🔒 SCREEN LOCKED — Press "L" or tap unlock button');
  const floatBtn = $('floatingLockBtn');
  if (floatBtn) {
    floatBtn.classList.remove('hidden');
    clearTimeout(lockHintTimer);
    // Auto-hide the unlock pill after 2.5s so it never blocks the movie!
    lockHintTimer = setTimeout(() => {
      if (BP.screenLocked && floatBtn) floatBtn.classList.add('hidden');
    }, 2500);
  }
}

// ─── TOGGLE SIDEBAR & QUICK SETTINGS ──────────────────────────────────────────
function toggleSidebar() {
  const shell = $('shell');
  if (!shell) return;
  const isHidden = shell.classList.toggle('sidebar-hidden');
  try {
    localStorage.setItem('bp_sidebar_hidden', isHidden ? '1' : '0');
  } catch (e) {}
  flash(isHidden ? '🗂 SIDEBAR COLLAPSED (Press \\ to restore)' : '🗂 SIDEBAR RESTORED');
}

function toggleQuickSettings() {
  if (BP.screenLocked) {
    showLockedHint();
    return;
  }
  const pop = $('quickSettingsPop');
  if (!pop) return;
  pop.classList.toggle('hidden');
}

function downloadCurrentMovie() {
  if (BP.media.file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(BP.media.file);
    a.download = BP.media.file.name || 'Movie.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash('💾 DOWNLOADING MOVIE: ' + (BP.media.file.name || 'Movie'));
    return;
  }

  const v = $('mainVideo');
  if (v && v.src) {
    const a = document.createElement('a');
    a.href = v.src;
    a.download = (BP.media.title || 'Movie') + '.mp4';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    flash('💾 DOWNLOADING MOVIE: ' + (BP.media.title || 'Movie'));
    return;
  }

  flash('⚠ NO MOVIE LOADED TO DOWNLOAD');
}

// ─── TIME & SIZE FORMAT ──────────────────────────────────────────────────────
function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function fmtSize(b) {
  if (!b) return '—';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function cleanTitle(raw) {
  return raw
    .replace(/(moviesda|isaimini|masstamilan|yts\.mx|yts|yify|filmyzilla|kuttymovies|hdhub4u|www\.[a-z0-9\-]+\.[a-z]{2,4})/gi, '')
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|3gp)$/i, '')
    .replace(/[.\-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Media File';
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
  if (isAudio) genre = 'Soundtrack';
  else if (/comedy|funny|don|doctor/i.test(txt)) genre = 'Comedy';
  else if (/romance|love|heart|96/i.test(txt)) genre = 'Romance';
  else if (/scifi|space|alien|interstellar/i.test(txt)) genre = 'Sci-Fi';
  else if (/thriller|detective|crime/i.test(txt)) genre = 'Thriller';
  const poster = isAudio
    ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80'
    : 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80';
  return { isAudio, title, year, genre, poster };
}

// ─── PLAYLIST & LOCAL FILE HANDLING ──────────────────────────────────────────
// Playlist is stored in client localStorage: 'bp_playlist'
// Video file blobs are stored in client IndexedDB: LOCAL_DB
function loadLocalPlaylist() {
  try {
    const raw = localStorage.getItem('bp_playlist');
    BP.playlist = raw ? JSON.parse(raw) : [];
  } catch {
    BP.playlist = [];
  }
  renderPlaylist();
  renderLibrary();
  updateBkCount();
}

function persistLocalPlaylist() {
  try {
    localStorage.setItem('bp_playlist', JSON.stringify(BP.playlist));
  } catch {}
  updateBkCount();
}

function addToPlaylist(item) {
  const idx = BP.playlist.findIndex(p => p.filename === item.filename);
  if (idx >= 0) BP.playlist[idx] = { ...BP.playlist[idx], ...item };
  else BP.playlist.unshift(item);
  persistLocalPlaylist();
  renderPlaylist();
  renderLibrary();
}

// Load from a local File object and store locally
async function loadFromFile(file, seekTo = 0, autoResume = false) {
  const info = guessMedia(file.name, file.type);
  const v = $('mainVideo');
  v.pause();
  if (BP.media.url && BP.media.url.startsWith('blob:')) URL.revokeObjectURL(BP.media.url);

  const localId = Date.now();
  const url = URL.createObjectURL(file);

  BP.media = {
    url,
    title: info.title,
    year: info.year,
    genre: info.genre,
    poster: info.poster,
    type: info.isAudio ? 'audio' : 'video',
    size: file.size,
    filename: file.name,
    isLocalDb: true,
    localId
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

  // Save to browser's private local IndexedDB
  await LOCAL_DB.saveFile(localId, file);

  // Add to user's private local playlist
  const item = {
    id: localId,
    title: info.title,
    year: info.year,
    genre: info.genre,
    poster: info.poster,
    type: info.isAudio ? 'audio' : 'video',
    size: file.size,
    filename: file.name,
    isLocalDb: true
  };
  addToPlaylist(item);

  const tryPlay = () => {
    if (BP.a.ctx && BP.a.ctx.state === 'suspended') BP.a.ctx.resume().catch(() => {});
    v.play().then(() => {
      BP.v.playing = true;
      setPlayIcon(false);
      if (seekTo > 0) setTimeout(() => { v.currentTime = seekTo; }, 150);
      if (autoResume) showHUD('▶', fmt(seekTo));
    }).catch(e => {
      console.warn('Autoplay blocked:', e);
      setPlayIcon(true);
    });
  };

  if (v.readyState >= 2) tryPlay();
  else v.addEventListener('canplay', tryPlay, { once: true });
}

// Play an item from the user's local playlist
async function playPlaylistItem(item) {
  const v = $('mainVideo');
  v.pause();
  if (BP.media.url && BP.media.url.startsWith('blob:')) URL.revokeObjectURL(BP.media.url);

  let file = null;
  if (item.id) {
    file = await LOCAL_DB.getFile(item.id);
  }

  if (file) {
    const url = URL.createObjectURL(file);
    BP.media = {
      url,
      title: item.title,
      year: item.year || '',
      genre: item.genre || 'Action',
      poster: item.poster || '',
      type: item.type || 'video',
      size: item.size || file.size,
      filename: item.filename,
      isLocalDb: true,
      localId: item.id
    };
    v.src = url;
    v.load();
  } else if (item.serverUrl) {
    // Fallback if item has a server URL
    BP.media = {
      url: item.serverUrl,
      title: item.title,
      year: item.year || '',
      genre: item.genre || 'Action',
      poster: item.poster || '',
      type: item.type || 'video',
      size: item.size || 0,
      filename: item.filename,
      isLocalDb: false
    };
    v.src = item.serverUrl;
    v.load();
  } else {
    flash('⚠ File not in local storage. Click + to choose file.');
    $('mainFileInput').click();
    return;
  }

  $('dropzone').classList.add('hidden');
  v.style.display = 'block';
  $('clickOverlay').style.display = 'block';

  updateNowPlaying();
  updateInspector();
  initAudio();

  if (item.type === 'audio') showMusicStudio(item.title, item.genre || 'Music', item.poster || '');
  else { $('musicStudio').classList.add('hidden'); stopViz(); }

  const tryPlay = () => {
    if (BP.a.ctx && BP.a.ctx.state === 'suspended') BP.a.ctx.resume().catch(() => {});
    v.play().then(() => {
      BP.v.playing = true;
      setPlayIcon(false);
    }).catch(() => {
      setPlayIcon(true);
    });
  };

  if (v.readyState >= 2) tryPlay();
  else v.addEventListener('canplay', tryPlay, { once: true });
}

// File selected from input
async function onFileSelected(input) {
  const f = input.files[0]; if (!f) return;
  await loadFromFile(f);
  input.value = '';
}

function updateBkCount() {
  if ($('bkCount')) $('bkCount').textContent = BP.playlist.length;
  if ($('ppCount')) $('ppCount').textContent = BP.playlist.length + ' items';
  const nc = $('navCount');
  if (nc) {
    nc.textContent = BP.playlist.length;
    nc.style.display = BP.playlist.length > 0 ? 'flex' : 'none';
  }
}

function renderPlaylist(filter = '') {
  const list = $('ppList'); if (!list) return;
  const items = BP.playlist.filter(i =>
    !filter || i.title.toLowerCase().includes(filter.toLowerCase())
  );
  if (!items.length) {
    list.innerHTML = '<div class="pp-empty">No movies in your local playlist.<br>Upload your movies to get started!</div>';
    updateBkCount(); return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'pp-item' + (BP.media.localId === item.id ? ' playing' : '');
    div.innerHTML = `
      <img class="pp-thumb" src="${item.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100&q=60'}" alt="${item.title}" loading="lazy">
      <div class="pp-info">
        <div class="pp-name">${item.title}</div>
        <div class="pp-meta">${item.year || ''} · ${item.type === 'audio' ? 'Music' : 'Movie'}</div>
        <div class="pp-type">${item.genre || 'Action'}</div>
      </div>
      <button class="pp-down-btn" onclick="event.stopPropagation();downloadPlaylistItem(${item.id})" title="Download to Local Device" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--ac);padding:4px 6px">⬇</button>
      <span class="pp-del" onclick="event.stopPropagation();removeFromPlaylist(${item.id})">🗑</span>`;
    div.onclick = () => playPlaylistItem(item);
    list.appendChild(div);
  });
  updateBkCount();
}

function filterPlaylist(q) { renderPlaylist(q); }

function renderLibrary() {
  const grid = $('libraryGrid'); if (!grid) return;
  if (!BP.playlist.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">Your local library is empty.<br>Click Upload to add your movies!</div>';
    return;
  }
  grid.innerHTML = '';
  BP.playlist.forEach(item => {
    const c = document.createElement('div');
    c.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:all .18s;background:var(--bg3)';
    c.innerHTML = `
      <img src="${item.poster || ''}" style="width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:var(--bg3)" loading="lazy">
      <div style="padding:8px">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:2px">${item.year || ''} · ${item.genre || ''}</div>
      </div>`;
    c.onmouseover = () => { c.style.borderColor = 'var(--ac)'; c.style.transform = 'scale(1.02)'; };
    c.onmouseout  = () => { c.style.borderColor = 'var(--border)'; c.style.transform = ''; };
    c.onclick = () => { playPlaylistItem(item); closeM('mLibrary'); };
    grid.appendChild(c);
  });
}


async function downloadPlaylistItem(id) {
  const item = BP.playlist.find(p => p.id === id);
  if (!item) return;

  const localFile = await LOCAL_DB.getFile(id);
  if (localFile) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(localFile);
    a.download = localFile.name || (item.title + '.mp4');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash('💾 DOWNLOADING TO LOCAL DEVICE: ' + (localFile.name || item.title));
    return;
  }

  if (item.url) {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = (item.title || 'Movie') + '.mp4';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    flash('💾 DOWNLOADING TO LOCAL DEVICE: ' + item.title);
    return;
  }

  flash('⚠ FILE NOT AVAILABLE FOR DOWNLOAD');
}

async function removeFromPlaylist(id) {
  if (!confirm('Remove from your local playlist?')) return;
  BP.playlist = BP.playlist.filter(p => p.id !== id);
  persistLocalPlaylist();
  await LOCAL_DB.deleteFile(id);
  renderPlaylist();
  renderLibrary();
}

async function clearPlaylist() {
  if (!confirm('Clear entire local playlist?')) return;
  BP.playlist = [];
  persistLocalPlaylist();
  await LOCAL_DB.clearAll();
  renderPlaylist();
  renderLibrary();
  flash('🗑 PLAYLIST CLEARED');
}


// ─── AUTO-RESUME (Seamless on Refresh) ───────────────────────────────────────
async function checkResume() {
  try {
    const raw = localStorage.getItem('bp_session');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || s.time < 0.5) return;

    // Get file from local storage
    let file = null;
    if (s.localId) file = await LOCAL_DB.getFile(s.localId);
    if (!file && BP.playlist.length > 0) {
      const match = BP.playlist.find(p => p.id === s.localId || p.filename === s.filename) || BP.playlist[0];
      if (match && match.id) file = await LOCAL_DB.getFile(match.id);
    }

    if (!file) return;

    const v = $('mainVideo');
    const url = URL.createObjectURL(file);
    BP.media = {
      url,
      title: s.title || file.name,
      year: s.year || '',
      genre: s.genre || 'Action',
      poster: s.poster || '',
      type: s.type || 'video',
      size: s.size || file.size,
      filename: s.filename || file.name,
      isLocalDb: true,
      localId: s.localId || (BP.playlist[0] ? BP.playlist[0].id : null)
    };

    v.src = url;
    v.load();
    $('dropzone').classList.add('hidden');
    v.style.display = 'block';
    $('clickOverlay').style.display = 'block';
    updateNowPlaying();
    updateInspector();

    // Set time immediately when metadata is ready
    v.addEventListener('loadedmetadata', () => {
      v.currentTime = s.time;
    }, { once: true });

    v.addEventListener('canplay', () => {
      v.currentTime = s.time;
      // Attempt immediate play with sound
      v.play().then(() => {
        BP.v.playing = true;
        setPlayIcon(false);
        showHUD('▶', 'RESUMED at ' + fmt(s.time));
        updateTogglesBar();
      }).catch(() => {
        // Browser autoplay policy blocked un-muted play: play muted seamlessly!
        v.muted = true;
        v.play().then(() => {
          BP.v.playing = true;
          setPlayIcon(false);
          showHUD('▶', 'RESUMED (Muted - Click to Unmute)');
          // Restore sound on first user gesture
          const unmute = () => {
            v.muted = false;
            v.volume = Math.min(1, BP.a.vol || 1);
            showHUD('🔊', Math.round((BP.a.vol || 1) * 100) + '%');
            ['click', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, unmute));
          };
          ['click', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unmute, { once: true }));
        }).catch(() => {
          setPlayIcon(true);
        });
      });
    }, { once: true });
  } catch (e) {
    console.warn('Resume note:', e);
  }
}

function saveProgress() {
  const v = $('mainVideo');
  if (!v || isNaN(v.currentTime) || v.currentTime < 0.5) return;
  const localId = BP.media.localId || (BP.playlist[0] ? BP.playlist[0].id : null);
  if (!localId && !BP.media.filename) return;

  try {
    localStorage.setItem('bp_session', JSON.stringify({
      localId: localId,
      filename: BP.media.filename || '',
      title: BP.media.title || 'Media',
      time: v.currentTime,
      duration: v.duration || 0,
      ts: Date.now()
    }));
  } catch {}
}

function clearProgress() {
  localStorage.removeItem('bp_session');
  flash('🗑 RESUME CLEARED');
}


// ─── NOW PLAYING & INSPECTOR ─────────────────────────────────────────────────
function updateNowPlaying() {
  const pill = $('nowPlayingPill');
  if ($('npTitle')) $('npTitle').textContent = BP.media.title;
  if ($('npBadge')) $('npBadge').textContent = BP.media.type === 'audio' ? '🎵' : '🎬';
  if (pill) pill.classList.remove('hidden');
}

function updateInspector() {
  const v = $('mainVideo');
  if ($('inspPoster')) $('inspPoster').src = BP.media.poster;
  if ($('inspTitle'))  $('inspTitle').textContent  = BP.media.title;
  if ($('inspYear'))   $('inspYear').textContent   = '(' + BP.media.year + ')';
  if ($('inspGenre'))  $('inspGenre').textContent  = BP.media.genre;
  if ($('inspPlot'))   $('inspPlot').textContent   = `"${BP.media.title}" (${BP.media.year}) · ${BP.media.genre}. Private local playback via Beta Player.`;
  if ($('inspType'))   $('inspType').textContent   = BP.media.type === 'audio' ? 'Music Track' : 'Cinema Video';
  if ($('inspFile'))   $('inspFile').textContent   = BP.media.filename;
  if ($('inspSize'))   $('inspSize').textContent   = fmtSize(BP.media.size);
  if ($('inspStore'))  $('inspStore').textContent  = 'Local Browser Storage (IndexedDB)';
  v.addEventListener('loadedmetadata', () => {
    if ($('inspRes')) $('inspRes').textContent = v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : 'Audio Only';
    if ($('inspDur')) $('inspDur').textContent = fmt(v.duration);
    const kbps = BP.media.size > 0 && v.duration > 0 ? Math.round((BP.media.size * 8) / v.duration / 1000) : 0;
    if ($('inspBit')) $('inspBit').textContent = kbps > 0 ? `~${kbps} kbps` : 'N/A';
  }, { once: true });
}

// ─── AUDIO ENGINE (Fixed for all laptops) ─────────────────────────────────────
function unlockAudioOnGesture() {
  const resume = () => {
    if (BP.a.ctx && BP.a.ctx.state === 'suspended') {
      BP.a.ctx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
    window.addEventListener(ev, resume, { passive: true });
  });
}

function initAudio() {
  if (BP.a.ctx) {
    if (BP.a.ctx.state === 'suspended') BP.a.ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    BP.a.ctx = new AC();
    BP.a.gain = BP.a.ctx.createGain();
    BP.a.gain.gain.value = BP.a.vol;

    // Pro-audio Dynamics Compressor prevents harsh clipping when boosting up to 1000%
    BP.a.comp = BP.a.ctx.createDynamicsCompressor();
    BP.a.comp.threshold.setValueAtTime(-14, BP.a.ctx.currentTime);
    BP.a.comp.knee.setValueAtTime(24, BP.a.ctx.currentTime);
    BP.a.comp.ratio.setValueAtTime(8, BP.a.ctx.currentTime);
    BP.a.comp.attack.setValueAtTime(0.003, BP.a.ctx.currentTime);
    BP.a.comp.release.setValueAtTime(0.2, BP.a.ctx.currentTime);

    BP.a.analyser = BP.a.ctx.createAnalyser();
    BP.a.analyser.fftSize = 256;
    const v = $('mainVideo');
    if (!BP.a.src && v) {
      BP.a.src = BP.a.ctx.createMediaElementSource(v);
      BP.a.src.connect(BP.a.gain);
      BP.a.gain.connect(BP.a.comp);
      BP.a.comp.connect(BP.a.analyser);
      BP.a.analyser.connect(BP.a.ctx.destination);
    }
  } catch (e) {
    console.warn('AudioContext note:', e);
  }
}

function setVol(val) {
  // Volume range 0.0 to 10.0 (up to 1000% volume boost)
  val = Math.max(0, Math.min(10, val));
  BP.a.vol = val;
  const v = $('mainVideo');
  if (v) {
    v.volume = Math.min(1, val);
    v.muted = (val === 0);
  }
  if (!BP.a.ctx && val > 1) {
    initAudio();
  }
  if (BP.a.gain && BP.a.ctx) {
    try {
      BP.a.gain.gain.setValueAtTime(val, BP.a.ctx.currentTime);
      if (BP.a.ctx.state === 'suspended' && val > 0) BP.a.ctx.resume().catch(() => {});
    } catch {}
  }
  const pct = Math.round(val * 100);
  const fillPct = Math.min(100, (val / 10) * 100);

  // Gradient color based on boost level (matching VLC green -> amber -> red wedge)
  let barColor = '#10b981'; // 0-100% Emerald
  if (pct > 600) barColor = '#ef4444'; // 600-1000% Red
  else if (pct > 250) barColor = '#f97316'; // 250-600% Orange
  else if (pct > 100) barColor = '#f59e0b'; // 100-250% Amber

  if ($('volSlider')) {
    $('volSlider').value = val;
    $('volSlider').style.background = `linear-gradient(to right, ${barColor} 0%, ${barColor} ${fillPct}%, rgba(255,255,255,0.18) ${fillPct}%, rgba(255,255,255,0.18) 100%)`;
  }
  if ($('volBigSlider')) $('volBigSlider').value = val;
  if ($('volPct')) {
    $('volPct').textContent = pct + '%';
    $('volPct').style.color = pct > 100 ? barColor : 'var(--text2)';
    $('volPct').style.fontWeight = pct > 100 ? '700' : '500';
  }
  if ($('volBig')) {
    $('volBig').textContent = pct + '%';
    $('volBig').style.color = pct > 100 ? barColor : '#fff';
  }
  if ($('muteIcon')) $('muteIcon').textContent = val === 0 ? '🔇' : (val > 0.5 ? '🔊' : '🔉');
  updateTogglesBar();
}

function toggleMute() {
  if (BP.a.vol > 0) {
    BP.a.lastVol = BP.a.vol;
    setVol(0);
    showHUD('🔇', 'MUTED');
  } else {
    setVol(BP.a.lastVol || 1);
    showHUD('🔊', Math.round((BP.a.lastVol || 1) * 100) + '%');
  }
}

function setAudioMode(mode) {
  BP.a.mode = mode;
  flash(mode === 'headphones' ? '🎧 HEADPHONES MODE' : '🔈 NORMAL MODE');
  if ($('modeBadge')) $('modeBadge').textContent = mode === 'headphones' ? '🎧 Headphones' : '🔈 Normal';
  [$('btnNormal'), $('btnHeadphones')].forEach(b => {
    if (b) b.classList.toggle('on', b.id === 'btnHeadphones' ? mode === 'headphones' : mode === 'normal');
  });
  updateTogglesBar();
}

function toggleAudioMode() { setAudioMode(BP.a.mode === 'normal' ? 'headphones' : 'normal'); }

// ─── PLAY / PAUSE / STOP ─────────────────────────────────────────────────────
function togglePlay() {
  if (BP.screenLocked) { showLockedHint(); return; }
  if (BP.a.ctx && BP.a.ctx.state === 'suspended') BP.a.ctx.resume().catch(() => {});
  const v = $('mainVideo');
  if (!v.src) return;
  if (v.paused) {
    v.play().then(() => {
      BP.v.playing = true;
      setPlayIcon(false);
      showHUD('▶', 'PLAYING');
    }).catch(() => {});
    if ($('vinylDisc')) $('vinylDisc').classList.remove('paused');
  } else {
    v.pause();
    BP.v.playing = false;
    setPlayIcon(true);
    showHUD('⏸', 'PAUSED');
    if ($('vinylDisc')) $('vinylDisc').classList.add('paused');
  }
  updateTogglesBar();
}

function setPlayIcon(paused) {
  if ($('playIcon')) $('playIcon').textContent = paused ? '▶' : '⏸';
}

function stopPlayback() {
  const v = $('mainVideo');
  v.pause();
  v.currentTime = 0;
  BP.v.playing = false;
  setPlayIcon(true);
  showHUD('⏹', 'STOPPED');
  localStorage.removeItem('bp_session');
  updateTogglesBar();
}

function onVideoPlay()  { BP.v.playing = true;  setPlayIcon(false); updateTogglesBar(); }
function onVideoPause() { BP.v.playing = false; setPlayIcon(true);  updateTogglesBar(); }
function onVideoEnded() { BP.v.playing = false; setPlayIcon(true); showHUD('⏹', 'ENDED'); BP.loop.state = 0; BP.loop.active = false; updateTogglesBar(); }
function onVideoError() { flash('⚠ VIDEO LOAD ERROR'); setPlayIcon(true); }

// ─── CENTER HUD & FLASH ──────────────────────────────────────────────────────
function showHUD(icon, label, persist = false) {
  const hud = $('centerHUD'); if (!hud) return;
  if ($('hudIcon'))  $('hudIcon').textContent  = icon;
  if ($('hudLabel')) $('hudLabel').textContent = label;
  hud.classList.remove('hidden', 'fade');
  clearTimeout(BP.hudTimer);
  if (!persist) BP.hudTimer = setTimeout(() => hud.classList.add('fade'), 1400);
}

function flash(text) {
  const p = $('flashPip'); if (!p) return;
  $('flashTxt').textContent = text;
  p.classList.remove('hidden', 'fade');
  clearTimeout(p._t);
  p._t = setTimeout(() => p.classList.add('fade'), 1200);
}

// ─── SCRUBBER ────────────────────────────────────────────────────────────────
function setupScrubber() {
  const tr = $('scrubTrack'); if (!tr) return;
  let drag = false;
  const seek = e => {
    const r = tr.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = $('mainVideo'); if (v.duration) v.currentTime = pos * v.duration;
  };
  tr.addEventListener('mousedown',  e => { drag = true; seek(e); });
  tr.addEventListener('mousemove',  e => {
    if (drag) seek(e);
    const r = tr.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const hv = $('scrubHover');
    if (hv) {
      hv.textContent = fmt(pos * ($('mainVideo').duration || 0));
      hv.style.left = (e.clientX - r.left) + 'px';
      hv.style.display = 'block';
    }
  });
  window.addEventListener('mousemove', e => { if (drag) seek(e); });
  window.addEventListener('mouseup',   () => { drag = false; });
  tr.addEventListener('touchstart', e => { e.preventDefault(); drag = true; seek(e.touches[0]); }, { passive: false });
  tr.addEventListener('touchmove',  e => { e.preventDefault(); if (drag) seek(e.touches[0]); }, { passive: false });
  window.addEventListener('touchend', () => { drag = false; });
}

function onScrubClick(e) {
  const tr = $('scrubTrack'); if (!tr) return;
  const r = tr.getBoundingClientRect();
  const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const v = $('mainVideo'); if (v.duration) v.currentTime = pos * v.duration;
}

function onScrubHover(e) {
  const tr = $('scrubTrack'), hv = $('scrubHover'); if (!tr || !hv) return;
  const r = tr.getBoundingClientRect();
  const pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  hv.textContent = fmt(pos * ($('mainVideo').duration || 0));
  hv.style.left = (e.clientX - r.left) + 'px';
  hv.style.display = 'block';
}

function onTimeUpdate() {
  const v = $('mainVideo'); if (!v) return;
  const cur = v.currentTime || 0, dur = v.duration || 0;
  if ($('scrubTime'))   $('scrubTime').textContent   = fmt(cur);
  if ($('scrubRemain')) $('scrubRemain').textContent = dur > 0 ? '-' + fmt(dur - cur) : '-0:00:00';
  if ($('ctrlTimeSummary')) $('ctrlTimeSummary').textContent = fmt(cur) + ' / ' + (dur > 0 ? fmt(dur) : '0:00:00');
  if (dur > 0) {
    const pct = (cur / dur) * 100;
    if ($('scrubFill'))  $('scrubFill').style.width  = pct + '%';
    if ($('scrubThumb')) $('scrubThumb').style.left  = pct + '%';
    if (v.buffered && v.buffered.length > 0) {
      if ($('scrubBuf')) $('scrubBuf').style.width = ((v.buffered.end(v.buffered.length - 1) / dur) * 100) + '%';
    }
  }
  renderSubs();
  checkLoopAB();
  saveProgress();
}

function seekBy(s) {
  if (BP.screenLocked) { showLockedHint(); return; }
  const v = $('mainVideo');
  v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + s));
  showHUD(s > 0 ? '⏩' : '⏪', (s > 0 ? '+' : '') + s + 's');
}

function stepFrame(dir) {
  const v = $('mainVideo');
  v.pause();
  v.currentTime += dir * (1 / 30);
  setPlayIcon(true);
  showHUD(dir > 0 ? '▶|' : '|◀', 'FRAME');
}

function takeSnapshot() {
  const v = $('mainVideo');
  if (!v.src) { flash('⚠ NO VIDEO'); return; }
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 720;
  c.getContext('2d').drawImage(v, 0, 0);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `BetaPlayer_${Date.now()}.png`;
  a.click();
  flash('📸 SNAPSHOT SAVED!');
}

function setSpd(val) {
  BP.v.speed = val;
  const v = $('mainVideo'); if (v) v.playbackRate = val;
  showHUD('⚡', val + 'x SPEED');
  if ($('speedBadge')) $('speedBadge').textContent = val + 'x Speed';
  $$('[data-spd]').forEach(b => b.classList.toggle('on', +b.dataset.spd === val));
  localStorage.setItem('bp_speed', val);
}

function setQual(q) {
  BP.v.qual = q;
  const qf = { '720p':'blur(0.3px)', '480p':'blur(0.6px) contrast(1.05)', '360p':'blur(1px)', '240p':'blur(2px)' };
  applyFilters(qf[q] || '');
  if ($('qualBadge')) $('qualBadge').textContent = q;
  $$('[data-qual]').forEach(b => b.classList.toggle('on', b.dataset.qual === q));
  flash('📺 Quality: ' + q.toUpperCase());
}

function applyFilters(extraFilter = '') {
  const v = $('mainVideo'); if (!v) return;
  v.style.filter = `${extraFilter} brightness(${BP.v.bright}%) contrast(${BP.v.contrast}%) saturate(${BP.v.sat}%) hue-rotate(${BP.v.hue}deg)`.trim();
}

// ─── SCREEN MODES & CUSTOM FRAME RATIO ────────────────────────────────────────
function setMode(mode) {
  BP.v.mode = mode;
  const v = $('mainVideo');
  if (!v) return;
  if (mode === 'mirror') {
    v.style.transform = v.style.transform.includes('scaleX(-1)') ? '' : 'scaleX(-1)';
    flash('🪞 MIRROR');
    return;
  }
  const modeStyles = {
    'fit':     { width:'100%', height:'100%', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'' },
    'cover':   { width:'100%', height:'100%', maxWidth:'100%', maxHeight:'100%', objectFit:'cover',   aspectRatio:'' },
    'theater': { width:'100%', height:'100%', maxWidth:'100%', maxHeight:'100%', objectFit:'cover',   aspectRatio:'' },
    'stretch': { width:'100%', height:'100%', maxWidth:'100%', maxHeight:'100%', objectFit:'fill',    aspectRatio:'' },
    '16:9':    { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'16/9' },
    '21:9':    { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'21/9' },
    'imax':    { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'1.43/1' },
    '9:16':    { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'9/16' },
    '1:1':     { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'1/1' },
    '32:9':    { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'32/9' },
    '4:3':     { width:'auto', height:'auto', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', aspectRatio:'4/3' }
  };
  if (modeStyles[mode]) {
    const s = modeStyles[mode];
    v.style.width = s.width;
    v.style.height = s.height;
    v.style.maxWidth = s.maxWidth;
    v.style.maxHeight = s.maxHeight;
    v.style.objectFit = s.objectFit;
    v.style.aspectRatio = s.aspectRatio;
  }
  try { localStorage.setItem('bp_aspect_ratio', mode); } catch(e) {}
  flash('📐 ' + mode.toUpperCase());
}

// Fixed Custom Frame Ratio & Zoom Scale
function setCustomRatio(w, h) {
  if (!w || !h) {
    w = parseFloat($('cwW')?.value) || 16;
    h = parseFloat($('cwH')?.value) || 9;
  }
  const v = $('mainVideo');
  if (!v) return;

  v.style.width = 'auto';
  v.style.height = 'auto';
  v.style.maxWidth = '100%';
  v.style.maxHeight = '100%';
  v.style.aspectRatio = `${w}/${h}`;
  v.style.objectFit = 'contain';

  try { localStorage.setItem('bp_aspect_ratio', `${w}/${h}`); } catch(e) {}
  flash(`📐 ${w}:${h} Ratio Applied`);
  closeM('mScreenModes');
}

function setVideoScale(val) {
  BP.v.scale = parseFloat(val) || 1;
  const v = $('mainVideo');
  if (v) {
    const isMirrored = v.style.transform && v.style.transform.includes('scaleX(-1)');
    v.style.transform = (isMirrored ? 'scaleX(-1) ' : '') + `scale(${BP.v.scale})`;
  }
  const lbl = $('qspScaleVal');
  if (lbl) lbl.textContent = Math.round(BP.v.scale * 100) + '%';
  try { localStorage.setItem('bp_scale', BP.v.scale); } catch (e) {}
}

function toggleFullscreen() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  if (!isFs) {
    // Request fullscreen on stage so BOTH video and controls/duration are present!
    const stage = $('stage') || document.documentElement;
    if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(() => {});
    } else if (stage.webkitRequestFullscreen) {
      stage.webkitRequestFullscreen();
    } else if (stage.mozRequestFullScreen) {
      stage.mozRequestFullScreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  }
}

function onFullscreenChange() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const icon = $('fsIcon');
  if (icon) icon.textContent = isFs ? '⛶' : '⛶';
  const stage = $('stage');
  if (stage) {
    stage.classList.toggle('vlc-fullscreen', isFs);
    stage.classList.remove('idle-hide');
  }
  const ctrls = $('controls');
  if (ctrls) {
    ctrls.style.opacity = '1';
    ctrls.style.pointerEvents = 'all';
  }
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

function togglePiP() {
  const v = $('mainVideo'); if (!v) return;
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  else v.requestPictureInPicture().catch(() => {});
}

// ─── 3D / 4D / 5D ORBIT ───────────────────────────────────────────────────────
function setDim(mode) {
  BP.v.dim = mode;
  BP.orbit.active = ['3d', '4d', '5d'].includes(mode);
  if ($('orbitHUD')) $('orbitHUD').classList.toggle('hidden', !BP.orbit.active);
  applyOrbit();
  flash(mode === 'off' ? '📺 2D' : '👓 ' + mode.toUpperCase());
  updateTogglesBar();
}

function applyOrbit() {
  const v = $('mainVideo'); if (!v) return;
  if (BP.v.dim === 'off') { v.style.transform = ''; return; }
  v.style.transform = `perspective(${BP.v.curv}px) rotateX(${BP.v.rx}deg) rotateY(${BP.v.ry}deg) rotateZ(${BP.v.rz}deg)`;
  if ($('oPitch')) $('oPitch').textContent = Math.round(BP.v.rx);
  if ($('oYaw'))   $('oYaw').textContent   = Math.round(BP.v.ry);
  if ($('oRoll'))  $('oRoll').textContent  = Math.round(BP.v.rz);
}

function reset3D() {
  BP.v.rx = 0; BP.v.ry = 0; BP.v.rz = 0;
  ['slPitch', 'slYaw', 'slRoll'].forEach(id => { const el = $(id); if (el) el.value = 0; });
  ['sPitch', 'sYaw', 'sRoll'].forEach(id => { const el = $(id); if (el) el.textContent = '0°'; });
  applyOrbit(); flash('🔄 3D RESET');
}

function setupOrbit() {
  const wrap = $('videoWrap'); if (!wrap) return;
  wrap.addEventListener('mousedown', e => {
    if (!BP.orbit.active || e.button !== 0) return;
    BP.orbit.dragging = true; BP.orbit.sx = e.clientX; BP.orbit.sy = e.clientY;
    wrap.style.cursor = 'grabbing'; e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!BP.orbit.dragging || !BP.orbit.active) return;
    const dx = (e.clientX - BP.orbit.sx) * 0.3, dy = (e.clientY - BP.orbit.sy) * 0.3;
    BP.v.ry = Math.max(-60, Math.min(60, BP.v.ry + dx));
    BP.v.rx = Math.max(-60, Math.min(60, BP.v.rx + dy));
    BP.orbit.sx = e.clientX; BP.orbit.sy = e.clientY;
    applyOrbit();
  });
  window.addEventListener('mouseup', () => { BP.orbit.dragging = false; wrap.style.cursor = ''; });
}

// ─── A-B LOOP ────────────────────────────────────────────────────────────────
function cycleLoop() {
  const v = $('mainVideo'), lbl = $('loopLbl');
  if (BP.loop.state === 0) {
    BP.loop.a = v.currentTime; BP.loop.state = 1;
    if (lbl) lbl.textContent = 'B?'; flash('🔁 A=' + fmt(BP.loop.a));
    if ($('btnLoop')) $('btnLoop').classList.add('active');
  } else if (BP.loop.state === 1) {
    BP.loop.b = v.currentTime;
    if (BP.loop.b <= BP.loop.a) { BP.loop.state = 0; if (lbl) lbl.textContent = 'A-B'; return; }
    BP.loop.active = true; BP.loop.state = 2;
    if (lbl) lbl.textContent = 'ON'; flash('🔁 LOOP ON');
  } else {
    BP.loop.active = false; BP.loop.a = -1; BP.loop.b = -1; BP.loop.state = 0;
    if (lbl) lbl.textContent = 'A-B'; if ($('btnLoop')) $('btnLoop').classList.remove('active');
    flash('🔁 LOOP OFF');
  }
  updateTogglesBar();
}

function checkLoopAB() {
  if (!BP.loop.active || BP.loop.a < 0 || BP.loop.b < 0) return;
  const v = $('mainVideo');
  if (v.currentTime >= BP.loop.b) v.currentTime = BP.loop.a;
}


// ─── CLIP TIME PARSER & EDITABLE CONTROLS ─────────────────────────────────────
function parseTimeToSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const parts = str.trim().split(':').map(p => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function updateClipUI(fromAuto = false) {
  const startInp = $('inpClipStart');
  const endInp   = $('inpClipEnd');
  const durInp   = $('inpClipDur');
  const validLbl = $('clipTimeValid');
  const downBtn  = $('btnDownClip');

  if (startInp && BP.c.a >= 0) startInp.value = fmt(BP.c.a);
  if (endInp && BP.c.b >= 0)   endInp.value   = fmt(BP.c.b);

  if (BP.c.a >= 0 && BP.c.b > BP.c.a) {
    const dur = BP.c.b - BP.c.a;
    if (durInp) {
      durInp.value = fmt(dur);
      durInp.style.color = dur > BP.c.maxSec ? 'var(--danger)' : 'var(--ac)';
    }
    if (validLbl) {
      if (dur > BP.c.maxSec) {
        validLbl.textContent = '⚠ Maximum clip duration is 10 minutes!';
        validLbl.style.color = 'var(--danger)';
      } else {
        validLbl.textContent = '✓ Ready to download (' + fmt(dur) + ')';
        validLbl.style.color = 'var(--success)';
      }
    }
    if (downBtn) downBtn.disabled = (dur > BP.c.maxSec);

    // Auto-download if enabled and not already recording
    const chkAuto = $('chkAutoDownload');
    if (fromAuto && chkAuto && chkAuto.checked && dur <= BP.c.maxSec && !BP.c.recording) {
      flash('⚡ Auto-starting clip download...');
      setTimeout(() => downloadClip(), 300);
    }
  } else {
    if (durInp) durInp.value = '0:00:00';
    if (validLbl) {
      validLbl.textContent = 'Set Start and End times';
      validLbl.style.color = 'var(--text3)';
    }
    if (downBtn) downBtn.disabled = true;
  }
}

function onManualClipChange(type) {
  const startInp = $('inpClipStart');
  const endInp   = $('inpClipEnd');
  const durInp   = $('inpClipDur');

  if (type === 'start' && startInp) {
    BP.c.a = parseTimeToSeconds(startInp.value);
    if (BP.c.b <= BP.c.a) BP.c.b = BP.c.a + 10;
  } else if (type === 'end' && endInp) {
    BP.c.b = parseTimeToSeconds(endInp.value);
    if (BP.c.a < 0) BP.c.a = 0;
  } else if (type === 'dur' && durInp) {
    const dur = parseTimeToSeconds(durInp.value);
    if (BP.c.a < 0) BP.c.a = $('mainVideo').currentTime || 0;
    BP.c.b = BP.c.a + Math.min(BP.c.maxSec, Math.max(1, dur));
  }

  updateClipUI(true);
}

function addClipDur(secs) {
  const v = $('mainVideo');
  if (BP.c.a < 0) BP.c.a = v ? v.currentTime : 0;
  BP.c.b = BP.c.a + secs;
  updateClipUI(true);
}

function setClipA() {
  const v = $('mainVideo');
  BP.c.a = v ? v.currentTime : 0;
  flash('🎬 START (A): ' + fmt(BP.c.a));
  updateClipUI(false);
}

function setClipB() {
  const v = $('mainVideo');
  BP.c.b = v ? v.currentTime : 0;
  if (BP.c.a < 0) BP.c.a = Math.max(0, BP.c.b - 10);
  if (BP.c.b <= BP.c.a) BP.c.b = BP.c.a + 10;
  flash('🏁 END (B): ' + fmt(BP.c.b));
  updateClipUI(true); // Triggers auto-download if enabled!
}

function clearClip() {
  BP.c.a = -1; BP.c.b = -1;
  const startInp = $('inpClipStart'); if (startInp) startInp.value = '0:00:00';
  const endInp   = $('inpClipEnd');   if (endInp)   endInp.value   = '0:00:00';
  const durInp   = $('inpClipDur');   if (durInp)   { durInp.value = '0:00:00'; durInp.style.color = ''; }
  const validLbl = $('clipTimeValid'); if (validLbl) { validLbl.textContent = 'Set Start and End times'; validLbl.style.color = 'var(--text3)'; }
  const downBtn  = $('btnDownClip');  if (downBtn)  downBtn.disabled = true;
  const prog     = $('clipProgressWrap'); if (prog) prog.classList.add('hidden');
}

function getBestRecorderMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4'
  ];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

async function downloadClip() {
  if (BP.c.a < 0 || BP.c.b <= BP.c.a) { flash('⚠ SET START (A) & END (B) FIRST'); return; }
  const dur = BP.c.b - BP.c.a;
  if (dur > BP.c.maxSec) { flash('⚠ CLIP CANNOT EXCEED 10 MINUTES'); return; }

  const v = $('mainVideo');
  if (!v.src) { flash('⚠ NO VIDEO LOADED'); return; }

  let stream = null;
  try {
    stream = v.captureStream ? v.captureStream() : (v.mozCaptureStream ? v.mozCaptureStream() : null);
  } catch (e) {
    console.warn('captureStream error:', e);
  }

  if (!stream) {
    flash('⚠ BROWSER CANNOT CAPTURE THIS STREAM');
    return;
  }

  const mimeType = getBestRecorderMimeType();
  BP.c.chunks = [];

  try {
    BP.c.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (e) {
    console.warn('MediaRecorder with mimeType failed, falling back:', e);
    BP.c.recorder = new MediaRecorder(stream);
  }

  BP.c.recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) BP.c.chunks.push(e.data);
  };

  BP.c.recorder.onstop = () => {
    clearInterval(BP.c.timer);
    BP.c.recording = false;
    const prog = $('clipProgressWrap'); if (prog) prog.classList.add('hidden');
    const stopBtn = $('btnStopClip'); if (stopBtn) stopBtn.style.display = 'none';
    const downBtn = $('btnDownClip'); if (downBtn) { downBtn.disabled = false; downBtn.textContent = '⬇ Download Clip'; }

    if (BP.c.chunks.length === 0) {
      flash('⚠ NO RECORDED DATA');
      return;
    }

    const ext = (mimeType && mimeType.includes('mp4')) ? 'mp4' : 'webm';
    const blob = new Blob(BP.c.chunks, { type: mimeType || 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cleanTitle(BP.media.title || 'BetaPlayer')}_Clip_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash('💾 CLIP DOWNLOADED AUTOMATICALLY!');
  };

  // Start recording
  BP.c.recording = true;
  v.currentTime = BP.c.a;
  await new Promise(r => setTimeout(r, 200));

  v.play().catch(() => {});
  BP.c.recorder.start(250);

  // Progress UI
  const prog = $('clipProgressWrap'); if (prog) prog.classList.remove('hidden');
  const stopBtn = $('btnStopClip'); if (stopBtn) stopBtn.style.display = 'inline-block';
  const downBtn = $('btnDownClip'); if (downBtn) { downBtn.disabled = true; downBtn.textContent = '🔴 Recording...'; }

  const startTime = Date.now();
  BP.c.timer = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const pct = Math.min(100, Math.round((elapsed / dur) * 100));
    if ($('clipProgFill')) $('clipProgFill').style.width = pct + '%';
    if ($('clipProgPct'))  $('clipProgPct').textContent  = pct + '%';
    if ($('clipProgLabel')) $('clipProgLabel').textContent = `🔴 Recording (${fmt(elapsed)} / ${fmt(dur)})`;

    if (elapsed >= dur || v.currentTime >= BP.c.b) {
      clearInterval(BP.c.timer);
      if (BP.c.recorder && BP.c.recorder.state === 'recording') {
        BP.c.recorder.stop();
        v.pause();
      }
    }
  }, 200);
}

function stopClipEarly() {
  if (BP.c.recorder && BP.c.recorder.state === 'recording') {
    clearInterval(BP.c.timer);
    BP.c.recorder.stop();
    const v = $('mainVideo'); if (v) v.pause();
    flash('⏹ RECORDING STOPPED & SAVED');
  }
}


// ─── IN-BUILT SUBTITLES (Telegram / MKV / MP4 embedded tracks) ────────────────
function detectInbuildSubtitles() {
  const v = $('mainVideo');
  if (!v) return;
  const tt = v.textTracks;
  BP.s.inbuildTracks = [];

  if (!tt || tt.length === 0) {
    updateInbuildSubUI([]);
    return;
  }

  for (let i = 0; i < tt.length; i++) {
    const t = tt[i];
    if (t.kind === 'subtitles' || t.kind === 'captions' || !t.kind) {
      BP.s.inbuildTracks.push({
        index: i,
        label: t.label || `Track ${i + 1} (${t.language || 'Embedded'})`,
        lang: t.language || '',
        isDefault: t.default,
        track: t
      });
    }
  }

  updateInbuildSubUI(BP.s.inbuildTracks);

  // Auto-activate in-built subtitles if enabled and no manual SRT file is loaded
  if (BP.s.inbuildTracks.length > 0 && BP.s.enabled && !BP.s.file) {
    const defaultTrack = BP.s.inbuildTracks.find(t => t.isDefault) ||
                         BP.s.inbuildTracks.find(t => /eng|tam|ta|en/i.test(t.label || t.lang)) ||
                         BP.s.inbuildTracks[0];
    selectInbuildSubTrack(defaultTrack.index);
  }
}

function updateInbuildSubUI(tracks) {
  // Update Quick Panel Dropdown
  const sqpSel = $('sqpInbuildSel');
  if (sqpSel) {
    if (tracks.length > 0) {
      sqpSel.style.display = 'inline-block';
      sqpSel.innerHTML = '<option value="-1">Subtitles: Off</option>' +
        tracks.map(t => `<option value="${t.index}">${t.label}</option>`).join('');
      sqpSel.value = BP.s.inbuildIndex;
    } else {
      sqpSel.style.display = 'none';
    }
  }

  // Update Inbuild tab in Subtitle modal
  const container = $('inbuildTrackList');
  if (container) {
    if (!tracks.length) {
      container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">No in-built subtitle tracks found in this video. You can load external .SRT/.VTT files from the Load File tab.</div>';
      return;
    }
    container.innerHTML = tracks.map(t => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:10px 14px;border-radius:8px;border:1px solid ${BP.s.inbuildIndex === t.index ? 'var(--ac)' : 'var(--border)'}">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${t.label}</div>
          <div style="font-size:11px;color:var(--text2)">Language: ${t.lang || 'N/A'} ${t.isDefault ? '· (Default)' : ''}</div>
        </div>
        <button class="btn ${BP.s.inbuildIndex === t.index ? 'btn-p' : ''}" style="padding:5px 12px;font-size:11px" onclick="selectInbuildSubTrack(${t.index})">
          ${BP.s.inbuildIndex === t.index ? 'Active ✓' : 'Select'}
        </button>
      </div>
    `).join('') + `
      <button class="btn btn-d" style="margin-top:6px;width:fit-content" onclick="selectInbuildSubTrack(-1)">Disable In-built Subtitles</button>
    `;
  }
}

function selectInbuildSubTrack(index) {
  const v = $('mainVideo');
  if (!v || !v.textTracks) return;

  // Turn off previous
  for (let i = 0; i < v.textTracks.length; i++) {
    v.textTracks[i].mode = 'disabled';
    v.textTracks[i].oncuechange = null;
  }

  if (index === -1) {
    BP.s.inbuildIndex = -1;
    if ($('sqpCurrent')) $('sqpCurrent').textContent = 'Subtitles Off';
    if ($('sqpInbuildSel')) $('sqpInbuildSel').value = '-1';
    const overlay = $('subOverlay'); if (overlay && !BP.s.cues.length) overlay.classList.add('hidden');
    updateInbuildSubUI(BP.s.inbuildTracks);
    flash('💬 In-built Subtitles Off');
    updateTogglesBar();
    return;
  }

  const track = v.textTracks[index];
  if (!track) return;

  BP.s.inbuildIndex = index;
  BP.s.enabled = true;
  // 'hidden' allows javascript to read cues via oncuechange while preventing duplicate native rendering
  track.mode = 'hidden';

  track.oncuechange = () => {
    if (!BP.s.enabled || BP.s.inbuildIndex !== index) return;
    const activeCues = track.activeCues;
    const box = $('subBox');
    const overlay = $('subOverlay');
    if (activeCues && activeCues.length > 0) {
      let txt = '';
      for (let i = 0; i < activeCues.length; i++) {
        txt += (activeCues[i].text || '').replace(/<[^>]*>/g, '') + ' ';
      }
      if (box) box.textContent = txt.trim();
      if (overlay) overlay.classList.remove('hidden');
    } else {
      if (overlay && !BP.s.cues.length) overlay.classList.add('hidden');
    }
  };

  const label = track.label || `Track ${index + 1} (${track.language || 'in-built'})`;
  if ($('sqpCurrent')) $('sqpCurrent').textContent = 'In-built: ' + label;
  if ($('sqpInbuildSel')) $('sqpInbuildSel').value = index;
  if ($('ccDot')) $('ccDot').classList.remove('hidden');
  updateInbuildSubUI(BP.s.inbuildTracks);
  flash(`💬 Subtitles: ${label}`);
  updateTogglesBar();
}

// ─── EXTERNAL SUBTITLES (.SRT / .VTT / .ASS) ──────────────────────────────────
function parseSRT(txt) {
  const cues = [];
  const re = /\d+\s*\n(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n([\s\S]*?)(?=\n\s*\n|\n*$)/g;
  const toSec = s => {
    const p = s.replace(',', '.').split(':');
    return +p[0] * 3600 + +p[1] * 60 + +p[2];
  };
  let m;
  while ((m = re.exec(txt)) !== null) {
    cues.push({ start: toSec(m[1]), end: toSec(m[2]), text: m[3].replace(/<[^>]*>/g, '').trim() });
  }
  return cues;
}

function loadSubFile(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    BP.s.cues = parseSRT(e.target.result);
    BP.s.file = f.name;
    // Turn off in-built if manual is loaded
    if (BP.s.inbuildIndex >= 0) selectInbuildSubTrack(-1);
    if ($('subFileInfo')) $('subFileInfo').textContent = 'Loaded: ' + f.name;
    if ($('sqpCurrent'))  $('sqpCurrent').textContent  = f.name;
    if ($('ccDot'))       $('ccDot').classList.remove('hidden');
    flash('💬 SUBS: ' + f.name);
    updateTogglesBar();
  };
  r.readAsText(f);
  input.value = '';
}

function clearSubs() {
  BP.s.cues = [];
  BP.s.file = '';
  selectInbuildSubTrack(-1);
  if ($('subFileInfo')) $('subFileInfo').textContent = 'No subtitle file loaded';
  if ($('sqpCurrent'))  $('sqpCurrent').textContent  = 'None loaded';
  if ($('ccDot'))       $('ccDot').classList.add('hidden');
  if ($('subOverlay'))  $('subOverlay').classList.add('hidden');
  flash('💬 SUBS CLEARED');
  updateTogglesBar();
}

function toggleSubs() {
  BP.s.enabled = !BP.s.enabled;
  if (!BP.s.enabled) {
    const overlay = $('subOverlay'); if (overlay) overlay.classList.add('hidden');
  }
  flash(BP.s.enabled ? '💬 SUBS ON' : '💬 SUBS OFF');
  updateTogglesBar();
}

function renderSubs() {
  const v = $('mainVideo'), overlay = $('subOverlay'), box = $('subBox');
  if (!BP.s.enabled) { if (overlay) overlay.classList.add('hidden'); return; }

  // 1. Check external cues
  if (BP.s.cues.length) {
    const t = v.currentTime + BP.s.offset;
    const cue = BP.s.cues.find(c => t >= c.start && t <= c.end);
    if (cue && overlay && box) {
      box.textContent = cue.text;
      overlay.classList.remove('hidden');
      return;
    }
  }

  // 2. Check in-built text track cues
  if (BP.s.inbuildIndex >= 0 && v.textTracks && v.textTracks[BP.s.inbuildIndex]) {
    const track = v.textTracks[BP.s.inbuildIndex];
    const active = track.activeCues;
    if (active && active.length > 0 && overlay && box) {
      let txt = '';
      for (let i = 0; i < active.length; i++) txt += (active[i].text || '').replace(/<[^>]*>/g, '') + ' ';
      box.textContent = txt.trim();
      overlay.classList.remove('hidden');
      return;
    }
  }

  if (overlay) overlay.classList.add('hidden');
}

function applySubStyle() {
  [$('subBox'), $('subPreview')].forEach(el => {
    if (!el) return;
    el.style.fontFamily = BP.s.fontCss || BP.s.font || 'Inter,sans-serif';
    el.style.fontSize   = BP.s.size + 'px';
    el.style.color      = BP.s.color;
    el.style.backgroundColor = BP.s.bg && BP.s.bg !== 'rgba(0,0,0,0)'
      ? `color-mix(in srgb, ${BP.s.bg} ${Math.round(BP.s.opacity * 100)}%, transparent)`
      : 'transparent';
  });
}

function toggleSubPanel() { const p = $('subQuickPanel'); if (p) p.classList.toggle('hidden'); }
function hideSubPanel()   { const p = $('subQuickPanel'); if (p) p.classList.add('hidden'); }

// ─── VISUALIZER ──────────────────────────────────────────────────────────────
function showMusicStudio(title, artist, poster) {
  const ms = $('musicStudio'); if (!ms) return;
  ms.classList.remove('hidden');
  if ($('trackTitle'))  $('trackTitle').textContent  = title;
  if ($('trackArtist')) $('trackArtist').textContent = artist + ' · Beta Player';
  if ($('vinylCover'))  $('vinylCover').src          = poster;
  startViz();
}

function startViz() {
  stopViz();
  const canvas = $('specCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const len = BP.a.analyser ? BP.a.analyser.frequencyBinCount : 32;
  const data = new Uint8Array(len);
  function draw() {
    BP.vizId = requestAnimationFrame(draw);
    if (BP.a.analyser) BP.a.analyser.getByteFrequencyData(data);
    else for (let i = 0; i < len; i++) data[i] = 30 + Math.sin(Date.now() / 300 + i) * 20;
    ctx.fillStyle = 'rgba(8,9,15,.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bw = (canvas.width / len) * 1.5;
    for (let i = 0; i < len; i++) {
      const h = (data[i] / 255) * (canvas.height * 0.7);
      const gr = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
      gr.addColorStop(0, 'var(--ac)');
      gr.addColorStop(1, 'var(--ac2)');
      ctx.fillStyle = gr;
      ctx.fillRect(i * bw, canvas.height - h, bw - 2, h);
    }
  }
  draw();
}

function stopViz() { if (BP.vizId) { cancelAnimationFrame(BP.vizId); BP.vizId = null; } }

// ─── APPEARANCE & THEMES ─────────────────────────────────────────────────────
function applyTheme(ac, ac2, bg) {
  document.documentElement.style.setProperty('--ac', ac);
  document.documentElement.style.setProperty('--ac2', ac2);
  document.documentElement.style.setProperty('--ac-glow', hexToRgba(ac, 0.3));
  document.documentElement.style.setProperty('--ac-bg', hexToRgba(ac, 0.08));
  document.documentElement.style.setProperty('--bg', bg);
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
  saveAppearance();
  flash('🎨 ACCENT: ' + hex);
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
  BP.v.frameStyle = style;
  applyFrameStyle(style);
  saveAppearance();
}

function applyFrameStyle(style) {
  const v = $('mainVideo'); if (!v) return;
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
  v.style.boxShadow = styles[style] || 'none';
  if (style === 'dashed') {
    v.style.outline = `2px dashed ${fc}`;
    v.style.outlineOffset = '4px';
  } else {
    v.style.outline = '';
    v.style.outlineOffset = '';
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── SCREEN SHAPES ────────────────────────────────────────────────────────────
const SHAPES = [
  { id:'shape-sq', cls:'shape-sq', l:'Square' },
  { id:'shape-sm', cls:'shape-sm', l:'Slight Round' },
  { id:'shape-md', cls:'shape-md', l:'Rounded' },
  { id:'shape-lg', cls:'shape-lg', l:'Soft Round' },
  { id:'shape-xl', cls:'shape-xl', l:'Large Round' },
  { id:'shape-pill', cls:'shape-pill', l:'Pill' },
  { id:'shape-circ', cls:'shape-circ', l:'Circle' },
  { id:'shape-sqrc', cls:'shape-sqrc', l:'Squircle' },
  { id:'shape-hex', cls:'shape-hex', l:'Hexagon' },
  { id:'shape-oct', cls:'shape-oct', l:'Octagon' },
  { id:'shape-dia', cls:'shape-dia', l:'Diamond' },
  { id:'shape-prl', cls:'shape-prl', l:'Parallelogram' },
  { id:'shape-art', cls:'shape-art', l:'Arch Top' },
  { id:'shape-arb', cls:'shape-arb', l:'Arch Bot' },
  { id:'shape-tpr', cls:'shape-tpr', l:'Top Round' },
  { id:'shape-btr', cls:'shape-btr', l:'Bot Round' },
  { id:'shape-ltr', cls:'shape-ltr', l:'Left Round' },
  { id:'shape-rtr', cls:'shape-rtr', l:'Right Round' },
  { id:'shape-ntl', cls:'shape-ntl', l:'Notch TL' },
  { id:'shape-ntr', cls:'shape-ntr', l:'Notch TR' },
  { id:'shape-lf',  cls:'shape-lf',  l:'Leaf' },
  { id:'shape-egg', cls:'shape-egg', l:'Egg' },
  { id:'shape-cld', cls:'shape-cld', l:'Cloud' },
  { id:'shape-flm', cls:'shape-flm', l:'Film Frame' },
  { id:'shape-tv',  cls:'shape-tv',  l:'Classic TV' },
  { id:'shape-crv', cls:'shape-crv', l:'Curved' },
  { id:'shape-imx', cls:'shape-imx', l:'IMAX Curve' },
  { id:'shape-arr', cls:'shape-arr', l:'Arrow →' },
  { id:'shape-arl', cls:'shape-arl', l:'Arrow ←' },
  { id:'shape-str', cls:'shape-str', l:'Star' },
  { id:'shape-dbl', cls:'shape-dbl', l:'Double Ring' },
  { id:'shape-mon', cls:'shape-mon', l:'Monitor' },
  { id:'shape-ban', cls:'shape-ban', l:'Banner' },
  { id:'shape-shield', cls:'shape-shield', l:'Shield' },
  { id:'shape-wave',   cls:'shape-wave',   l:'Wave' },
  { id:'shape-trapez', cls:'shape-trapez', l:'Trapezoid' },
  { id:'shape-penta',  cls:'shape-penta',  l:'Pentagon' },
  { id:'shape-cross',  cls:'shape-cross',  l:'Cross' },
  { id:'shape-inf',    cls:'shape-inf',    l:'Infinity' },
  { id:'shape-bowtie', cls:'shape-bowtie', l:'Bowtie' },
  { id:'shape-starburst', cls:'shape-starburst', l:'Starburst' }
];

function buildShapes() {
  const g = $('shapeGrid'); if (!g) return;
  g.innerHTML = '';
  SHAPES.forEach(s => {
    const b = document.createElement('button');
    b.className = 'shape-btn' + (BP.v.shape === s.id ? ' on' : '');
    b.dataset.shape = s.id;
    b.innerHTML = `<div class="shp-prev ${s.cls}"></div><small>${s.l}</small>`;
    b.onclick = () => applyShape(s.id);
    g.appendChild(b);
  });
}

function applyShape(id) {
  const v = $('mainVideo'); if (!v) return;
  SHAPES.forEach(s => v.classList.remove(s.cls));
  v.classList.add(SHAPES.find(s => s.id === id)?.cls || '');
  BP.v.shape = id;
  $$('.shape-btn').forEach(b => b.classList.toggle('on', b.dataset.shape === id));
  localStorage.setItem('bp_shape', id);
  flash('⬛ Shape: ' + (SHAPES.find(s => s.id === id)?.l || ''));
}

// ─── PROFILE BORDER STYLES ───────────────────────────────────────────────────
const PROFILE_BORDERS = [
  { id:'circle',   label:'Circle',   css:'border-radius:50%' },
  { id:'rounded',  label:'Rounded',  css:'border-radius:16px' },
  { id:'square',   label:'Square',   css:'border-radius:0' },
  { id:'hex',      label:'Hexagon',  css:'clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)' },
  { id:'oct',      label:'Octagon',  css:'clip-path:polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)' },
  { id:'diamond',  label:'Diamond',  css:'clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%)' },
  { id:'star',     label:'Star',     css:'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' },
  { id:'squircle', label:'Squircle', css:'border-radius:40% 60% 60% 40%/40% 40% 60% 60%' }
];

function setProfileBorder(id) {
  BP.profile.borderStyle = id;
  const b = PROFILE_BORDERS.find(p => p.id === id);
  const imgs = [$('avatarImg'), $('avPrev')];
  imgs.forEach(img => {
    if (!img) return;
    img.style.cssText = (b ? b.css : 'border-radius:50%') +
      `;width:100%;height:100%;object-fit:cover;border:${BP.profile.borderWidth || 3}px solid ${BP.profile.borderColor || 'var(--ac)'}`;
  });
  $$('.pb-btn').forEach(btn => btn.classList.toggle('on', btn.dataset.border === id));
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  flash('👤 Border: ' + (b?.label || 'Default'));
}

function setProfileBorderColor(hex) {
  BP.profile.borderColor = hex;
  document.documentElement.style.setProperty('--profileBorderColor', hex);
  [$('avatarImg'), $('avPrev')].forEach(img => { if (img) img.style.borderColor = hex; });
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
}

function setProfileBorderWidth(w) {
  BP.profile.borderWidth = +w;
  [$('avatarImg'), $('avPrev')].forEach(img => { if (img) img.style.borderWidth = w + 'px'; });
  localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
}

function buildProfileBorders() {
  const grid = $('profileBorderGrid'); if (!grid) return;
  grid.innerHTML = '';
  PROFILE_BORDERS.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'pb-btn btn' + (BP.profile.borderStyle === b.id ? ' on' : '');
    btn.dataset.border = b.id;
    btn.textContent = b.label;
    btn.onclick = () => setProfileBorder(b.id);
    grid.appendChild(btn);
  });
}

// ─── SUBTITLE FONTS (30+) ─────────────────────────────────────────────────────
const SUB_FONTS = [
  { id:'inter',        name:'Inter',            css:"'Inter',sans-serif" },
  { id:'orbitron',     name:'Orbitron',          css:"'Orbitron',sans-serif" },
  { id:'jetbrains',    name:'JetBrains Mono',    css:"'JetBrains Mono',monospace" },
  { id:'roboto',       name:'Roboto',            css:"'Roboto',sans-serif" },
  { id:'lato',         name:'Lato',              css:"'Lato',sans-serif" },
  { id:'montserrat',   name:'Montserrat',        css:"'Montserrat',sans-serif" },
  { id:'opensans',     name:'Open Sans',         css:"'Open Sans',sans-serif" },
  { id:'raleway',      name:'Raleway',           css:"'Raleway',sans-serif" },
  { id:'poppins',      name:'Poppins',           css:"'Poppins',sans-serif" },
  { id:'nunito',       name:'Nunito',            css:"'Nunito',sans-serif" },
  { id:'ubuntu',       name:'Ubuntu',            css:"'Ubuntu',sans-serif" },
  { id:'exo',          name:'Exo 2',             css:"'Exo 2',sans-serif" },
  { id:'rajdhani',     name:'Rajdhani',          css:"'Rajdhani',sans-serif" },
  { id:'russo',        name:'Russo One',         css:"'Russo One',sans-serif" },
  { id:'audiowide',    name:'Audiowide',         css:"'Audiowide',sans-serif" },
  { id:'righteous',    name:'Righteous',         css:"'Righteous',cursive" },
  { id:'oswald',       name:'Oswald',            css:"'Oswald',sans-serif" },
  { id:'playfair',     name:'Playfair Display',  css:"'Playfair Display',serif" },
  { id:'merriweather', name:'Merriweather',      css:"'Merriweather',serif" },
  { id:'cinzel',       name:'Cinzel',            css:"'Cinzel',serif" },
  { id:'dancing',      name:'Dancing Script',    css:"'Dancing Script',cursive" },
  { id:'pacifico',     name:'Pacifico',          css:"'Pacifico',cursive" },
  { id:'lobster',      name:'Lobster',           css:"'Lobster',cursive" },
  { id:'satisfy',      name:'Satisfy',           css:"'Satisfy',cursive" },
  { id:'caveat',       name:'Caveat',            css:"'Caveat',cursive" },
  { id:'sourcecodepro',name:'Source Code Pro',   css:"'Source Code Pro',monospace" },
  { id:'firacode',     name:'Fira Code',         css:"'Fira Code',monospace" },
  { id:'cousine',      name:'Cousine',           css:"'Cousine',monospace" },
  { id:'georgia',      name:'Georgia',           css:"Georgia,serif" },
  { id:'verdana',      name:'Verdana',           css:"Verdana,sans-serif" },
  { id:'impact',       name:'Impact',            css:"Impact,sans-serif" },
  { id:'arial',        name:'Arial',             css:"Arial,sans-serif" },
  { id:'tahoma',       name:'Tahoma',            css:"Tahoma,sans-serif" }
];

function buildSubFonts() {
  const grid = $('subFontGrid'); if (!grid) return;
  grid.innerHTML = '';
  SUB_FONTS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'sub-font-btn' + (BP.s.font === f.id ? ' on' : '');
    btn.style.fontFamily = f.css;
    btn.textContent = f.name;
    btn.onclick = () => {
      BP.s.font = f.id; BP.s.fontCss = f.css;
      $$('.sub-font-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      applySubStyle(); flash('💬 Font: ' + f.name);
    };
    grid.appendChild(btn);
  });
}

// ─── SUBTITLE COLORS (40+) ────────────────────────────────────────────────────
const SUB_COLOR_PALETTE = [
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1',
  '#ffff00','#fbbf24','#f97316','#ef4444','#dc2626',
  '#10b981','#22c55e','#84cc16','#a3e635','#4ade80',
  '#06b6d4','#38bdf8','#60a5fa','#818cf8','#a78bfa',
  '#c084fc','#e879f9','#f472b6','#fb7185','#f43f5e',
  '#ff6b6b','#ffa502','#ff7675','#fd79a8','#e17055',
  '#00cec9','#55efc4','#81ecec','#74b9ff','#a29bfe',
  '#636e72','#2d3436','#b2bec3','#dfe6e9','#000000',
  '#1a1a2e','#16213e','#0f3460','#533483','#e94560'
];

function buildSubColors() {
  const grid = $('subColorGrid'); if (!grid) return;
  grid.innerHTML = '';
  SUB_COLOR_PALETTE.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'sub-color-chip' + (BP.s.color === c ? ' on' : '');
    btn.style.cssText = `background:${c};border-color:${BP.s.color === c ? '#fff' : 'transparent'}`;
    btn.title = c;
    btn.onclick = () => {
      BP.s.color = c;
      $$('.sub-color-chip').forEach(b => { b.classList.remove('on'); b.style.borderColor = 'transparent'; });
      btn.classList.add('on'); btn.style.borderColor = '#fff';
      if ($('subColorPicker')) $('subColorPicker').value = c;
      applySubStyle(); flash('💬 Color: ' + c);
    };
    grid.appendChild(btn);
  });
}

function buildSubBgColors() {
  const grid = $('subBgGrid'); if (!grid) return;
  const bgColors = ['#000000','#1a1a1a','#0f172a','#1e1b4b','#1c1917','rgba(0,0,0,0)','#ffffff20','#00000080','#00000099'];
  grid.innerHTML = '';
  bgColors.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'sub-color-chip';
    btn.style.cssText = `background:${c};border:2px solid #444;position:relative`;
    if (c === 'rgba(0,0,0,0)' || c.endsWith('0)')) {
      btn.innerHTML = '<span style="font-size:9px;color:#fff">None</span>';
    }
    btn.onclick = () => { BP.s.bg = c; applySubStyle(); flash('💬 BG: ' + c); };
    grid.appendChild(btn);
  });
}

// ─── TOGGLES BAR ─────────────────────────────────────────────────────────────
function buildTogglesBar() { updateTogglesBar(); }

function updateTogglesBar() {
  setToggle('tgLoop', BP.loop.active);
  setToggle('tgSubs', BP.s.enabled && (BP.s.cues.length > 0 || BP.s.inbuildIndex >= 0));
  setToggle('tgMute', BP.a.vol === 0);
  setToggle('tgHp',   BP.a.mode === 'headphones');
  setToggle('tg3D',   BP.v.dim !== 'off');
}

function setToggle(id, state) {
  const el = $(id); if (!el) return;
  el.classList.toggle('tg-on', state);
}

// ─── RIGHT-CLICK CONTEXT MENU ────────────────────────────────────────────────
function setupContextMenu() {
  const co = $('clickOverlay'); const menu = $('ctxMenu'); if (!co || !menu) return;
  co.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (BP.screenLocked) {
      showLockedHint();
      return;
    }
    menu.style.cssText = `display:block;left:${Math.min(e.clientX, window.innerWidth - 180)}px;top:${Math.min(e.clientY, window.innerHeight - 320)}px`;
  });
  document.addEventListener('click', () => { if (menu) menu.style.display = 'none'; });
  document.addEventListener('keydown', e => {
    if (BP.screenLocked) {
      if (e.key.toLowerCase() === 'l') {
        toggleScreenLock();
      } else {
        showLockedHint();
      }
      return;
    }
    if (e.key === 'Escape' && menu) menu.style.display = 'none';
  });
}

function ctxAction(fn) {
  const m = $('ctxMenu'); if (m) m.style.display = 'none';
  if (typeof fn === 'function') fn();
}

// ─── MOUSE SCROLL = VOLUME (Up to 1000% Boost) ──────────────────────────────
function setupScrollVolume() {
  const wrap = $('videoWrap'); if (!wrap) return;
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    if (BP.screenLocked) { showLockedHint(); return; }
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const nv = Math.max(0, Math.min(10, +(BP.a.vol + delta).toFixed(2)));
    setVol(nv);
    showHUD(delta > 0 ? '🔊' : '🔉', Math.round(nv * 100) + (nv > 1 ? '% BOOST' : '%'));
  }, { passive: false });
}

// ─── GENRE PLAYLISTS ─────────────────────────────────────────────────────────
function loadGenreLists() {
  try { BP.genreLists = JSON.parse(localStorage.getItem('bp_genre_lists') || '{}'); }
  catch { BP.genreLists = {}; }
}

function saveGenreLists() {
  localStorage.setItem('bp_genre_lists', JSON.stringify(BP.genreLists));
}

function createGenreList(name) {
  name = (name || '').trim(); if (!name) return;
  if (!BP.genreLists) BP.genreLists = {};
  if (!BP.genreLists[name]) BP.genreLists[name] = [];
  saveGenreLists();
  renderGenreListsModal();
  renderGenreSidebar();
  flash('📂 Created: ' + name);
}

function deleteGenreList(name) {
  if (!confirm('Delete playlist "' + name + '"?')) return;
  delete BP.genreLists[name];
  saveGenreLists();
  renderGenreListsModal();
  renderGenreSidebar();
  flash('🗑 Deleted: ' + name);
}

function addItemToGenreList(listName, itemId) {
  if (!BP.genreLists) BP.genreLists = {};
  if (!BP.genreLists[listName]) BP.genreLists[listName] = [];
  if (!BP.genreLists[listName].includes(itemId)) BP.genreLists[listName].push(itemId);
  saveGenreLists();
  renderGenreListsModal();
  flash('➕ Added to ' + listName);
}

function removeItemFromGenreList(listName, itemId) {
  if (!BP.genreLists || !BP.genreLists[listName]) return;
  BP.genreLists[listName] = BP.genreLists[listName].filter(id => id !== itemId);
  saveGenreLists();
  renderGenreListsModal();
}

function renderGenreListsModal() {
  const container = $('glContainer'); if (!container) return;
  if (!BP.genreLists) BP.genreLists = {};
  const names = Object.keys(BP.genreLists);
  if (!names.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:32px">No custom genre lists yet. Create one above!</div>';
    return;
  }
  container.innerHTML = '';
  names.forEach(name => {
    const ids = BP.genreLists[name] || [];
    const items = ids.map(id => BP.playlist.find(p => p.id === id)).filter(Boolean);
    const div = document.createElement('div');
    div.className = 'gl-block';
    const addOpts = BP.playlist.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    div.innerHTML = `
      <div class="gl-hdr">
        <span class="gl-name">📂 ${name}</span>
        <span class="gl-cnt">${items.length} films</span>
        <button class="btn btn-d" style="padding:4px 10px;font-size:11px" onclick="deleteGenreList(${JSON.stringify(name)})">🗑</button>
      </div>
      <div class="gl-items">
        ${items.length ? items.map(it => `
          <div class="gl-item" onclick="playPlaylistItem(${JSON.stringify(it).replace(/"/g, '&quot;')})">
            <img src="${it.poster || ''}" class="gl-thumb" loading="lazy">
            <div class="gl-info"><div class="gl-title">${it.title}</div><div class="gl-year">${it.year || ''}</div></div>
            <button onclick="event.stopPropagation();removeItemFromGenreList(${JSON.stringify(name)},${it.id})" class="btn btn-d" style="opacity:.6;padding:2px 6px;font-size:11px">✕</button>
          </div>
        `).join('') : '<div style="color:var(--text3);font-size:12px;padding:12px">Empty — add movies from your library!</div>'}
      </div>
      <div class="gl-add-row">
        <span style="font-size:12px;color:var(--text2)">Add movie:</span>
        <select class="fi fi-sel" style="flex:1;padding:6px;font-size:12px" onchange="if(this.value){addItemToGenreList(${JSON.stringify(name)},+this.value);this.value=''}">
          <option value="">Select movie...</option>${addOpts}
        </select>
      </div>`;
    container.appendChild(div);
  });
}

function renderGenreSidebar() {
  const sb = $('genreSidebar'); if (!sb) return;
  if (!BP.genreLists) BP.genreLists = {};
  const names = Object.keys(BP.genreLists);
  sb.innerHTML = names.slice(0, 5).map(name =>
    `<button class="mn-btn" onclick="openM('mGenreLists');" title="${name}">📂<span class="lbl">${name.replace(/^[^\w]*/, '').substring(0, 7)}</span></button>`
  ).join('');
}

// ─── CLICK OVERLAY ───────────────────────────────────────────────────────────
function setupClickOverlay() {
  const co = $('clickOverlay'); if (!co) return;
  let clickTimer = null, lastTap = 0;

  co.addEventListener('click', () => {
    if (BP.screenLocked) {
      showLockedHint();
      return;
    }
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(clickTimer); lastTap = 0; toggleFullscreen(); return;
    }
    lastTap = now;
    clickTimer = setTimeout(() => { lastTap = 0; togglePlay(); }, 200);
  });

  co.addEventListener('touchend', e => {
    if (BP.screenLocked) {
      e.preventDefault();
      showLockedHint();
      return;
    }
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(clickTimer); lastTap = 0; toggleFullscreen(); return;
    }
    lastTap = now;
    clickTimer = setTimeout(() => { lastTap = 0; togglePlay(); }, 200);
  });

  co.style.display = 'none';
}

// ─── MODAL HELPERS ───────────────────────────────────────────────────────────
function openM(id) {
  const m = $(id); if (m) m.classList.remove('hidden');
  if (id === 'mAppearance') buildShapes();
  if (id === 'mSubtitle')   { buildSubFonts(); buildSubColors(); buildSubBgColors(); }
  if (id === 'mGenreLists') renderGenreListsModal();
  if (id === 'mProfile')    buildProfileBorders();
}

function closeM(id) { const m = $(id); if (m) m.classList.add('hidden'); }
function closeAll()  { $$('.modal-back').forEach(m => m.classList.add('hidden')); hideSubPanel(); }
function onBdClick(e, id) { if (e.target === e.currentTarget) closeM(id); }

function switchTab(el, paneId) {
  const modal = el.closest('.modal-back');
  if (modal) {
    modal.querySelectorAll('.m-tab').forEach(t => t.classList.remove('on'));
    modal.querySelectorAll('.m-pane').forEach(p => p.classList.remove('on'));
  }
  el.classList.add('on');
  const pane = $(paneId); if (pane) pane.classList.add('on');
}

function togglePlaylistPanel() {
  const p = $('playlistPanel'); if (p) p.classList.toggle('collapsed');
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────
function exportBackup() {
  const data = {
    v: '2.0', app: 'Beta Player', at: new Date().toISOString(),
    profile: BP.profile,
    playlist: BP.playlist,
    genreLists: BP.genreLists
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'BetaPlayer_Backup.json'; a.click(); URL.revokeObjectURL(a.href);
  flash('💾 BACKUP EXPORTED');
}

function importBackup(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.playlist) { BP.playlist = d.playlist; persistLocalPlaylist(); renderPlaylist(); renderLibrary(); }
      if (d.profile)  { BP.profile = d.profile; applyProfileUI(); }
      if (d.genreLists) { BP.genreLists = d.genreLists; saveGenreLists(); renderGenreListsModal(); renderGenreSidebar(); }
      flash('📥 BACKUP RESTORED');
    } catch {
      flash('⚠ INVALID BACKUP');
    }
  };
  r.readAsText(f); input.value = '';
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────
function onDragOver(e) { e.preventDefault(); $('dropzone').classList.add('drag-active'); }
function onDragLeave()  { $('dropzone').classList.remove('drag-active'); }
function onDrop(e) {
  e.preventDefault();
  $('dropzone').classList.remove('drag-active');
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (/\.(srt|vtt|ass)$/i.test(f.name)) {
    const r = new FileReader();
    r.onload = ev => {
      BP.s.cues = parseSRT(ev.target.result);
      BP.s.file = f.name;
      flash('💬 SUBS: ' + f.name);
      updateTogglesBar();
    };
    r.readAsText(f);
  } else {
    loadFromFile(f);
  }
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
    const r = JSON.parse(localStorage.getItem('bp_appearance') || 'null');
    if (r) {
      if (r.ac) {
        document.documentElement.style.setProperty('--ac', r.ac);
        document.documentElement.style.setProperty('--ac-glow', hexToRgba(r.ac, 0.3));
        document.documentElement.style.setProperty('--ac-bg', hexToRgba(r.ac, 0.08));
      }
      if (r.ac2) document.documentElement.style.setProperty('--ac2', r.ac2);
      if (r.frameColor) document.documentElement.style.setProperty('--frame-color', r.frameColor);
      if (r.frameStyle) BP.v.frameStyle = r.frameStyle;
    }
  } catch {}
  const shape = localStorage.getItem('bp_shape');
  if (shape) {
    BP.v.shape = shape;
    const v = $('mainVideo');
    if (v) {
      SHAPES.forEach(s => v.classList.remove(s.cls));
      v.classList.add(SHAPES.find(s => s.id === shape)?.cls || '');
    }
  }
  const spd = localStorage.getItem('bp_speed');
  if (spd) {
    BP.v.speed = +spd;
    const v = $('mainVideo');
    if (v) v.playbackRate = +spd;
    if ($('speedBadge')) $('speedBadge').textContent = spd + 'x Speed';
  }
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
function setupKeyboard() {
  window.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    const ob = $('onboardingOverlay');
    if (ob && !ob.classList.contains('hidden')) return;

    // Distraction-Proof Screen Lock Guard
    if (BP.screenLocked) {
      if (e.code === 'KeyL') {
        e.preventDefault();
        e.stopPropagation();
        toggleScreenLock();
      } else {
        e.preventDefault();
        e.stopPropagation();
        showLockedHint();
      }
      return;
    }

    switch (e.code) {
      case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':  case 'KeyJ': e.preventDefault(); seekBy(-10); break;
      case 'ArrowRight': e.preventDefault(); seekBy(+10); break;
      case 'KeyL': e.preventDefault(); toggleScreenLock(); break;
      case 'Backslash': e.preventDefault(); toggleSidebar(); break;
      case 'ArrowUp':    e.preventDefault(); setVol(Math.min(10, +(BP.a.vol + 0.1).toFixed(2))); showHUD('🔊', Math.round(BP.a.vol * 100) + (BP.a.vol > 1 ? '% BOOST' : '%')); break;
      case 'ArrowDown':  e.preventDefault(); setVol(Math.max(0, +(BP.a.vol - 0.1).toFixed(2))); showHUD('🔉', Math.round(BP.a.vol * 100) + '%'); break;
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
      case 'BracketLeft':  e.preventDefault(); setSpd(Math.max(0.25, +(BP.v.speed - 0.25).toFixed(2))); break;
      case 'BracketRight': e.preventDefault(); setSpd(Math.min(6, +(BP.v.speed + 0.25).toFixed(2))); break;
      case 'Digit1': e.preventDefault(); setSpd(1); break;
      case 'Digit2': e.preventDefault(); setSpd(2); break;
      case 'Digit3': e.preventDefault(); setSpd(0.5); break;
      case 'Escape':
        const qsp = $('quickSettingsPop');
        if (qsp && !qsp.classList.contains('hidden')) { qsp.classList.add('hidden'); return; }
        closeAll();
        break;
    }
  });
}

// ─── MODERN TOOLTIP BADGE SYSTEM (Action + Shortcut pill) ─────────────────────
function setupTooltips() {
  const tip = $('bpTooltip');
  const tipTxt = $('bpTipText');
  const tipKbd = $('bpTipKbd');
  if (!tip || !tipTxt || !tipKbd) return;

  const showTooltip = el => {
    if (BP.screenLocked) return;

    let title = el.getAttribute('data-orig-title') || el.getAttribute('title') || '';
    if (!title && el.getAttribute('data-tip')) {
      title = el.getAttribute('data-tip');
      if (el.getAttribute('data-kbd')) title += ` (${el.getAttribute('data-kbd')})`;
    }
    if (!title) return;

    // Cache original title to prevent default OS tooltip
    if (el.hasAttribute('title')) {
      el.setAttribute('data-orig-title', title);
      el.removeAttribute('title');
    }

    // Parse: e.g. "Play/Pause (Space)" => text: "Play/Pause", kbd: "Space"
    let text = title;
    let kbd = '';
    const match = title.match(/^(.*?)\s*\((.+?)\)$/);
    if (match) {
      text = match[1].trim();
      kbd = match[2].trim();
    }

    tipTxt.textContent = text;
    if (kbd) {
      tipKbd.textContent = kbd;
      tipKbd.style.display = 'inline-block';
    } else {
      tipKbd.style.display = 'none';
    }

    tip.classList.remove('hidden');
    tip.classList.add('visible');

    const rect = el.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    let top = rect.top - tipRect.height - 8;

    if (top < 10) top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (left + tipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tipRect.width - 10;
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    tip.classList.remove('visible');
    tip.classList.add('hidden');
  };

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[title], [data-orig-title], [data-tip], .cb, .hdr-btn, .mn-btn, .qsp-chip, .btn');
    if (el) showTooltip(el);
  }, true);

  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[title], [data-orig-title], [data-tip], .cb, .hdr-btn, .mn-btn, .qsp-chip, .btn');
    if (el) hideTooltip();
  }, true);

  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('click', hideTooltip, true);
}

// ─── BOOT ENTRY POINT ────────────────────────────────────────────────────────
async function boot() {
  loadAppearance();
  unlockAudioOnGesture();

  loadProfile();
  const isNew = checkNewUser();
  runBoot();
  if (isNew) {
    setTimeout(() => showOnboarding(), 1400);
  }

  setupKeyboard();
  setupScrubber();
  setupOrbit();
  setupClickOverlay();
  setupAutoHideControls();
  applySubStyle();
  buildShapes();

  setupContextMenu();
  setupScrollVolume();
  setupTooltips();

  // Restore sidebar collapse preference
  if (localStorage.getItem('bp_sidebar_hidden') === '1') {
    const sh = $('shell');
    if (sh) sh.classList.add('sidebar-hidden');
  }

  loadGenreLists();
  buildSubFonts();
  buildSubColors();
  buildSubBgColors();
  buildTogglesBar();
  buildProfileBorders();
  renderGenreSidebar();

  // Initialize private IndexedDB & Load user's private local playlist
  await LOCAL_DB.init();
  loadLocalPlaylist();

  const v = $('mainVideo');

  // Save progress on pause, seek, and beforeunload so refresh always resumes exact second
  window.addEventListener('beforeunload', saveProgress);
  window.addEventListener('pagehide', saveProgress);
  if (v) {
    v.addEventListener('pause', saveProgress);
    v.addEventListener('seeking', saveProgress);
    v.addEventListener('seeked', saveProgress);
  }

  // Register PWA Offline Engine & Service Worker
  registerPWA();
  updateOnlineStatus();

  // Auto-resume immediately on boot without delay
  setTimeout(async () => {
    await checkResume();
  }, 400);
  if (v) {
    v.addEventListener('loadedmetadata', detectInbuildSubtitles);
    v.addEventListener('canplay', detectInbuildSubtitles);
  }

  // Auto-resume if previous session existed in this browser
  

  console.log('%c🎬 BETA PLAYER v2.0', 'font-size:18px;font-weight:bold;color:#06b6d4');
  console.log('%cDeveloper: Surendhar S | B.E. CSE | 2025-2029 Batch', 'color:#818cf8');
  console.log('%cBannari Amman Institute of Technology, Erode, Tamil Nadu', 'color:#94a3b8');
}

document.addEventListener('DOMContentLoaded', boot);


// ─── AUTO-HIDE CONTROLS & CURSOR IN FULLSCREEN & PLAYBACK (2.5s) ───
let idleHideTimer = null;
let isHoveringControls = false;

function setupAutoHideControls() {
  const stage = $('stage');
  const shell = $('shell');
  const controls = $('controls');
  const v = $('mainVideo');

  if (controls) {
    controls.addEventListener('mouseenter', () => { isHoveringControls = true; resetIdleTimer(); });
    controls.addEventListener('mouseleave', () => { isHoveringControls = false; resetIdleTimer(); });
  }

  const resetIdleTimer = () => {
    clearTimeout(idleHideTimer);
    if (stage) stage.classList.remove('idle-hide');
    if (shell) shell.classList.remove('idle-hide');

    if (!v || v.paused || isHoveringControls || BP.screenLocked) return;

    idleHideTimer = setTimeout(() => {
      if (v && !v.paused && !isHoveringControls && !BP.screenLocked) {
        if (stage) stage.classList.add('idle-hide');
        if (shell) shell.classList.add('idle-hide');
      }
    }, 2500);
  };

  window.addEventListener('mousemove', resetIdleTimer, { passive: true });
  window.addEventListener('mousedown', resetIdleTimer, { passive: true });
  window.addEventListener('touchstart', resetIdleTimer, { passive: true });
  window.addEventListener('keydown', resetIdleTimer, { passive: true });

  if (v) {
    v.addEventListener('play', resetIdleTimer);
    v.addEventListener('pause', () => {
      clearTimeout(idleHideTimer);
      if (stage) stage.classList.remove('idle-hide');
      if (shell) shell.classList.remove('idle-hide');
    });
  }

  document.addEventListener('fullscreenchange', () => {
    resetIdleTimer();
    const isFs = !!document.fullscreenElement;
    const fsIcon = $('fsIcon');
    if (fsIcon) fsIcon.textContent = isFs ? '⛶' : '⛶';
  });
}


// ─── PROFILE STUDIO CUSTOMIZATION ENGINE ─────────────────────────────
function switchPfTab(tabKey) {
  const tabs = ['shapes', 'borders', 'sliders', 'filters'];
  tabs.forEach(t => {
    const el = $('pfTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('active', t === tabKey);
  });
  $$('.pf-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabKey));
  });
}

const SHAPE_CONFIGS = {
  circle:    'border-radius:50%',
  squircle:  'border-radius:35%',
  rounded16: 'border-radius:16px',
  rounded8:  'border-radius:8px',
  leaf1:     'border-radius:0px 50% 0px 50%',
  leaf2:     'border-radius:50% 0px 50% 0px',
  teardrop:  'border-radius:50% 50% 50% 0px',
  pill:      'border-radius:9999px',
  square:    'border-radius:0px'
};

const BORDER_CONFIGS = {
  solid:  'border-style:solid',
  double: 'border-style:double',
  dashed: 'border-style:dashed',
  dotted: 'border-style:dotted',
  groove: 'border-style:groove',
  ridge:  'border-style:ridge',
  neon:   'border-style:solid;box-shadow:0 0 16px var(--profileBorderColor, var(--ac))',
  cyber:  'border-style:double;box-shadow:0 0 14px #3b82f6',
  gold:   'border-style:solid;box-shadow:0 4px 14px rgba(245,158,11,0.5)',
  fire:   'border-style:solid;box-shadow:0 0 16px #ef4444',
  cosmic: 'border-style:solid;box-shadow:0 0 16px #8b5cf6',
  holo:   'border-style:double;box-shadow:0 0 18px #06b6d4',
  prism:  'border-style:solid;box-shadow:0 0 15px rgba(236,72,153,0.6)',
  none:   'border:none !important;box-shadow:none !important'
};

const FILTER_CONFIGS = {
  none:      'none',
  cinematic: 'contrast(1.15) brightness(1.05) saturate(1.2)',
  noir:      'grayscale(1) contrast(1.3)',
  sepia:     'sepia(0.8) contrast(1.1)',
  cyber:     'hue-rotate(180deg) saturate(1.4)',
  contrast:  'contrast(1.5)',
  gold:      'sepia(0.3) saturate(1.5) hue-rotate(-15deg)',
  cool:      'hue-rotate(90deg) saturate(1.2)'
};

function setProfileShape(shapeId) {
  BP.profile.shape = shapeId;
  $$('.pf-shape-chip').forEach(c => c.classList.toggle('active', c.getAttribute('onclick').includes(shapeId)));
  applyProfileCustomStyles();
}

function setProfileBorderDesign(designId) {
  BP.profile.borderDesign = designId;
  $$('.pf-border-chip').forEach(c => c.classList.toggle('active', c.getAttribute('onclick').includes(designId)));
  applyProfileCustomStyles();
}

function onProfileRadiusSlider(val) {
  BP.profile.customRadius = val;
  const lbl = $('lblRadiusVal'); if (lbl) lbl.textContent = val + '%';
  applyProfileCustomStyles();
}

function onProfileWidthSlider(val) {
  BP.profile.borderWidth = +val;
  const lbl = $('lblWidthVal'); if (lbl) lbl.textContent = val + 'px';
  applyProfileCustomStyles();
}

function onProfileGlowSlider(val) {
  BP.profile.glowIntensity = +val;
  const lbl = $('lblGlowVal'); if (lbl) lbl.textContent = val + 'px';
  applyProfileCustomStyles();
}

function setProfileColor(hex) {
  BP.profile.borderColor = hex;
  const inp = $('pfCustomColor'); if (inp) inp.value = hex;
  applyProfileCustomStyles();
}

function setProfileFilter(filterId) {
  BP.profile.filter = filterId;
  $$('.pf-filter-chip').forEach(c => c.classList.toggle('active', c.getAttribute('onclick').includes(filterId)));
  applyProfileCustomStyles();
}

function applyProfileCustomStyles() {
  const p = BP.profile;
  const color = p.borderColor || 'var(--ac)';
  const width = typeof p.borderWidth === 'number' ? p.borderWidth : 3;
  const glow  = typeof p.glowIntensity === 'number' ? p.glowIntensity : 12;
  const shape = p.shape || 'circle';
  const design = p.borderDesign || 'solid';
  const filter = FILTER_CONFIGS[p.filter] || 'none';

  let radiusCss = SHAPE_CONFIGS[shape] || 'border-radius:50%';
  if (typeof p.customRadius !== 'undefined') {
    radiusCss = 'border-radius:' + p.customRadius + '%';
  }

  let borderStyle = 'solid';
  let extraShadow = `box-shadow: 0 0 ${glow}px ${color}`;

  if (design === 'none' || width === 0) {
    borderStyle = 'none';
    extraShadow = 'box-shadow:none';
  } else if (design === 'double') {
    borderStyle = 'double';
  } else if (design === 'dashed') {
    borderStyle = 'dashed';
  } else if (design === 'dotted') {
    borderStyle = 'dotted';
  } else if (design === 'groove') {
    borderStyle = 'groove';
  } else if (design === 'ridge') {
    borderStyle = 'ridge';
  }

  const finalStyle = `${radiusCss};border:${width}px ${borderStyle} ${color};${extraShadow};filter:${filter};width:100%;height:100%;object-fit:cover;`;

  const avPrev = $('avPrev');
  if (avPrev) avPrev.style.cssText = finalStyle;

  const avatarImg = $('avatarImg');
  if (avatarImg) avatarImg.style.cssText = finalStyle;

  try {
    localStorage.setItem('bp_profile', JSON.stringify(BP.profile));
  } catch(e) {}
}

function removeAvatarPhoto() {
  BP.profile.avatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='36' r='24' fill='%2306b6d4'/%3E%3Ccircle cx='50' cy='96' r='34' fill='%2306b6d4'/%3E%3C/svg%3E";
  const avPrev = $('avPrev'); if (avPrev) avPrev.src = BP.profile.avatar;
  const avatarImg = $('avatarImg'); if (avatarImg) avatarImg.src = BP.profile.avatar;
  applyProfileCustomStyles();
  flash('📷 PHOTO RESET TO DEFAULT');
}

// ─── PWA & SERVICE WORKER OFFLINE ENGINE ──────────────────────────────────────
let deferredPWAInstallPrompt = null;

function registerPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('[PWA] Service Worker registered:', reg.scope);
      }).catch(err => {
        console.warn('[PWA] Service Worker note:', err);
      });
    });
  }

  // Handle Chrome / Android PWA Install Prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    const btnInstall = $('btnInstallApp');
    if (btnInstall) btnInstall.style.display = 'inline-flex';
    const qspInstall = $('qspInstallBtn');
    if (qspInstall) qspInstall.style.display = 'inline-block';
  });

  window.addEventListener('appinstalled', () => {
    deferredPWAInstallPrompt = null;
    flash('📲 BETA PLAYER INSTALLED SUCCESSFULLY!');
    const btnInstall = $('btnInstallApp');
    if (btnInstall) btnInstall.style.display = 'none';
  });
}

function promptInstallPWA() {
  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    deferredPWAInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        flash('📲 Installing Beta Player app...');
      }
      deferredPWAInstallPrompt = null;
    });
  } else {
    flash('📲 In Chrome: tap Menu (⋮) → "Install app" or "Add to Home screen" to run offline!');
  }
}

// ─── OFFLINE MODE MONITOR ────────────────────────────────────────────────────
function updateOnlineStatus() {
  const pill = $('offlinePill');
  const isOffline = !navigator.onLine;
  if (pill) {
    pill.style.display = isOffline ? 'inline-flex' : 'none';
  }
  if (isOffline) {
    flash('⚡ OFFLINE MODE: Running 100% offline with local movies!');
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
