# Rate Limiting Implementation

## Overview
Rate limiting has been implemented to protect the API from abuse, brute force attacks, and denial-of-service attempts. Different endpoints have different limits based on their sensitivity and resource usage.

## Rate Limit Tiers

### 1. Authentication Endpoints (`/api/auth/*`)
**Limit**: 5 failed attempts per 15 minutes per IP

- **Purpose**: Prevent brute force password attacks
- **Scope**: Only **failed** login attempts count toward the limit
- **Success behavior**: Successful logins do NOT count against the limit
- **Key**: IP address (normalized for IPv6)
- **Response Code**: `429 Too Many Requests` when exceeded

**Example Response Headers:**
```
RateLimit-Policy: 5;w=900
RateLimit-Limit: 5
RateLimit-Remaining: 2
RateLimit-Reset: 896
```

**Error Response:**
```json
{
  "error": "Too many login attempts from this IP, please try again after 15 minutes",
  "retryAfter": "15 minutes"
}
```

### 2. General API Endpoints
**Limit**: 100 requests per 15 minutes per IP

Applies to:
- `/api/cases/*`
- `/api/documents/*`
- `/api/audit/*`
- `/api/tags/*`
- `/api/users/*`
- `/api/notifications/*`
- `/api/retention/*`
- `/api/privacy/*`

**Purpose**: Prevent API abuse and ensure fair usage

### 3. Export Endpoints (`/api/export/*`)
**Limit**: 10 requests per 1 hour per IP

**Purpose**: Protect resource-intensive export operations
**Reason**: Exports generate large files and consume significant server resources

**Error Response:**
```json
{
  "error": "Export limit exceeded, please try again later",
  "retryAfter": "1 hour"
}
```

### 4. Upload Endpoints (future - when applied)
**Limit**: 50 requests per 1 hour per IP

**Purpose**: Prevent storage abuse and resource exhaustion
**Note**: Can be applied to document upload endpoints

## How It Works

### IP Address Identification
- Uses `req.ip` from Express (respects `X-Forwarded-For` when behind proxy)
- Normalizes IPv6-mapped IPv4 addresses (e.g., `::ffff:192.168.1.1` → `192.168.1.1`)
- Handles both IPv4 and IPv6 connections

### Rate Limit Headers
All responses include standardized rate limit headers:

| Header | Description | Example |
|--------|-------------|---------|
| `RateLimit-Policy` | Policy description (limit;window) | `5;w=900` (5 requests per 900 seconds) |
| `RateLimit-Limit` | Maximum requests allowed in window | `5` |
| `RateLimit-Remaining` | Requests remaining in current window | `3` |
| `RateLimit-Reset` | Seconds until window resets | `896` |

### State Management
- Uses in-memory store (default)
- Resets on server restart
- For production: Consider Redis/Memcached store for persistence across restarts

## Testing Rate Limits

### Check Rate Limit Configuration
```bash
curl https://localhost:4443/api/auth/rate-limit-info
```

### Test Authentication Rate Limit
```bash
# Run 6 failed login attempts to trigger rate limit
for i in {1..6}; do
  curl -X POST https://localhost:4443/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -i
  echo "---"
done
```

Expected behavior:
- Attempts 1-5: Return `401 Unauthorized` with decreasing `RateLimit-Remaining`
- Attempt 6+: Return `429 Too Many Requests` with rate limit error message

### Monitor Rate Limit Headers
```bash
curl -i https://localhost:4443/api/cases | grep RateLimit
```

## Security Benefits

### 1. Brute Force Protection
- Limits password guessing attempts
- Failed attempts tracked separately from successful logins
- 15-minute lockout after 5 failed attempts

### 2. API Abuse Prevention
- Prevents automated scraping
- Limits impact of compromised API keys
- Ensures fair resource distribution

### 3. DoS Mitigation
- Prevents single IP from overwhelming server
- Protects resource-intensive operations (exports, uploads)
- Maintains service availability for legitimate users

