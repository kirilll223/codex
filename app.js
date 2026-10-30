const selection = document.querySelector('#selection');
const scene = document.querySelector('#scene');
const title = document.querySelector('#scene-title');
const video = document.querySelector('#scene-video');
const youtubeWrap = document.querySelector('#scene-youtube-wrap');
const originalLink = document.querySelector('#original-video-link');
const soundButton = document.querySelector('#sound-button');
const characters = [...document.querySelectorAll('[data-character]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let activeCharacter = null;
let soundEnabled = false;
let audioContext;
let audioTimer;
let beat = 0;
let replayTimer;
let youtubeApiPromise;
let youtubePlayer = null;
let youtubePlaying = false;
let mediaGeneration = 0;
let youtubeWatchdog;

const scenes = {
  andrey: {
    title: 'пiшоф наф1г',
    badge: 'АНДРЮХА / STREET MODE',
    kicker: 'АНДРЮХА ВОШЁЛ В ЧАТ',
    caption: 'Разговор короткий. Вайб — вечный.',
    track: 'ЗЕЛЁНЫЙ ВАЙБ',
    video: 'assets/pakhom.mp4',
    youtube: '57vv4meBMB8',
  },
  lena: {
    title: 'MAAAN power',
    badge: 'ЛЕНА / POWER MODE',
    kicker: 'ТАНЦУЙ, ПАНТЕРА. ТЫ В СВОЕЙ СТИХИИ.',
    caption: 'Максимум силы. Минимум объяснений.',
    track: 'POWER НА МАКСИМУМ',
  },
};

// Optional local clips are discovered once. An unavailable clip leaves the artwork visible.
const clips = new Map();
const mediaReady = Promise.all(Object.entries(scenes).filter(([, data]) => data.video).map(async ([name, data]) => {
  try {
    const response = await fetch(data.video, { method: 'HEAD' });
    if (response.ok && response.headers.get('content-type')?.startsWith('video/')) clips.set(name, data.video);
  } catch { /* Local artwork remains usable offline. */ }
}));

function stopVideo() {
  video.pause();
  video.hidden = true;
  video.removeAttribute('src');
  video.load();
}

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timeout;
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('YouTube is unavailable'));
    };
    timeout = setTimeout(fail, 10000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = fail;
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function stopYoutube() {
  mediaGeneration++;
  clearTimeout(youtubeWatchdog);
  youtubePlaying = false;
  youtubeWrap.hidden = true;
  youtubeWrap.classList.remove('is-playing');
  try { youtubePlayer?.destroy(); } catch { /* Removing the iframe also stops playback. */ }
  youtubePlayer = null;
  const target = document.createElement('div');
  target.id = 'scene-youtube';
  youtubeWrap.replaceChildren(target);
}

async function playYoutube(character) {
  const id = scenes[character]?.youtube;
  if (!id || reducedMotion.matches) return;
  const generation = mediaGeneration;
  try {
    const YT = await loadYoutubeApi();
    if (activeCharacter !== character || generation !== mediaGeneration || reducedMotion.matches) return;
    // Keep the local clip visible until the original player confirms playback.
    youtubeWrap.hidden = false;
    youtubePlayer = new YT.Player('scene-youtube', {
      host: 'https://www.youtube-nocookie.com',
      width: '100%', height: '100%', videoId: id,
      playerVars: {
        autoplay: 1, mute: 1, loop: 1, playlist: id,
        playsinline: 1, controls: 0, rel: 0, disablekb: 1,
        enablejsapi: 1, origin: location.origin,
      },
      events: {
        onReady(event) {
          if (generation !== mediaGeneration) return;
          const iframe = event.target.getIframe();
          iframe.title = 'Пахом — ролик на фоне';
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          event.target.mute();
          if (!document.hidden) event.target.playVideo();
        },
        onStateChange(event) {
          if (generation !== mediaGeneration) return;
          if (event.data === YT.PlayerState.PLAYING) {
            clearTimeout(youtubeWatchdog);
            youtubePlaying = true;
            youtubeWrap.classList.add('is-playing');
            video.pause();
            video.hidden = true;
            stopBeat();
            if (soundEnabled) event.target.unMute();
          }
        },
        onError() {
          if (generation !== mediaGeneration) return;
          stopYoutube();
          void playVideo(character);
          startBeat();
        },
      },
    });
    youtubeWatchdog = setTimeout(() => {
      if (generation === mediaGeneration && !youtubePlaying) stopYoutube();
    }, 15000);
  } catch { /* The local clip and direct YouTube link remain available. */ }
}

async function playVideo(character) {
  await mediaReady;
  if (activeCharacter !== character || !clips.has(character) || reducedMotion.matches) return;
  video.src = clips.get(character);
  video.muted = !soundEnabled;
  try {
    await video.play();
    if (activeCharacter === character && !youtubePlaying) video.hidden = false;
    else video.pause();
  } catch { video.hidden = true; }
}

function chooseCharacter(character, updateHistory = true) {
  if (!scenes[character]) return;
  activeCharacter = character;
  const data = scenes[character];
  stopYoutube();
  stopVideo();
  scene.className = `scene scene--${character} entering`;
  title.textContent = data.title;
  document.querySelector('#scene-badge').textContent = data.badge;
  document.querySelector('#scene-kicker').textContent = data.kicker;
  document.querySelector('#scene-caption').textContent = data.caption;
  document.querySelector('#scene-track-name').textContent = data.track;
  originalLink.hidden = !data.youtube;
  selection.hidden = true;
  scene.hidden = false;
  if (updateHistory && location.hash !== `#${character}`) history.pushState(null, '', `#${character}`);
  document.title = `${data.title} — ВЫБЕРИ СЕБЯ`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  title.focus({ preventScroll: true });
  void playVideo(character);
  void playYoutube(character);
  startBeat();
}

function goBack(updateHistory = true) {
  const previous = activeCharacter;
  activeCharacter = null;
  clearTimeout(replayTimer);
  stopYoutube();
  stopVideo();
  stopBeat();
  scene.hidden = true;
  selection.hidden = false;
  if (updateHistory && location.hash) history.pushState(null, '', location.pathname + location.search);
  document.title = 'ВЫБЕРИ СЕБЯ — Андрюха или Лена';
  if (previous) characters.find(button => button.dataset.character === previous)?.focus({ preventScroll: true });
}

function stopBeat() {
  clearInterval(audioTimer);
  audioTimer = undefined;
}

function playBeat() {
  if (!audioContext || audioContext.state !== 'running' || document.hidden) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  const low = activeCharacter === 'andrey' ? 55 : 65.4;
  oscillator.frequency.setValueAtTime(beat % 4 === 0 ? low * 2 : low, now);
  oscillator.frequency.exponentialRampToValueAtTime(low / 2, now + .17);
  gain.gain.setValueAtTime(.13, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + .23);
  beat++;
}

function startBeat() {
  stopBeat();
  if (!soundEnabled || !activeCharacter || document.hidden || youtubePlaying) return;
  playBeat();
  audioTimer = setInterval(playBeat, activeCharacter === 'andrey' ? 480 : 370);
}

characters.forEach(button => button.addEventListener('click', () => chooseCharacter(button.dataset.character)));
document.querySelector('#back-button').addEventListener('click', () => goBack());
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); goBack(); });
document.querySelector('#replay-button').addEventListener('click', () => {
  clearTimeout(replayTimer);
  scene.classList.remove('replaying', 'entering');
  void scene.offsetWidth;
  scene.classList.add('replaying');
  if (video.currentSrc && !youtubePlaying) { video.currentTime = 0; void video.play().catch(() => {}); }
  if (youtubePlayer) {
    try { youtubePlayer.seekTo(0, true); youtubePlayer.playVideo(); } catch { /* Keep the local fallback. */ }
  }
  beat = 0;
  replayTimer = setTimeout(() => scene.classList.remove('replaying'), 650);
});

