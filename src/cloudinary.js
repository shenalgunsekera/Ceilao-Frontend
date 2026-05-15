const CLOUD_NAME    = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadToCloudinary(file, folder = 'ceilao/docs', onProgress) {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`);
  }

  // PDFs must go to /raw/upload/ so fl_inline works for viewing.
  // Images and other files use /auto/upload/ as before.
  const isPdf       = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const resourceType = isPdf ? 'raw' : 'auto';

  const formData = new FormData();
  formData.append('file',          file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder',        folder);
  if (!isPdf) {
    formData.append('quality',      'auto:good');
    formData.append('fetch_format', 'auto');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);

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
    xhr.timeout   = 120_000;
    xhr.send(formData);
  });
}

// Returns a viewable URL for a Cloudinary file.
// Raw-type PDFs (/raw/upload/) get fl_inline — browser shows them inline.
// Image-type PDFs (/image/upload/) are legacy; openFile() handles those via blob.
// Images get fl_inline + quality transforms.
export function viewUrl(url) {
  if (!url) return url;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  if (isPdf && url.includes('/raw/upload/'))
    return url.replace('/raw/upload/', '/raw/upload/fl_inline/');
  if (!url.includes('cloudinary.com')) return url;
  const isImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
  if (!isImage) return url;
  return url.replace('/upload/', '/upload/fl_inline,q_auto,f_auto/');
}

// Opens any file in a new tab with inline display.
// New raw-type PDFs: direct fl_inline link works.
// Legacy image-type PDFs: fetch + Blob URL so browser shows inline.
// Images: Cloudinary fl_inline URL.
export async function openFile(url) {
  if (!url) return;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  if (isPdf) {
    const direct = viewUrl(url);
    if (direct !== url) {
      // raw/upload — fl_inline works, open directly
      window.open(direct, '_blank');
      return;
    }
    // Legacy image/upload PDF — use client-side blob so browser shows inline
    try {
      const res     = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      window.open(url, '_blank');
    }
    return;
  }
  window.open(viewUrl(url), '_blank');
}
