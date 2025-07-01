import { expect, test } from 'bun:test';
import * as shared from '../src/index';

test('shared.util', () => {
    expect(shared.MESSAGE).toBe('Hello, from shared.util');
});
