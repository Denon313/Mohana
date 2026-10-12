(() => {
  'use strict';

  const URL_BASE = window.MOHANA_SUPABASE_URL;
  const API_KEY = window.MOHANA_SUPABASE_KEY;
  const BUCKET = 'mohana-media';
  const SESSION_KEY = 'mohana-admin-session';

  const $ = (id) => document.getElementById(id);

  let imagePath = '';
  let audioPath = '';
  let busy = false;

  const status = (message) => {
    const hint = $('playerHint');
    if (hint) hint.textContent = message;
  };

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function request(path, options = {}, token = null) {
    const headers = {
      apikey: API_KEY,
      ...(options.headers || {})
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${URL_BASE}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase ${response.status}: ${message}`);
    }

    if (response.status === 204) return null;

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function login() {
    const current = getSession();

    if (current?.access_token) {
      try {
        await request('/auth/v1/user', {}, current.access_token);
        return current.access_token;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    const email = prompt('ایمیل حساب مدیریت Supabase را وارد کن:');
    if (!email) return null;

    const password = prompt('رمز حساب مدیریت را وارد کن:');
    if (!password) return null;

    status('در حال بررسی حساب مدیریت…');

    const session = await request(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      }
    );

    if (!session?.access_token) {
      throw new Error('ورود مدیر ناموفق بود.');
    }

    setSession(session);
    return session.access_token;
  }

  function publicMediaUrl(path) {
    if (!path) return '';

    if (/^https?:\/\//i.test(path)) return path;

    const encodedPath = path
      .split('/')
      .map(encodeURIComponent)
      .join('/');

    return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
  }

  async function loadSettings() {
    const rows = await request(
      '/rest/v1/mohana_settings?id=eq.1&select=id,message,image_path,audio_path'
    );

    const settings = rows?.[0];
    if (!settings) return;

    imagePath = settings.image_path || '';
    audioPath = settings.audio_path || '';

    if (settings.message !== null && settings.message !== undefined) {
      $('messageInput').value = settings.message;
      $('personalMessage').textContent =
        settings.message || 'بعضی چشم‌ها، خودشون یه دنیای قشنگن 💜';
    }

    if (imagePath) {
      const image = $('eyeImage');
      image.src = publicMediaUrl(imagePath);
      imagePath && (image.alt = 'عکس چشم انتخاب‌شده');
      $('eyeFileName').textContent = 'عکس مشترک 💜';
    }

    if (audioPath) {
      const audio = $('audioPlayer');
      audio.src = publicMediaUrl(audioPath);
      audio.load();

      const title = audioPath.split('/').pop() || 'آهنگ مشترک';
      $('musicFileName').textContent = 'آهنگ مشترک 🎵';
      $('trackTitle').textContent = title.replace(/\.[^.]+$/, '');
      $('trackArtist').textContent = 'آهنگ اختصاصی تو 💜';
    }

    status('تنظیمات مشترک با موفقیت بارگذاری شد 💜');
  }

  async function saveMedia(file, type, token) {
    const extension = (file.name.split('.').pop() || 'bin')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'bin';

    const path = `${type}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    await request(
      `/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'false'
        },
        body: file
      },
      token
    );

    return path;
  }

  async function saveRemoteSettings(token) {
    const message = $('messageInput').value.trim();

    await request(
      '/rest/v1/mohana_settings?id=eq.1',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          message,
          image_path: imagePath,
          audio_path: audioPath,
          updated_at: new Date().toISOString()
        })
      },
      token
    );

    $('personalMessage').textContent =
      message || 'بعضی چشم‌ها، خودشون یه دنیای قشنگن 💜';
  }

  async function handleUpload(event, type) {
    event.stopImmediatePropagation();

    if (busy) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const expected = type === 'image' ? 'image/' : 'audio/';

    if (!file.type.startsWith(expected)) {
      status(type === 'image'
        ? 'لطفاً یک فایل عکس معتبر انتخاب کن.'
        : 'لطفاً یک فایل صوتی معتبر انتخاب کن.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      status('حجم فایل نباید بیشتر از ۵۰ مگابایت باشد.');
      return;
    }

    busy = true;

    try {
      const token = await login();
      if (!token) {
        status('ورود مدیر لغو شد؛ فایل فقط در این مرورگر قابل استفاده است.');
        return;
      }

      status('در حال بارگذاری فایل در فضای آنلاین…');

      const path = await saveMedia(file, type, token);

      if (type === 'image') {
        imagePath = path;
      } else {
        audioPath = path;
      }

      await saveRemoteSettings(token);
      await loadSettings();

      status(type === 'image'
        ? 'عکس جدید برای هر دوتون ذخیره شد 💜'
        : 'آهنگ جدید برای هر دوتون ذخیره شد 🎵');
    } catch (error) {
      console.error('Mohana upload error:', error);
      status('ذخیره آنلاین ناموفق بود. اتصال و دسترسی حساب مدیر را بررسی کن.');
    } finally {
      busy = false;
    }
  }

  const settingsToggle = $('settingsToggle');
  const settingsPanel = $('settingsPanel');

  settingsToggle.addEventListener('click', async (event) => {
    event.stopImmediatePropagation();

    if (settingsPanel.hidden) {
      try {
        const token = await login();
        if (!token) return;

        settingsPanel.hidden = false;
        status('مدیریت فعال شد؛ تغییراتت آنلاین ذخیره می‌شوند 💜');
      } catch (error) {
        console.error('Mohana login error:', error);
        status('ورود انجام نشد؛ ایمیل، رمز و تنظیمات Supabase را بررسی کن.');
      }
    } else {
      settingsPanel.hidden = true;
    }
  }, true);

  $('eyeUpload').addEventListener(
    'change',
    (event) => handleUpload(event, 'image'),
    true
  );

  $('musicUpload').addEventListener(
    'change',
    (event) => handleUpload(event, 'audio'),
    true
  );

  $('saveSettings').addEventListener('click', async (event) => {
    event.stopImmediatePropagation();

    if (busy) return;
    busy = true;

    try {
      const token = await login();
      if (!token) return;

      status('در حال ذخیره پیام آنلاین…');
      await saveRemoteSettings(token);
      status('پیام برای هر دوتون ذخیره شد 💌');
    } catch (error) {
      console.error('Mohana settings error:', error);
      status('ذخیره پیام انجام نشد؛ دسترسی حساب مدیریت را بررسی کن.');
    } finally {
      busy = false;
    }
  }, true);

  $('settingsClose').addEventListener('click', () => {
    settingsPanel.hidden = true;
  });

  async function start() {
    if (!URL_BASE || !API_KEY) {
      status('تنظیمات اتصال آنلاین کامل نیست.');
      return;
    }

    try {
      await loadSettings();
    } catch (error) {
      console.error('Mohana settings load error:', error);
      status('تنظیمات آنلاین بارگذاری نشد؛ اتصال اینترنت را بررسی کن.');
    }
  }

  start();
})();
