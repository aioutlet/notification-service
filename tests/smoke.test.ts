// Simple smoke test to verify Jest configuration
describe('Jest Configuration', () => {
  it('should be properly configured', () => {
    expect(true).toBe(true);
  });

  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
