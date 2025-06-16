describe('DOI Validator', () => {
  const { validateDoi } = require('../../src/utils/doi-validator');

  it('should return true for a valid DOI', () => {
    const validDoi = '10.1000/xyz123';
    expect(validateDoi(validDoi)).toBe(true);
  });

  it('should return false for an invalid DOI', () => {
    const invalidDoi = 'invalid-doi';
    expect(validateDoi(invalidDoi)).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(validateDoi('')).toBe(false);
  });

  it('should return false for a DOI with spaces', () => {
    const doiWithSpaces = '10.1000/xyz 123';
    expect(validateDoi(doiWithSpaces)).toBe(false);
  });
});