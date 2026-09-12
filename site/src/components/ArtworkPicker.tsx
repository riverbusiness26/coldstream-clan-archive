import { useEffect, useRef, useState } from 'react';
import { artworkDimensionsError, artworkFileError } from '../lib/artworkUpload';
import '../artwork-picker.css';

export default function ArtworkPicker({ file, onChange, disabled = false }: { file: File | null; onChange: (file: File | null) => void; disabled?: boolean }) {
  const [candidate, setCandidate] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    if (!candidate) return;
    const url = URL.createObjectURL(candidate);
    const image = new Image();
    let cancelled = false;
    image.onload = () => {
      if (cancelled) return;
      const problem = artworkDimensionsError(image.naturalWidth, image.naturalHeight);
      setChecking(false); setError(problem);
      if (!problem) {
        setPreview({ url, width: image.naturalWidth, height: image.naturalHeight });
        callback.current(candidate);
      }
    };
    image.onerror = () => { if (!cancelled) { setChecking(false); setError('This image could not be read. Choose another file.'); } };
    image.src = url;
    return () => { cancelled = true; image.onload = null; image.onerror = null; URL.revokeObjectURL(url); };
  }, [candidate]);

  useEffect(() => {
    if (!file && preview) {
      setCandidate(null); setPreview(null);
      if (input.current) input.current.value = '';
    }
  }, [file, preview]);

  return <div className="artwork-picker">
    <label>Artwork file<input ref={input} disabled={disabled} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
      const next = event.target.files?.[0] ?? null;
      onChange(null); setPreview(null); setCandidate(null); setChecking(false);
      const problem = next ? artworkFileError(next) : null;
      setError(problem);
      if (next && !problem) { setChecking(true); setCandidate(next); }
    }} /></label>
    <small>PNG, JPEG or WebP, up to 5 MB. Use transparent PNG or WebP for cut-out artwork. Original proportions and file quality are preserved.</small>
    {checking && <p role="status">Checking image...</p>}
    {error && <p role="alert">{error}</p>}
    {preview && <figure><div className="artwork-picker-stage"><img src={preview.url} alt="Selected artwork preview" /></div><figcaption>{preview.width} × {preview.height} pixels · Preview only, not saved</figcaption></figure>}
  </div>;
}
