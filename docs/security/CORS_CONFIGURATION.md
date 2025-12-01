# CORS Configuration

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) configuration implemented for the eDiscovery API. The configuration has been tightened to enhance security by restricting which origins can access the API.

## Security Features

### 1. **Origin Whitelist**
- Only explicitly allowed origins can make cross-origin requests
- Origins are configured via environment variable `CORS_ORIGIN`
- Supports multiple origins (comma-separated)
- Invalid origins are rejected with clear error messages

### 2. **Credential Support**
- `credentials: true` allows cookies and authorization headers
- Enables secure JWT token transmission
- Required for authenticated requests

### 3. **Explicit Method Whitelist**
- Only specified HTTP methods are allowed: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`
- Prevents unauthorized methods like `PUT`, `TRACE`, etc.

### 4. **Explicit Header Whitelist**
- **Allowed Headers**: `Content-Type`, `Authorization`, `X-Requested-With`
- Restricts which headers clients can send
- Prevents header-based attacks

### 5. **Exposed Headers**
- **Exposed to Client**: `X-Total-Count`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Allows frontend to access pagination and rate limit information
- Other headers remain hidden for security

### 6. **Preflight Caching**
- `maxAge: 600` (10 minutes)
- Reduces preflight OPTIONS requests
- Improves performance while maintaining security

## Configuration

### Environment Variables

```bash
# .env file
CORS_ORIGIN=http://localhost:3000,https://localhost:3000
```

**Format:**
- Single origin: `CORS_ORIGIN=https://app.example.com`
- Multiple origins: `CORS_ORIGIN=https://app.example.com,https://admin.example.com,https://mobile.example.com`
- Development: `CORS_ORIGIN=http://localhost:3000,https://localhost:3000`

### Development vs Production

**Development:**
- Allows requests with no origin (Postman, curl)
- Typically uses `http://localhost:3000`
- May include multiple local ports for testing

**Production:**
- Rejects requests with no origin
- Only allows specific production domains
- Example: `CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com`

## Implementation Details

### Code Location
`backend/src/server.js`

```javascript
// CORS Configuration - Tightened for security
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000']; // Default for development

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    // In production, you may want to restrict this
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (!origin) {
      return callback(new Error('Not allowed by CORS - missing origin'), false);
    }
    
    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS - origin ${origin} not in whitelist`), false);
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], // Explicit allowed methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Explicit allowed headers
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'], // Headers exposed to client
  maxAge: 600 // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));
```

## CORS Flow

### Simple Requests (GET, POST with standard headers)
1. Browser sends request with `Origin` header
2. Server checks origin against whitelist
3. If allowed, server responds with `Access-Control-Allow-Origin` header
4. Browser allows response to be read by JavaScript

### Preflight Requests (PATCH, DELETE, custom headers)
1. Browser sends OPTIONS request with:
   - `Origin` header
   - `Access-Control-Request-Method` header
   - `Access-Control-Request-Headers` header
2. Server validates and responds with:
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Max-Age`
3. If successful, browser sends actual request
4. Server responds with data and CORS headers

## Error Responses

### Blocked Origin
```
Access to XMLHttpRequest at 'https://api.example.com/api/cases' 
from origin 'https://malicious-site.com' has been blocked by CORS policy: 
The 'Access-Control-Allow-Origin' header has a value that is not equal 
to the supplied origin.
```

**Server Log:**
```
Error: Not allowed by CORS - origin https://malicious-site.com not in whitelist
```

### Missing Origin (Production)
```
Error: Not allowed by CORS - missing origin
```

## Testing CORS Configuration

### Test Allowed Origin (Should Succeed)

```bash
curl -X GET https://localhost:4443/api/cases \
  -H "Origin: http://localhost:3000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -k -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

### Test Blocked Origin (Should Fail)

```bash
curl -X GET https://localhost:4443/api/cases \
  -H "Origin: https://malicious-site.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -k -v
```

**Expected:** No `Access-Control-Allow-Origin` header, CORS error

### Test Preflight Request

```bash
curl -X OPTIONS https://localhost:4443/api/cases/1 \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -k -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
```

### Test Invalid Method (Should Fail)

```bash
curl -X PUT https://localhost:4443/api/cases/1 \
  -H "Origin: http://localhost:3000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -k -v
