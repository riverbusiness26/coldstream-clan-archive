// Client-side image downscaling for gallery uploads. A raw screenshot can be
// 5 MB; resized to 1920px JPEG it lands around 400 KB, which keeps the
// storage bill at zero for years. GIFs pass through untouched so animations
// survive.
//
// Both functions now report the dimensions of what they produced. gallery_item
// has carried width and height since 0009 and nothing had ever written them,
// so every member upload rendered into a hard 16:9 box and a portrait phone
// grab lost its top and bottom. The size is free here: the image is decoded on
// this path anyway.

const MAX_EDGE = 1920;
const QUALITY = 0.82;

export interface Sized { w: number | null; h: number | null }

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That image could not be read.'));
    el.src = url;
  });
}

export async function compressImage(file: File): Promise<{ blob: Blob; type: string; ext: string } & Sized> {
  const url = URL.createObjectURL(file);
  try {
    // A GIF is never re-encoded, because that would flatten the animation. It
    // still gets decoded, but only to be measured, and a decode that fails
    // costs it nothing: it uploads without dimensions and falls back to 16:9,
    // exactly as every existing row already does.
    if (file.type === 'image/gif') {
      let sized: Sized = { w: null, h: null };
      try {
        const img = await load(url);
        sized = { w: img.naturalWidth, h: img.naturalHeight };
      } catch { /* unmeasurable, still uploadable */ }
      return { blob: file, type: 'image/gif', ext: 'gif', ...sized };
    }

    const img = await load(url);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, type: file.type, ext: 'jpg', w: img.naturalWidth, h: img.naturalHeight };
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    // Re-encoding made it bigger, which happens with flat UI screenshots, so
    // the original wins and the original's size is what goes on the row.
    if (!blob || blob.size >= file.size) {
      return {
        blob: file, type: file.type,
        ext: (file.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4),
        w: img.naturalWidth, h: img.naturalHeight,
      };
    }
    return { blob, type: 'image/jpeg', ext: 'jpg', w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Smaller variant for the demo store, which lives inside localStorage and has
// to stay well under the browser's quota.
export async function compressToDataUrl(
  file: File, maxEdge = 900, quality = 0.7,
): Promise<{ url: string } & Sized> {
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { url: canvas.toDataURL('image/jpeg', quality), w: canvas.width, h: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
