# Events and Webhooks Documentation

## Overview

Trokky v2 provides a comprehensive event system with webhook support, enabling real-time notifications and integrations with external systems. The event system is built on an EventBus architecture with persistent webhook storage and automatic retry logic.

## Table of Contents

- [Event System](#event-system)
- [Webhook Management](#webhook-management)
- [API Reference](#api-reference)
- [Studio UI](#studio-ui)
- [Security](#security)
- [Configuration](#configuration)
- [Examples](#examples)

## Event System

### Core Concepts

The EventBus is the central hub for all events in Trokky. It manages event registration, emission, and delivery to both internal listeners and external webhooks.

### Event Types

Trokky emits events for all major operations:

#### Document Events
- `document.created` - When a new document is created
- `document.updated` - When a document is updated
- `document.deleted` - When a document is deleted
- `document.published` - When a document is published
- `document.unpublished` - When a document is unpublished

#### Media Events
- `media.uploaded` - When a media file is uploaded
- `media.deleted` - When a media file is deleted
- `media.variant.created` - When an image variant is generated

#### User Events
- `user.created` - When a new user is created
- `user.updated` - When a user is updated
- `user.deleted` - When a user is deleted
- `user.login` - When a user logs in
- `user.logout` - When a user logs out

#### System Events
- `webhook.created` - When a webhook is created
- `webhook.updated` - When a webhook is updated
- `webhook.deleted` - When a webhook is deleted
- `webhook.delivery.success` - When webhook delivery succeeds
- `webhook.delivery.failed` - When webhook delivery fails

### Event Payload Structure

All events follow a consistent structure:

```typescript
interface TrokkyEvent {
  id: string;           // Unique event ID
  type: string;         // Event type (e.g., 'document.created')
  timestamp: Date;      // When the event occurred
  payload: any;         // Event-specific data
  metadata?: {
    userId?: string;    // User who triggered the event
    source?: string;    // Source system
    [key: string]: any; // Additional metadata
  };
}
```

### Event Patterns

The event system supports wildcard patterns for flexible event matching:

- `*` - Matches all events
- `document.*` - Matches all document events
- `*.created` - Matches all creation events
- `document.updated` - Matches specific event

## Webhook Management

### Creating Webhooks

Webhooks can be created via API or Studio UI:

```typescript
// POST /api/v1/webhooks
{
  "name": "My Integration",
  "url": "https://example.com/webhook",
  "events": ["document.created", "document.updated"],
  "active": true,
  "secret": "your-secret-key",
  "headers": {
    "X-Custom-Header": "value"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffType": "exponential",
    "baseDelay": 1000,
    "maxDelay": 30000,
    "retryOnStatus": [500, 502, 503, 504, 408, 429]
  }
}
```

### Webhook Configuration Options

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `name` | string | Display name for the webhook | Yes |
| `url` | string | HTTPS endpoint URL | Yes |
| `events` | string[] | Event types to subscribe to | Yes |
| `active` | boolean | Whether webhook is enabled | No (default: true) |
| `secret` | string | Secret key for HMAC signature | No |
| `headers` | object | Custom headers to include | No |
| `retryPolicy` | object | Retry configuration | No |

### Retry Policy

The retry policy controls how failed webhook deliveries are retried:

```typescript
interface RetryPolicy {
  maxRetries: number;        // Maximum retry attempts (default: 3)
  backoffType: string;        // 'exponential' or 'linear' (default: 'exponential')
  baseDelay: number;          // Initial delay in ms (default: 1000)
  maxDelay: number;           // Maximum delay in ms (default: 30000)
  retryOnStatus: number[];    // HTTP status codes to retry (default: [500, 502, 503, 504, 408, 429])
}
```

### Webhook Persistence

Webhooks are persistently stored in the filesystem:
- Location: `data/system/webhooks/`
- Format: JSON files with webhook configuration
- Auto-loaded on server startup
- Survives server restarts

## API Reference

### Webhook Endpoints

#### List Webhooks
```http
GET /api/v1/webhooks
```

Query parameters:
- `active` (boolean) - Filter by active status
- `events` (string[]) - Filter by event types
- `offset` (number) - Pagination offset
- `limit` (number) - Results per page

#### Get Webhook
```http
GET /api/v1/webhooks/:id
```

#### Create Webhook
```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "name": "string",
  "url": "string",
  "events": ["string"],
  ...
}
```

#### Update Webhook
```http
PUT /api/v1/webhooks/:id
Content-Type: application/json

{
  "name": "string",
  "active": boolean,
  ...
}
```

#### Delete Webhook
```http
DELETE /api/v1/webhooks/:id
```

#### Test Webhook
```http
POST /api/v1/webhooks/:id/test
```

Sends a test event to the webhook endpoint.

### Event History Endpoints

#### Get Event History
```http
GET /api/v1/events/history
```

Query parameters:
- `type` (string) - Filter by event type
- `limit` (number) - Number of events to return

#### Get Event Statistics
```http
GET /api/v1/events/stats
```

Returns statistics about event processing and webhook deliveries.

## Studio UI

### Accessing Webhook Management

1. Navigate to Studio (`http://localhost:3000/studio`)
2. Click on "Users" in the navigation
3. Select "Webhooks" tab

### Features

- **Create Webhook**: Click "Create Webhook" button
- **Edit Webhook**: Click on webhook name to edit
- **Toggle Status**: Use the switch to enable/disable
- **Test Webhook**: Click "Test" to send test event
- **Delete Webhook**: Click delete icon

### Webhook List View

The webhook list displays:
- Name and URL
- Active status
- Subscribed events
- Creation date
- Actions (edit, test, delete)

## Security

### HMAC Signature Verification

When a `secret` is configured, Trokky signs webhook payloads using HMAC-SHA256:

```javascript
// Signature header
X-Trokky-Signature: sha256=<signature>

// Verification example (Node.js)
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expected}` === signature;
}
```

### Security Headers

Every webhook request includes:
- `X-Trokky-Event` - Event type
- `X-Trokky-Event-ID` - Unique event ID
- `X-Trokky-Timestamp` - ISO 8601 timestamp
- `X-Trokky-Signature` - HMAC signature (if secret configured)

### Best Practices

1. **Always use HTTPS** for webhook URLs
2. **Configure a secret** for signature verification
3. **Validate timestamps** to prevent replay attacks
4. **Implement idempotency** using event IDs
5. **Return 2xx quickly** and process asynchronously

## Configuration

### Enabling Webhooks

Webhooks are enabled by default. Configure in `trokky.config.ts`:

```typescript
export default {
  events: {
    enabled: true,
    maxHistorySize: 1000,
    enableWebhooks: true,
    webhookPersistence: true
  },
  storage: {
    data: {
      options: {
        webhooksDir: path.join(process.cwd(), 'data/system/webhooks')
      }
    }
  }
}
```

### Environment Variables

```bash
# Webhook timeout (milliseconds)
WEBHOOK_TIMEOUT=30000

# Maximum concurrent webhook deliveries
WEBHOOK_MAX_CONCURRENT=10

# Enable webhook debugging
WEBHOOK_DEBUG=true
```

## Examples

### Example: Slack Integration

```javascript
// Create webhook for Slack notifications
const webhook = {
  name: "Slack Notifications",
  url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  events: ["document.published"],
  headers: {
    "Content-Type": "application/json"
  }
};

// Trokky will send this payload to Slack
{
  "id": "evt_123",
  "type": "document.published",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "document": {
      "id": "article_456",
      "title": "New Blog Post",
      "collection": "article",
      "author": "John Doe"
    }
  }
}
```

### Example: Webhook Receiver (Express)

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = 'your-secret-key';

app.post('/webhook', (req, res) => {
  // Verify signature
  const signature = req.headers['x-trokky-signature'];
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (`sha256=${expected}` !== signature) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process event
  const { type, payload } = req.body;
  
  switch (type) {
    case 'document.created':
      console.log('New document:', payload.document);
      break;
    case 'media.uploaded':
      console.log('New media:', payload.media);
      break;
  }
  
  // Return success quickly
  res.status(200).send('OK');
  
  // Process asynchronously if needed
  processEventAsync(req.body);
});
```

### Example: Testing Webhooks

```bash
# Create a test webhook
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/your-unique-url",
    "events": ["*"],
    "active": true
  }'

# Test the webhook
curl -X POST http://localhost:3000/api/v1/webhooks/WEBHOOK_ID/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create a document to trigger events
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "collection": "article",
    "data": {
      "title": "Test Article"
    }
  }'
```

## Troubleshooting

### Common Issues

#### Webhooks not triggering
- Check webhook is active
- Verify event patterns match
- Check server logs for errors
- Ensure webhook URL is accessible

#### Signature verification failing
- Verify secret matches on both sides
- Check payload encoding (should be UTF-8)
- Ensure you're verifying the raw request body

#### Webhooks not persisting
- Check `webhooksDir` exists and is writable
- Verify `webhookPersistence` is enabled
- Check filesystem permissions

### Debug Mode

Enable debug logging for webhooks:

```typescript
// In your server startup
process.env.WEBHOOK_DEBUG = 'true';
```

This will log:
- Webhook registration
- Event matching
- Delivery attempts
- Retry attempts
- Errors and failures

## Performance Considerations

### Event History

The event history is kept in memory with a configurable size limit:

```typescript
events: {
  maxHistorySize: 1000  // Keep last 1000 events
}
```

### Webhook Delivery

- Webhooks are delivered asynchronously
- Failed deliveries are retried with exponential backoff
- Maximum concurrent deliveries can be configured
- Timeouts prevent hanging connections

### Best Practices for Scale

1. **Use specific event patterns** instead of wildcards
2. **Implement webhook endpoints that respond quickly**
3. **Process webhook payloads asynchronously**
4. **Monitor webhook delivery metrics**
5. **Implement circuit breakers for failing endpoints**

## Migration Guide

### From v1 to v2

If migrating from an older version without webhook support:

1. Update storage configuration to include `webhooksDir`
2. Run migration to create webhooks directory
3. Update any existing integrations to use webhook API
4. Configure webhook persistence in `trokky.config.ts`

### Webhook Format Changes

The webhook configuration format is stable and backward compatible. Any future changes will include migration utilities.

---

For more information, see the [Trokky v2 Documentation](../README.md) or visit the [GitHub repository](https://github.com/trokky/trokky).