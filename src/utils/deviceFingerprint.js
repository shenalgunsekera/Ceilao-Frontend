const CACHE_KEY = 'ceilao_device_fp';

// ── Stable fingerprint ────────────────────────────────────────────────────────
// Built from device/browser characteristics that don't change between sessions.
// Clearing cache/cookies does NOT change this — it's recomputed from the same
// hardware and browser each time, so an approved device stays approved.
function computeFingerprint() {
  const parts = [
    // Strip version numbers from UA so a browser update doesn't create a new device
    navigator.userAgent
      .replace(/Chrome\/[\d.]+/, 'Chrome')
      .replace(/Firefox\/[\d.]+/, 'Firefox')
      .replace(/Safari\/[\d.]+/, 'Safari')
      .replace(/Edg\/[\d.]+/, 'Edge')
      .replace(/Version\/[\d.]+/, ''),
    `${window.screen.width}x${window.screen.height}`,
    window.screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
    navigator.platform,
    // deviceMemory is not available in Firefox but that's fine
    (navigator.deviceMemory || 0),
  ].join('||');

  // djb2 hash → base36 string
  let h = 5381;
  for (let i = 0; i < parts.length; i++) {
    h = ((h << 5) + h) ^ parts.charCodeAt(i);
    h = h & h; // keep 32-bit
  }
  return 'fp_' + Math.abs(h).toString(36).padStart(7, '0');
}

export function getOrCreateDeviceId() {
  // Try cache first (fast path)
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached && cached.startsWith('fp_')) return cached;

  // Compute from browser attributes and cache for speed
  const fp = computeFingerprint();
  try { localStorage.setItem(CACHE_KEY, fp); } catch (_) {}
  return fp;
}

export function collectDeviceInfo() {
  const ua = navigator.userAgent;

  const getBrowser = () => {
    if (/Edg\//.test(ua))                          return 'Microsoft Edge';
    if (/OPR\/|Opera/.test(ua))                    return 'Opera';
    if (/Chrome\//.test(ua) && !/Edg/.test(ua))    return 'Chrome';
    if (/Firefox\//.test(ua))                       return 'Firefox';
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    return 'Unknown Browser';
  };

  const getOS = () => {
    if (/Windows NT 10|Windows NT 11/.test(ua)) return 'Windows 10/11';
    if (/Windows NT 6\.3/.test(ua))             return 'Windows 8.1';
    if (/Windows/.test(ua))                     return 'Windows';
    if (/Mac OS X/.test(ua))                    return 'macOS';
    if (/Android/.test(ua)) {
      const m = ua.match(/Android ([0-9.]+)/);
      return m ? `Android ${m[1]}` : 'Android';
    }
    if (/iPhone|iPad/.test(ua)) return 'iOS';
    if (/Linux/.test(ua))       return 'Linux';
    return 'Unknown OS';
  };

  const getDeviceType = () => {
    if (/iPad/.test(ua))                  return 'Tablet';
    if (/Mobile|Android|iPhone/.test(ua)) return 'Mobile';
    return 'Desktop';
  };

  return {
    browser:     getBrowser(),
    os:          getOS(),
    device_type: getDeviceType(),
    screen:      `${window.screen.width}×${window.screen.height}`,
    timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
    language:    navigator.language,
    user_agent:  ua.substring(0, 400),
  };
}

export async function fetchLocationInfo() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('geo failed');
    const d = await res.json();
    return {
      ip:           d.ip           || 'Unknown',
      city:         d.city         || 'Unknown',
      region:       d.region       || '',
      country:      d.country_name || 'Unknown',
      country_code: d.country_code || '',
    };
  } catch {
    return { ip: 'Unknown', city: 'Unknown', region: '', country: 'Unknown', country_code: '' };
  }
}
