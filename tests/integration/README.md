# Integration Tests

This directory contains integration tests that verify interactions between components.

## Purpose
- Test component integration with real dependencies
- Verify Dapr client interactions
- Test event publisher/consumer flows
- Test template rendering with real templates
- Database interactions (if applicable)

## Test Scenarios
- Event consumption and processing
- Notification rendering and delivery
- Dapr pub/sub integration
- Email service integration
- Template service with actual templates
- Error handling and retries

## Running Integration Tests
```bash
npm run test:integration
```

## Requirements
- May require Docker containers (RabbitMQ, Redis, etc.)
- Mock external APIs (email providers)
- Use test configurations
- Longer execution time than unit tests

## Guidelines
- Use real Dapr client with test pubsub component
- Mock only external services (SMTP, third-party APIs)
- Test trace context propagation
- Verify event metadata and CloudEvents format
- Clean up resources after tests
