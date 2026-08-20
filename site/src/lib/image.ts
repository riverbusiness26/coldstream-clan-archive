// Client-side image downscaling for gallery uploads. A raw screenshot can be
// 5 MB; resized to 1920px JPEG it lands around 400 KB, which keeps the
// storage bill at zero for years. GIFs pass through untouched so animations
// survive.

const MAX_EDGE = 1920;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  if (file.type === 'image/gif') {
    return { blob: file, type: 'image/gif', ext: 'gif' };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That image could not be read.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, type: file.type, ext: 'jpg' };
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return { blob: file, type: file.type, ext: (file.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4) };
    return { blob, type: 'image/jpeg', ext: 'jpg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Smaller variant for the demo store, which lives inside localStorage and has
// to stay well under the browser's quota.
export async function compressToDataUrl(file: File, maxEdge = 900, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That image could not be read.'));
      el.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