### 4. Audit Trail
- Failed login attempts logged to `audit_logs` table
- Includes IP address, timestamp, and user agent
- Helps identify attack patterns

## Audit Logging

Failed login attempts are automatically logged:

```sql
SELECT * FROM audit_logs 
WHERE action = 'failed_login' 
ORDER BY timestamp DESC 
LIMIT 10;
```

**Log Entry Example:**
```json
{
  "user": "attacker@example.com",
  "action": "failed_login",
  "object_type": "auth",
  "details": {
    "ip": "192.168.1.100",
    "user_agent": "curl/7.68.0",
    "reason": "Invalid credentials"
  },
  "timestamp": "2025-11-17T03:45:12.000Z"
}
```

## Production Considerations

### 1. Persistent Store
For production deployments, use Redis or Memcached:

```javascript
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const client = redis.createClient();

const authLimiter = rateLimit({
  store: new RedisStore({
    client: client,
    prefix: 'rl:auth:'
  }),
  // ... other config
});
```

### 2. Reverse Proxy Configuration
When behind Nginx/Apache, configure Express to trust proxy:

```javascript
app.set('trust proxy', 1); // Trust first proxy
```

### 3. Custom Error Responses
Customize error messages per environment:

```javascript
message: process.env.NODE_ENV === 'production' 
  ? { error: 'Too many requests' }
  : { error: 'Rate limit exceeded', retryAfter: '15 minutes' }
```

### 4. Monitoring & Alerts
Monitor rate limit events:
- Track `429` responses
- Alert on sustained rate limit triggers
- Identify potential attack patterns

### 5. Allowlisting
For trusted IPs (internal services, monitoring):

```javascript
const authLimiter = rateLimit({
  // ... config
  skip: (req) => {
    const trustedIPs = ['10.0.0.0/8', '172.16.0.0/12'];
    return trustedIPs.includes(req.ip);
  }
});
```

## Configuration Options

### Adjusting Limits
Edit `/backend/src/server.js`:

```javascript
// Stricter auth limit (3 attempts per 10 minutes)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  // ...
});

// More generous API limit (200 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  // ...
});
```

### Environment Variables
Consider making limits configurable:

```javascript
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_WINDOW || 15 * 60 * 1000),
  max: parseInt(process.env.AUTH_RATE_LIMIT || 5),
  // ...
});
```

## Troubleshooting

### Issue: Rate limit triggered for legitimate users
**Solution**: Increase limits or implement user-based tracking

### Issue: Rate limits reset on server restart
**Solution**: Implement Redis/Memcached persistent store

### Issue: Load balancer shows single IP
**Solution**: Configure `trust proxy` and ensure `X-Forwarded-For` headers are passed

### Issue: IPv6 causing issues
**Solution**: IP normalization is already implemented (removes `::ffff:` prefix)

## Testing Checklist

- [x] Failed login attempts trigger rate limit
- [x] Successful login doesn't count toward limit  
- [x] Rate limit headers present in responses
- [x] 429 status code returned when exceeded
- [x] Failed attempts logged to audit_logs
- [x] Different limits for different endpoint types
- [x] Rate limit info endpoint accessible
- [ ] Redis/Memcached integration (production)
- [ ] Load testing with concurrent requests

## Related Security Features

This rate limiting complements:
- **HTTPS/TLS**: Encrypted transport (port 4443)
- **JWT Authentication**: Token-based auth with 1-day expiry
- **Audit Logging**: All auth events logged
- **Legal Hold**: Prevents data deletion for cases under litigation
- **File Encryption**: AES-256-GCM encryption at rest
- **GDPR Compliance**: Data export and deletion requests

## References

- **Library**: [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- **RFC**: [RFC 6585 - HTTP Status Code 429](https://tools.ietf.org/html/rfc6585#section-4)
- **Standard**: [IETF Draft - RateLimit Header Fields](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
