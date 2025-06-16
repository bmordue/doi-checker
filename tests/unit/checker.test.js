import { checkDoi } from '../../src/lib/checker';
import { describe, it, expect } from 'vitest';

describe('checker', () => {

  it('should return true for a valid DOI', async () => {
    const validDoi = '10.1000/xyz123';
    const result = await checkDoi(validDoi);
    expect(result).toBe(true);
  });

  it('should return false for an invalid DOI', async () => {
    const invalidDoi = 'invalid-doi';
    const result = await checkDoi(invalidDoi);
    expect(result).toBe(false);
  });

  it('should return false for an empty string', async () => {
    const result = await checkDoi('');
    expect(result).toBe(false);
  });

  it('should return false for a DOI with spaces', async () => {
    const doiWithSpaces = '10.1000/xyz 123';
    const result = await checkDoi(doiWithSpaces);
    expect(result).toBe(false);
  });
});