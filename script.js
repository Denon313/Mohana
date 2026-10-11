(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const intro = $('intro');
  const settingsPanel = $('settingsPanel');
  const audio = $('audioPlayer');
  const eyeImage = $('eyeImage');
  const progressBar = $('progressBar');
  const playButton = $('playButton');
  const playIcon = $('playIcon');
  const playerHint = $('playerHint');

  let selectedImageUrl = null;
  let selectedAudioUrl = null;

  // Persistent browser database
  let db = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }

      const request = indexedDB.open('MohanaDatabase', 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains('files')) {
          database.createObjectStore('files', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function saveFile(id, file) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');

      store.put({
        id,
        blob: file,
        name: file.name || id,
        type: file.type || ''
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function readFile(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const request = transaction.objectStore('files').get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function removeFile(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.objectStore('files').delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function showImage(blob, name) {
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
    }

    selectedImageUrl = URL.createObjectURL(blob);
    eyeImage.src = selectedImageUrl;
    $('eyeFileName').textContent = name;
  }

  function showAudio(blob, name) {
    if (selectedAudioUrl) {
      URL.revokeObjectURL(selectedAudioUrl);
    }

    selectedAudioUrl = URL.createObjectURL(blob);
    audio.src = selectedAudioUrl;
    audio.load();

    $('musicFileName').textContent = name;
    $('trackTitle').textContent = name.replace(/\.[^.]+$/, '');
    $('trackArtist').textContent = 'آهنگ اختصاصی تو 💜';
    playerHint.textContent = 'آهنگ ذخیره شده؛ برای شنیدنش دکمه پخش رو بزن.';
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', 'پخش آهنگ');
  }

  // Star field
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

  // Welcome screen
  window.setTimeout(() => intro.classList.add('hide'), 4000);

  $('settingsClose').addEventListener('click', () => {
    settingsPanel.hidden = true;
  });

  // Image selection and persistent storage
  $('eyeUpload').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      $('eyeFileName').textContent = 'لطفاً یک فایل عکس انتخاب کن.';
      return;
    }

    try {
      showImage(file, file.name);
      await saveFile('image', file);
      playerHint.textContent = 'عکس ذخیره شد و بعد از رفرش هم باقی می‌مونه. 💜';
    } catch (error) {
      console.error('Image storage error:', error);
      playerHint.textContent = 'عکس نمایش داده شد، اما ذخیره‌سازی انجام نشد.';
    }
  });

  // Audio selection and persistent storage
  $('musicUpload').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      $('musicFileName').textContent = 'لطفاً یک فایل صوتی انتخاب کن.';
      return;
    }

    try {
      showAudio(file, file.name);
      await saveFile('audio', file);
      playerHint.textContent = 'آهنگ ذخیره شد و بعد از رفرش هم باقی می‌مونه. 🎵';
    } catch (error) {
      console.error('Audio storage error:', error);
      playerHint.textContent = 'آهنگ انتخاب شد، اما ذخیره‌سازی انجام نشد.';
    }
  });

  // Save personal message
  $('saveSettings').addEventListener('click', () => {
    const message = $('messageInput').value.trim();

    if (message) {
      $('personalMessage').textContent = message;
    }

    try {
      localStorage.setItem('mohana-personal-message', message);
    } catch (error) {
      console.error('Message storage error:', error);
    }

    playerHint.textContent = 'متن ذخیره شد. عکس و آهنگ هم در دیتابیس مرورگر نگهداری می‌شن. 💜';
  });

  // Restore saved message
  try {
    const savedMessage = localStorage.getItem('mohana-personal-message');

    if (savedMessage) {
      $('messageInput').value = savedMessage;
      $('personalMessage').textContent = savedMessage;
    }
  } catch (error) {
    console.error('Message restore error:', error);
  }

  // Restore saved image and audio from IndexedDB
  async function restoreSavedFiles() {
    try {
      db = await openDatabase();

      const savedImage = await readFile('image');

      if (savedImage && savedImage.blob) {
        showImage(savedImage.blob, savedImage.name || 'عکس ذخیره‌شده');
      }

      const savedAudio = await readFile('audio');

      if (savedAudio && savedAudio.blob) {
        showAudio(savedAudio.blob, savedAudio.name || 'آهنگ ذخیره‌شده');
      }

      if (savedImage || savedAudio) {
        playerHint.textContent = 'عکس و آهنگ ذخیره‌شده بازیابی شدن. خوش برگشتی 💜';
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      playerHint.textContent = 'ذخیره‌سازی در این مرورگر در دسترس نیست.';
    }
  }

  restoreSavedFiles();

  // Audio player
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  playButton.addEventListener('click', async () => {
    if (!audio.src) {
      playerHint.textContent = 'اول از ⚙ تنظیمات یک آهنگ انتخاب کن 🎵';
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
    } catch (error) {
      console.error('Audio playback error:', error);
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

    progressBar.value = audio.duration
      ? (audio.currentTime / audio.duration) * 100
      : 0;
  });

  audio.addEventListener('ended', () => {
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', 'پخش دوباره آهنگ');
  });

  audio.addEventListener('error', () => {
    if (audio.src) {
      playerHint.textContent = 'مشکل در خواندن آهنگ؛ فایل دیگری انتخاب کن.';
    }
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

    if (audio.paused) {
      audio.play().catch(() => {});
    }
  });

  $('muteButton').addEventListener('click', () => {
    audio.muted = !audio.muted;

    $('muteButton').textContent = audio.muted ? '♩̸' : '♫';
    $('muteButton').setAttribute(
      'aria-label',
      audio.muted ? 'روشن کردن صدا' : 'قطع صدا'
    );
  });

  // Release temporary URLs when leaving the page
  window.addEventListener('beforeunload', () => {
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
  });
})();
