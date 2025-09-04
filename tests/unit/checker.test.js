import { processResults } from '../../src/lib/checker';
import { describe, it, expect } from 'vitest';

describe('checker', () => {
  describe('processResults', () => {
    it('should return empty result for empty input', async () => {
      const results = [];
      const previousStatuses = {};
      const processed = processResults(results, previousStatuses);

      expect(processed).toEqual({
        total: 0,
        working: 0,
        broken: 0,
        newlyBroken: [],
        // unchanged: [],
        // previouslyBroken: [],
      });
    });
  });
});
