# Webhook API Reference

## Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/webhooks` | List all webhooks |
| GET | `/api/v1/webhooks/:id` | Get webhook details |
| POST | `/api/v1/webhooks` | Create new webhook |
| PUT | `/api/v1/webhooks/:id` | Update webhook |
| DELETE | `/api/v1/webhooks/:id` | Delete webhook |
| POST | `/api/v1/webhooks/:id/test` | Test webhook |

## Authentication

All webhook endpoints require authentication:
```http
Authorization: Bearer <your-jwt-token>
```

## Create Webhook

```http
POST /api/v1/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Slack Integration",
  "url": "https://hooks.slack.com/services/YOUR/WEBHOOK",
  "events": ["document.published", "media.uploaded"],
  "active": true,
  "secret": "shared-secret-for-hmac",
  "headers": {
    "X-Custom-Header": "value"
  },
  "retryPolicy": {
    "maxRetries": 3,
    "backoffType": "exponential",
    "baseDelay": 1000
  }
}
```

### Response
```json
{
  "id": "webhook_1234567890",
  "name": "Slack Integration",
  "url": "https://hooks.slack.com/services/YOUR/WEBHOOK",
  "events": ["document.published", "media.uploaded"],
  "active": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

## List Webhooks

```http
GET /api/v1/webhooks?active=true&limit=10
Authorization: Bearer <token>
```

### Query Parameters
- `active` (boolean) - Filter by active status
- `events` (string[]) - Filter by event types
- `createdBy` (string) - Filter by creator
- `offset` (number) - Pagination offset
- `limit` (number) - Results per page (default: 20)

### Response
```json
{
  "webhooks": [
    {
      "id": "webhook_1234567890",
      "name": "Slack Integration",
      "url": "https://hooks.slack.com/...",
      "events": ["document.published"],
      "active": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

## Update Webhook

```http
PUT /api/v1/webhooks/webhook_1234567890
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Slack Integration",
  "active": false
}
```

## Delete Webhook

```http
DELETE /api/v1/webhooks/webhook_1234567890
Authorization: Bearer <token>
```

### Response
```json
{
  "success": true,
  "message": "Webhook deleted successfully"
}
```

## Test Webhook

Send a test event to verify webhook configuration:

```http
POST /api/v1/webhooks/webhook_1234567890/test
Authorization: Bearer <token>
```

### Response
```json
{
  "success": true,
  "status": 200,
  "responseTime": 234,
  "message": "Test event delivered successfully"
}
```

## Webhook Payload Format

When events occur, Trokky sends this payload to your webhook:

```json
{
  "id": "evt_abc123",
  "type": "document.published",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "document": {
      "id": "article_456",
      "collection": "article",
      "title": "Blog Post Title",
      "_createdAt": "2024-01-15T09:00:00Z",
      "_updatedAt": "2024-01-15T10:30:00Z"
    }
  },
  "metadata": {
    "userId": "user_789",
    "source": "studio"
  }
}
```

## Headers

Every webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `X-Trokky-Event` | Event type (e.g., "document.published") |
| `X-Trokky-Event-ID` | Unique event identifier |
| `X-Trokky-Timestamp` | ISO 8601 timestamp |
| `X-Trokky-Signature` | HMAC-SHA256 signature (if secret configured) |
| `User-Agent` | "Trokky-Webhook/2.0" |

## Signature Verification

Verify webhook authenticity using HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expected}` === signature;
}

// In your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-trokky-signature'];
  
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process valid webhook...
});
```

## Error Handling

| Status Code | Description | Retry? |
|------------|-------------|--------|
| 200-299 | Success | No |
| 400 | Bad Request | No |
| 401 | Unauthorized | No |
| 403 | Forbidden | No |
| 404 | Not Found | No |
| 408 | Request Timeout | Yes |
| 429 | Too Many Requests | Yes |
| 500 | Internal Server Error | Yes |
| 502 | Bad Gateway | Yes |
| 503 | Service Unavailable | Yes |
| 504 | Gateway Timeout | Yes |

## Rate Limits

- Maximum 100 webhooks per account
- Maximum 10 concurrent webhook deliveries
- Webhook timeout: 30 seconds

For more detailed information, see the [Events and Webhooks Documentation](../events-and-webhooks.md).