/// <reference types="jest" />

// This file helps TypeScript recognize Jest globals in test files
declare global {
  var describe: jest.Describe;
  var it: jest.It;
  var expect: jest.Expect;
  var beforeAll: jest.Lifecycle;
  var afterAll: jest.Lifecycle;
  var beforeEach: jest.Lifecycle;
  var afterEach: jest.Lifecycle;
}

export {};
