describe('activitypub', () => {
  const { validateActivityPub } = require('../../src/utils/activitypub');

  it('should return true for a valid ActivityPub URL', () => {
    const validUrl = 'https://example.com/activitypub';
    expect(validateActivityPub(validUrl)).toBe(true);
  });

  it('should return false for an invalid ActivityPub URL', () => {
    const invalidUrl = 'invalid-url';
    expect(validateActivityPub(invalidUrl)).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(validateActivityPub('')).toBe(false);
  });

  it('should return false for a URL with spaces', () => {
    const urlWithSpaces = 'https://example.com/activity pub';
    expect(validateActivityPub(urlWithSpaces)).toBe(false);
  });
});