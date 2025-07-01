import { expect, test } from 'bun:test';
import * as frontend from '@gobun/frontend.core';

test('frontend.core', () => {
    expect(frontend.MESSAGE).toBe('Hello, from frontend.core');
});
