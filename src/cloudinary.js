const CLOUD_NAME    = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

// Max file size: 20 MB
const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadToCloudinary(file, folder = 'ceilao/docs', onProgress) {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`);
  }

  const formData = new FormData();
  formData.append('file',           file);
  formData.append('upload_preset',  UPLOAD_PRESET);
  formData.append('folder',         folder);
  formData.append('quality',        'auto:good');   // auto compress without visible loss
  formData.append('fetch_format',   'auto');        // serve WebP/AVIF where supported

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error?.message || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror   = () => reject(new Error('Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout   = 120_000; // 2-minute timeout
    xhr.send(formData);
  });
}

// Returns a URL for inline browser viewing.
// PDFs on Cloudinary's /image/upload/ return 400 with fl_inline, so we
// route them through Google Docs Viewer instead.
export function viewUrl(url) {
  if (!url) return url;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  if (isPdf) return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
  if (!url.includes('cloudinary.com')) return url;
  const isImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
  const transforms = isImage ? 'fl_inline,q_auto,f_auto' : 'fl_inline';
  return url.replace('/upload/', `/upload/${transforms}/`);
}
