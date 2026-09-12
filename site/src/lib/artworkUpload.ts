export function artworkFileError(file: { type: string; size: number }): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Use a PNG, JPEG or WebP image.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'This file is empty or unreadable.';
  if (file.size > 5 * 1024 * 1024) return 'The image must be 5 MB or smaller.';
  return null;
}

export function artworkDimensionsError(width: number, height: number): string | null {
  if (![width, height].every((value) => Number.isInteger(value) && value > 0)) return 'This image could not be read. Choose another file.';
  return null;
}
