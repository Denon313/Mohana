(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const intro = $('intro');
  const settingsToggle = $('settingsToggle');
  const settingsPanel = $('settingsPanel');
  const audio = $('audioPlayer');
  const eyeImage = $('eyeImage');
  const progressBar = $('progressBar');
  const playButton = $('playButton');
  const playIcon = $('playIcon');
  const playerHint = $('playerHint');

  let selectedImageUrl = null;
  let selectedAudioUrl = null;
  let imageFile = null;
  let audioFile = null;

  // Star field: generated locally, with no external dependency.
  const sky = $('sky');
  let seed = 313;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 95; i++) {
    const star = document.createElement('i');
    star.className = 'star';
    const size = random() * 2 + 0.7;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${random() * 100}%`;
    star.style.top = `${random() * 100}%`;
    star.style.setProperty('--duration', `${2 + random() * 4}s`);
    star.style.animationDelay = `${random() * -5}s`;
    sky.appendChild(star);
  }

  // The welcome screen lasts four seconds.
  window.setTimeout(() => intro.classList.add('hide'), 4000);

  settingsToggle.addEventListener('click', () => {
    settingsPanel.hidden = !settingsPanel.hidden;
  });
  $('settingsClose').addEventListener('click', () => {
    settingsPanel.hidden = true;
  });

  $('eyeUpload').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      $('eyeFileName').textContent = 'لطفاً یک فایل عکس انتخاب کن.';
      return;
    }
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    imageFile = file;
    selectedImageUrl = URL.createObjectURL(file);
    eyeImage.src = selectedImageUrl;
    $('eyeFileName').textContent = file.name;
  });

  $('musicUpload').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      $('musicFileName').textContent = 'لطفاً یک فایل صوتی انتخاب کن.';
      return;
    }
    if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
    audioFile = file;
    selectedAudioUrl = URL.createObjectURL(file);
    audio.src = selectedAudioUrl;
    audio.load();
    $('musicFileName').textContent = file.name;
    $('trackTitle').textContent = file.name.replace(/\.[^.]+$/, '');
    $('trackArtist').textContent = 'آهنگ اختصاصی تو 💜';
    playerHint.textContent = 'آهنگ آماده‌ست؛ برای شنیدنش دکمه پخش رو بزن.';
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', 'پخش آهنگ');
  });

  $('saveSettings').addEventListener('click', () => {
    const message = $('messageInput').value.trim();
    if (message) $('personalMessage').textContent = message;
    try {
      localStorage.setItem('mohana-personal-message', message);
    } catch (_) {}
    playerHint.textContent = 'متن ذخیره شد؛ عکس و آهنگ انتخابی فعلاً در همین صفحه فعال‌اند. 💜';
  });

  try {
    const savedMessage = localStorage.getItem('mohana-personal-message');
    if (savedMessage) {
      $('messageInput').value = savedMessage;
      $('personalMessage').textContent = savedMessage;
    }
  } catch (_) {}

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  playButton.addEventListener('click', async () => {
    if (!audio.src) {
      playerHint.textContent = 'اول از ⚙ تنظیمات موقت یک آهنگ انتخاب کن 🎵';
      settingsPanel.hidden = false;
      $('musicUpload').focus();
      return;
    }
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (_) {
      playerHint.textContent = 'این فایل پخش نشد؛ یک فایل صوتی دیگر انتخاب کن.';
    }
  });

  audio.addEventListener('play', () => {
    playIcon.textContent = 'Ⅱ';
    playButton.setAttribute('aria-label', 'توقف موقت آهنگ');
    playerHint.textContent = 'در حال پخش؛ امیدوارم خوشت بیاد 💜';
    $('musicCover').classList.add('playing');
  });
  audio.addEventListener('pause', () => {
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', 'پخش آهنگ');
    $('musicCover').classList.remove('playing');
  });
  audio.addEventListener('loadedmetadata', () => {
    $('duration').textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    $('currentTime').textContent = formatTime(audio.currentTime);
    $('duration').textContent = formatTime(audio.duration);
    progressBar.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  });
  audio.addEventListener('ended', () => {
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', 'پخش دوباره آهنگ');
  });
  audio.addEventListener('error', () => {
    if (audio.src) playerHint.textContent = 'مشکل در خواندن آهنگ؛ فایل دیگری انتخاب کن.';
  });

  progressBar.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(progressBar.value) / 100) * audio.duration;
    }
  });
  $('restartButton').addEventListener('click', () => {
    if (!audio.src) {
      playerHint.textContent = 'اول یک آهنگ انتخاب کن 🎧';
      return;
    }
    audio.currentTime = 0;
    if (audio.paused) audio.play().catch(() => {});
  });
  $('muteButton').addEventListener('click', () => {
    audio.muted = !audio.muted;
    $('muteButton').textContent = audio.muted ? '♩̸' : '♫';
    $('muteButton').setAttribute('aria-label', audio.muted ? 'روشن کردن صدا' : 'قطع صدا');
  });

  window.addEventListener('beforeunload', () => {
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
  });
})();
