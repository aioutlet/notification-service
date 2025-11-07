# Notification Service

A simple, stateless notification service that consumes events from a message broker and sends notifications via various channels (email, SMS, etc.).

## Architecture

**Simple Consumer Pattern:**

```
Message Broker → Notification Service → Email/SMS/Push
                         ↓
                 Publish Outcome Events → Audit Service
```

**Key Principles:**

- **Stateless**: No database, no state management
- **Event-Driven**: Consumes events, sends notifications, publishes outcomes
- **Simple**: Just a consumer - no API layer needed
- **Scalable**: Horizontally scalable by adding more consumer instances

## Features

- ✅ Consumes notification events from RabbitMQ
- ✅ In-memory template rendering (9 default templates)
- ✅ Email notifications via SMTP
- ✅ Publishes notification outcomes (NOTIFICATION_SENT/FAILED) for audit trail
- ✅ Correlation ID tracking for distributed tracing
- ✅ Graceful shutdown handling

## Getting Started

### Prerequisites

- Node.js 18+
- RabbitMQ running
- SMTP server access (for email notifications)

### Environment Variables

```bash
# Service
NODE_ENV=development
NAME=notification-service
VERSION=1.0.0

# Message Broker
MESSAGE_BROKER_TYPE=rabbitmq
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=aioutlet.events
RABBITMQ_QUEUE_NOTIFICATIONS=notification-service.queue

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=AI Outlet Notifications
EMAIL_FROM_ADDRESS=noreply@aioutlet.com
EMAIL_ENABLED=true

# JWT (for future admin endpoints if needed)
JWT_SECRET=your-secret-key
```

### Installation

```bash
npm install
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## Event Handling

The service listens for these event types:

### Auth Events

- `auth.user.registered`
- `auth.email.verification.requested`
- `auth.password.reset.requested`
- `auth.password.reset.completed`
- `auth.account.reactivation.requested`

### User Events

- `user.user.created`
- `user.user.updated`
- `user.email.verified`
- `user.password.changed`

### Order Events

- `order.placed`
- `order.cancelled`
- `order.delivered`

### Payment Events

- `payment.received`
- `payment.failed`

### Profile Events

- `profile.password_changed`
- `profile.notification_preferences_updated`
- `profile.bank_details_updated`

## Templates

Templates are stored in-memory and defined in `src/shared/services/template.service.ts`.

**Template Variables:**
Use `{{variableName}}` syntax in templates. Common variables:

- `{{username}}` - User's name
- `{{email}}` - User's email
- `{{verificationToken}}` - Email verification token
- `{{resetToken}}` - Password reset token
- `{{orderId}}` - Order ID
- `{{orderNumber}}` - Order number
- `{{amount}}` - Payment amount

**Adding New Templates:**
Edit `DEFAULT_TEMPLATES` array in `template.service.ts` and redeploy.

## Notification Outcomes

After sending a notification, the service publishes an outcome event:

### NOTIFICATION_SENT

```json
{
  "eventType": "notification.sent",
  "userId": "user-123",
  "userEmail": "user@example.com",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "notificationId": "uuid",
    "originalEventType": "auth.user.registered",
    "channel": "email",
    "recipientEmail": "user@example.com",
    "subject": "Welcome to AI Outlet!",
    "attemptNumber": 1
  }
}
```

### NOTIFICATION_FAILED

```json
{
  "eventType": "notification.failed",
  "userId": "user-123",
  "userEmail": "user@example.com",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "notificationId": "uuid",
    "originalEventType": "auth.user.registered",
    "channel": "email",
    "recipientEmail": "user@example.com",
    "errorMessage": "SMTP connection failed",
    "attemptNumber": 1
  }
}
```

These events are consumed by **audit-service** for compliance and monitoring.

## Monitoring

The service uses structured logging with correlation IDs for distributed tracing.

**Log Events:**

- `📨 Received notification event`
- `📤 Processing notification`
- `✅ Email notification sent successfully`
- `❌ Failed to send email notification`

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Manual Testing

Publish a test event to RabbitMQ:

```json
{
  "eventType": "auth.user.registered",
  "userId": "test-user-123",
  "userEmail": "test@example.com",
  "username": "testuser",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

## Scaling

To scale horizontally, simply run multiple instances:

```bash
# Instance 1
PORT=3003 npm start

# Instance 2
PORT=3004 npm start

# Instance 3
PORT=3005 npm start
```

All instances consume from the same RabbitMQ queue with round-robin distribution.

## Project Structure

```
notification-service/
├── src/
│   ├── consumer/
│   │   ├── consumer.ts              # Main entry point
│   │   └── handlers/
│   │       └── index.ts             # Event handlers
│   └── shared/
│       ├── config/
│       │   └── index.ts             # Configuration
│       ├── events/
│       │   └── event-types.ts       # Event type definitions
│       ├── messaging/
│       │   ├── IMessageBroker.ts    # Broker interface
│       │   ├── MessageBrokerFactory.ts
│       │   └── brokers/
│       │       └── RabbitMQBroker.ts
│       ├── observability/
│       │   ├── logging/             # Structured logging
│       │   └── tracing/             # OpenTelemetry tracing
│       └── services/
│           ├── email.service.ts     # Email sending
│           ├── notification.service.ts  # Template rendering
│           └── template.service.ts  # In-memory templates
├── tests/
├── package.json
└── README.md
```

## Dependencies

**Core:**

- `amqplib` - RabbitMQ client
- `nodemailer` - Email sending
- `uuid` - Unique ID generation

**Observability:**

- `winston` - Structured logging
- `@opentelemetry/*` - Distributed tracing

**Security:**

- `jsonwebtoken` - JWT verification (for future admin endpoints)

## Design Decisions

### Why No API?

A notification service should be **event-driven**, not request-driven. Services publish events, notification-service consumes and sends. No need for HTTP endpoints.

### Why No Database?

- **Stateless = Scalable**: No shared state means easy horizontal scaling
- **Separation of Concerns**: Audit-service handles notification history
- **Simplicity**: Fewer dependencies, easier to maintain

### Why In-Memory Templates?

- **Fast**: No database queries for every notification
- **Simple**: Templates defined in code, version controlled
- **Sufficient**: Most notification templates rarely change

For dynamic templates, consider:

- Moving to config files
- Using ConfigMaps in Kubernetes
- External template service (future enhancement)

## Related Services

- **audit-service**: Consumes notification outcome events, stores audit trail
- **auth-service**: Publishes auth events (registration, password reset, etc.)
- **order-service**: Publishes order events (placed, cancelled, delivered)
- **payment-service**: Publishes payment events (received, failed)

## Migration from Stateful Version

See [STATELESS_REFACTORING.md](./STATELESS_REFACTORING.md) for details on the stateless refactoring.

## License

MIT

```

```
