import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyMediaItems, nextMediaIndex, featuredMemberName } from '../src/lib/weeklyMedia.ts';

const item = (id, url, provider = 'stream') => ({ id, url, provider, title: 'A highlight', description: 'Member caption' });
test('featured member follows the playing submission and clears for archive media', () => {
  const media = weeklyMediaItems([
    { ...item('slug', 'https://example.com/slug.mp4'), member: { display_name: '[2ndCS] SLUG' } },
    { ...item('river', 'https://example.com/river.mp4'), member: [{ display_name: '[CSG] river' }] },
  ], () => null);
  assert.equal(featuredMemberName(media[0]), '[2ndCS] SLUG');
  assert.equal(featuredMemberName(media[nextMediaIndex(0, 1, media.length)]), '[CSG] river');
  assert.equal(featuredMemberName({ ...media[0], source: 'archive' }), null);
  assert.equal(featuredMemberName(undefined), null);
});
test('Weekly captions preserve the submitting member and submitted information', () => {
  const result = weeklyMediaItems([{ ...item('credit','https://example.com/clip.mp4'), member:{display_name:'[2ndCS] SLUG'}, submitted_at:'2026-09-12T12:00:00Z' }],()=>null);
  assert.equal(result[0].submitter,'[2ndCS] SLUG');
  assert.equal(result[0].description,'Member caption');
  assert.equal(result[0].source,'weekly');
  assert.equal(result[0].submitted_at,'2026-09-12T12:00:00Z');
});
test('approved items are deduplicated by submission id', () => {
  const a = item('a', 'https://example.com/video.mp4');
  assert.equal(weeklyMediaItems([a, a], () => null).length, 1);
});
test('direct images and videos remain playable media, including signed query strings', () => {
  const result = weeklyMediaItems([item('v', 'https://example.com/clip.mp4?token=example'), item('i', 'https://example.com/photo.webp')], () => null);
  assert.deepEqual(result.map(x => x.type), ['video', 'image']);
  assert.equal(result[0].description, 'Member caption');
});
test('YouTube is embedded and unknown providers retain an honest source link', () => {
  const result = weeklyMediaItems([item('y', 'https://youtu.be/abcdefghijk'), item('s', 'https://example.com/watch/123')], url => url.includes('youtu.be') ? 'abcdefghijk' : null);
  assert.deepEqual(result.map(x => x.type), ['youtube', 'link']);
});
test('unsupported URL protocols are not rendered', () => {
  assert.equal(weeklyMediaItems([item('x', 'javascript:alert(1)'), item('b', 'not a URL')], () => null).length, 0);
});
test('rotation includes the complete collection, not just archive films', () => {
  assert.equal(nextMediaIndex(6, 1, 13), 7);
  assert.equal(nextMediaIndex(12, 1, 13), 0);
  assert.equal(nextMediaIndex(0, -1, 13), 12);
  assert.equal(nextMediaIndex(0, 1, 0), 0);
});
