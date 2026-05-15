const DEVICE_ID_KEY = 'ceilao_device_id';

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
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
    if (/iPad/.test(ua))               return 'Tablet';
    if (/Mobile|Android|iPhone/.test(ua)) return 'Mobile';
    return 'Desktop';
  };

  return {
    browser:     getBrowser(),
    os:          getOS(),
    device_type: getDeviceType(),
    screen:      `${screen.width}×${screen.height}`,
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