soundButton.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
  document.querySelector('#sound-label').textContent = soundEnabled ? 'ЗВУК ВКЛ.' : 'ЗВУК ВЫКЛ.';
  soundButton.querySelector('use').setAttribute('href', soundEnabled ? '#icon-sound' : '#icon-mute');
  video.muted = !soundEnabled;
  if (youtubePlayer) {
    try { soundEnabled ? youtubePlayer.unMute() : youtubePlayer.mute(); } catch { /* The player may still be loading. */ }
  }
  try {
    if (soundEnabled) {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
    }
    startBeat();
  } catch { stopBeat(); }
});

video.addEventListener('error', () => { video.hidden = true; startBeat(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopBeat(); video.pause();
    try { youtubePlayer?.pauseVideo(); } catch { /* Still loading. */ }
  }
  else if (activeCharacter) {
    if (youtubePlaying && !reducedMotion.matches) {
      try { youtubePlayer?.playVideo(); } catch { /* Still loading. */ }
    }
    else if (video.currentSrc && !video.hidden && !reducedMotion.matches) void video.play().catch(() => {});
    else startBeat();
  }
});

reducedMotion.addEventListener('change', () => {
  stopYoutube();
  stopVideo();
  if (activeCharacter && !reducedMotion.matches) {
    void playVideo(activeCharacter);
    void playYoutube(activeCharacter);
  }
  startBeat();
});

const about = document.querySelector('#about-dialog');
document.querySelector('#about-button').addEventListener('click', () => about.showModal());
document.querySelector('#close-about').addEventListener('click', () => about.close());
document.querySelector('#about-ok').addEventListener('click', () => about.close());
about.addEventListener('click', event => { if (event.target === about && (event.clientX < about.getBoundingClientRect().left || event.clientX > about.getBoundingClientRect().right || event.clientY < about.getBoundingClientRect().top || event.clientY > about.getBoundingClientRect().bottom)) about.close(); });

document.addEventListener('keydown', event => {
  if (about.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape' && activeCharacter) { event.preventDefault(); goBack(); }
  if (activeCharacter || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const current = characters.indexOf(document.activeElement);
  const next = current < 0 ? (event.key === 'ArrowRight' ? 0 : 1) : (current + 1) % 2;
  characters[next].focus({ preventScroll: true });
});

function syncRoute() {
  const route = location.hash.slice(1);
  if (scenes[route]) chooseCharacter(route, false);
  else goBack(false);
}
window.addEventListener('popstate', syncRoute);
syncRoute();
