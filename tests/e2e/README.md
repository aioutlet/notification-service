# End-to-End Tests

This directory contains end-to-end tests that verify complete user workflows.

## Purpose

- Test complete notification flows from event to delivery
- Verify cross-service integration
- Test with real infrastructure (Dapr, message broker)
- Validate observability and tracing

## Test Scenarios

- User registration notification flow
- Password reset notification flow
- Order confirmation notification flow
- Multi-channel notification delivery
- Failed notification retry handling
- Dead letter queue scenarios

## Running E2E Tests

```bash
npm run test:e2e
```

## Requirements

- Running Dapr sidecar
- Running message broker (RabbitMQ/Kafka)
- Running dependent services (auth, user, order services)
- Test email server (MailHog/MailCatcher)
- Zipkin/Jaeger for trace verification

## Guidelines

- Test realistic user scenarios
- Verify end-to-end trace propagation
- Check notification delivery in test inbox
- Validate retry mechanisms with failures
- Test timeout and circuit breaker scenarios
- Minimal mocking - use real infrastructure
- Longer execution time acceptable
