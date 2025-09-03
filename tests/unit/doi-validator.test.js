import { validateDOI } from '../../src/lib/doi-validator';
import { describe, it, expect } from 'vitest';

describe('DOI Validator', () => {
  it('should return true for a valid DOI', () => {
    const validDoi = '10.1000/xyz123';
    expect(validateDOI(validDoi).valid).toBe(true);
  });

  it('should return false for an invalid DOI', () => {
    const invalidDoi = 'invalid-doi';
    expect(validateDOI(invalidDoi).valid).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(validateDOI('').valid).toBe(false);
  });

  it('should return false for a DOI with spaces', () => {
    const doiWithSpaces = '10.1000/xyz 123';
    expect(validateDOI(doiWithSpaces).valid).toBe(false);
  });
});
