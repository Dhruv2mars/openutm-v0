import { describe, expect, it } from 'bun:test';
import config from './vite.config';

describe('vite config', () => {
  it('uses relative base for packaged file:// loads', () => {
    expect(config.base).toBe('./');
  });
});
