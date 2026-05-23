import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import app from './firebase';

const storage = getStorage(app);
const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadFile(file, folder = 'ceilao/docs', onProgress, label) {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`);
  }

  const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
  const stem = label
    ? label.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filename = `${stem}.${ext}`;
  const fileRef  = ref(storage, `${folder}/${filename}`);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file);

    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(new Error(err.message)),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// Firebase Storage URLs are direct — no transformation needed.
// Kept for backwards compatibility with any legacy Cloudinary URLs still in Firestore.
export function viewUrl(url) {
  if (!url) return url;
  if (url.includes('cloudinary.com')) {
    const isImage = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
    if (!isImage) return url;
    return url.replace('/upload/', '/upload/fl_inline,q_auto,f_auto/');
  }
  return url;
}

// Opens any file in a new tab. PDFs use a blob URL for guaranteed inline display.
// Falls back to direct window.open if the fetch fails (e.g. CORS).
export async function openFile(url) {
  if (!url) return;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  if (isPdf) {
    try {
      const res    = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob   = await res.blob();
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
