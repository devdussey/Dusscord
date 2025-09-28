const test = require('node:test');
const assert = require('node:assert/strict');

const { pngSupportsTransparency } = require('../src/utils/boosterRoleManager');

const TRANSPARENT_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';
const OPAQUE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

function bufferFromBase64(base64) {
  return Buffer.from(base64, 'base64');
}

test('pngSupportsTransparency returns true for PNG with alpha channel', () => {
  const buffer = bufferFromBase64(TRANSPARENT_BASE64);
  assert.equal(pngSupportsTransparency(buffer), true);
});

test('pngSupportsTransparency returns false for PNG without transparency support', () => {
  const buffer = bufferFromBase64(OPAQUE_BASE64);
  assert.equal(pngSupportsTransparency(buffer), false);
});

test('pngSupportsTransparency returns false for non-PNG data', () => {
  const buffer = Buffer.from('not a png');
  assert.equal(pngSupportsTransparency(buffer), false);
});
