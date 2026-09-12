import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkFileError, artworkDimensionsError } from '../src/lib/artworkUpload.ts';

test('supported artwork types preserve the existing 5 MB upload limit', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(artworkFileError({ type, size: 5 * 1024 * 1024 }), null);
    assert.ok(artworkFileError({ type, size: 5 * 1024 * 1024 + 1 }));
  }
});
test('empty and unsupported files are rejected', () => {
  for (const type of ['image/svg+xml', 'application/pdf', '', 'image/gif']) assert.ok(artworkFileError({ type, size: 200 }));
  for (const size of [0, -1, NaN, Infinity]) assert.ok(artworkFileError({ type: 'image/png', size }));
});
test('portrait ranks and round or wide medals keep their native dimensions', () => {
  for (const dimensions of [[512, 1536], [1024, 1024], [2048, 512]]) assert.equal(artworkDimensionsError(...dimensions), null);
});
test('undecodable image dimensions are rejected', () => {
  for (const dimensions of [[0, 100], [100, 0], [NaN, 100], [10.5, 100]]) assert.ok(artworkDimensionsError(...dimensions));
});
