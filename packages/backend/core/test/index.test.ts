import { expect, test } from 'bun:test';
import * as backend from '../src/index';

test('backend.core', () => {
    expect(backend.MESSAGE).toBe('Hello, from backend.core');
});
