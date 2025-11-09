# Unit Tests

This directory contains unit tests for individual components in isolation.

## Purpose

- Test individual functions, classes, and methods
- Mock all external dependencies (database, API calls, Dapr client, etc.)
- Fast execution (< 100ms per test)
- No network calls or external services

## Structure

```
unit/
├── config/         # Configuration loading and validation tests
├── controllers/    # Controller logic tests (if applicable)
├── observability/  # Logger and tracing tests
├── services/       # Service layer business logic tests
└── utils/          # Utility function tests
```

## Running Unit Tests

```bash
npm run test:unit
npm run test:unit -- --watch
```

## Guidelines

- Mock all I/O operations
- Test both success and error paths
- Use descriptive test names
- Aim for high code coverage (>80%)
- Tests should be independent and idempotent