```

**Expected:** No `Access-Control-Allow-Methods: PUT` in preflight response

## Frontend Configuration

### Axios Example

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://localhost:4443',
  withCredentials: true, // Enable credentials (cookies, auth headers)
  headers: {
    'Content-Type': 'application/json',
  }
});

// Token will be sent automatically if stored in Authorization header
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Fetch API Example

```javascript
fetch('https://localhost:4443/api/cases', {
  method: 'GET',
  credentials: 'include', // Enable credentials
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('CORS error:', error));
```

## Production Deployment

### 1. Update Environment Variables

```bash
# Production .env
NODE_ENV=production
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### 2. Remove Development Overrides

In production, requests with no origin should be blocked. The current implementation already handles this:

```javascript
if (!origin && process.env.NODE_ENV === 'development') {
  return callback(null, true); // Only allow in development
}

if (!origin) {
  return callback(new Error('Not allowed by CORS - missing origin'), false); // Block in production
}
```

### 3. Verify HTTPS

CORS works with both HTTP and HTTPS, but in production:
- API should only be accessible via HTTPS
- Frontend should only be served via HTTPS
- All CORS_ORIGIN values should use `https://`

### 4. Test Thoroughly

Before deploying:
1. Test all allowed origins
2. Test blocked origins
3. Test preflight requests (PATCH, DELETE)
4. Test credential transmission (JWT tokens)
5. Verify exposed headers are accessible
6. Check browser console for CORS errors

## Security Considerations

### 1. **Never Use Wildcards in Production**
```javascript
// ❌ INSECURE - Allows all origins
origin: '*'

// ✅ SECURE - Explicit whitelist
origin: ['https://app.example.com', 'https://admin.example.com']
```

### 2. **Always Validate Origin**
- Don't trust `Origin` header alone
- Use authentication (JWT) for access control
- CORS is not a security feature, it's a relaxation of Same-Origin Policy

### 3. **Limit Exposed Headers**
- Only expose headers that frontend needs
- Don't expose sensitive internal headers

### 4. **Use HTTPS in Production**
- CORS credentials (JWT tokens) should only be sent over HTTPS
- Mixed content (HTTP origin to HTTPS API) may be blocked by browsers

### 5. **Monitor Failed CORS Requests**
- Log blocked origins for security analysis
- Alert on unusual patterns (potential attacks)

## Troubleshooting

### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header is present"

**Cause:** Origin not in whitelist or CORS misconfigured

**Solution:**
1. Check `CORS_ORIGIN` environment variable
2. Verify origin exactly matches (including protocol and port)
3. Restart backend after changing `.env`

### Issue: "CORS policy: Credentials flag is 'true', but the 'Access-Control-Allow-Credentials' header is ''"

**Cause:** Frontend sends `credentials: 'include'` but backend doesn't allow

**Solution:**
- Already configured: `credentials: true` in `corsOptions`
- Ensure frontend uses `withCredentials: true` (axios) or `credentials: 'include'` (fetch)

### Issue: Preflight request fails with 401 Unauthorized

**Cause:** Authentication middleware runs before OPTIONS request completes

**Solution:**
- CORS middleware runs before authentication (correct order in `server.js`)
- OPTIONS requests should not require authentication

### Issue: Custom header blocked by CORS

**Cause:** Header not in `allowedHeaders` list

**Solution:**
Add header to `allowedHeaders` array:
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Custom-Header']
```

## Related Security Features

CORS works in conjunction with other security features:

1. **HTTPS/TLS** - Encrypts credentials in transit
2. **JWT Authentication** - Validates user identity
3. **Rate Limiting** - Prevents abuse from allowed origins
4. **Input Validation** - Protects against injection attacks
5. **HSTS** - Forces HTTPS connections
6. **CSP** - Restricts resource loading

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [W3C CORS Specification](https://www.w3.org/TR/cors/)
- [OWASP: CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#cross-origin-resource-sharing)
- [Express CORS middleware](https://expressjs.com/en/resources/middleware/cors.html)

## Maintenance

### Adding a New Origin

1. Update `.env` file:
   ```bash
   CORS_ORIGIN=https://app.example.com,https://new-origin.com
   ```

2. Restart backend:
   ```bash
   docker-compose restart backend
   ```

3. Test new origin:
   ```bash
   curl -X GET https://localhost:4443/api/cases \
     -H "Origin: https://new-origin.com" \
     -H "Authorization: Bearer TOKEN" \
     -k -v
   ```

### Removing an Origin

1. Remove from `CORS_ORIGIN` in `.env`
2. Restart backend
3. Verify old origin is now blocked

### Monitoring

Monitor CORS errors in logs to detect:
- Misconfiguration (legitimate origins blocked)
- Attack attempts (suspicious origins trying to access API)
- Frontend deployment issues (origin mismatch)

---

**Last Updated:** November 17, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
