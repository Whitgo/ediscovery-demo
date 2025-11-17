# Input Validation & Sanitization

## Overview
Comprehensive input validation and sanitization has been implemented to prevent XSS, SQL injection, and other injection attacks across all API endpoints.

## Security Features

### 1. XSS Prevention
**Technology**: `xss` npm package

**Protection**:
- Strips all HTML/script tags from user input
- Allows only safe formatting tags (b, i, em, strong, br, p)
- Removes dangerous attributes (onclick, onerror, etc.)
- Applied automatically to all string inputs

**Example**:
```javascript
Input:  "<script>alert('XSS')</script>Hello"
Output: "Hello"
```

### 2. SQL Injection Prevention
**Technology**: Knex.js parameterized queries + input validation

**Protection**:
- All database queries use Knex.js parameterized statements
- Never uses string concatenation for SQL
- Input validation rejects malicious patterns
- Type coercion ensures correct data types

**Example**:
```javascript
// ✅ Safe (parameterized)
knex('users').where({ email: userInput })

// ❌ Unsafe (never used)
knex.raw(`SELECT * FROM users WHERE email = '${userInput}'`)
```

### 3. Input Validation
**Technology**: `express-validator` + `validator`

**Validation Rules**:
- Email format validation
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Integer range validation
- Enum value validation
- String length limits
- URL/date format validation

## Implementation

### Global Sanitization Middleware
Applied to **ALL** routes automatically:

```javascript
// In server.js
app.use(sanitizeInput);
```

This middleware:
- Sanitizes `req.body` (JSON payloads)
- Sanitizes `req.query` (URL parameters)
- Sanitizes `req.params` (route parameters)
- Recursively cleans nested objects and arrays

### Endpoint-Specific Validation
Critical endpoints have strict validation rules:

| Endpoint | Validation Rules |
|----------|-----------------|
| `POST /api/auth/login` | Email format, password required |
| `POST /api/users` | Name (1-255 chars), valid email, strong password, valid role |
| `POST /api/cases` | Name validation, case number format, enum values |
| `PATCH /api/retention/cases/:caseId/policy` | Valid caseId (integer), policy enum, date format |
| `PATCH /api/users/:id` | ID validation, optional email/password |

## Validation Rules

### Email Validation
```javascript
- Must be valid email format
- Normalized (lowercase, trim)
- Max length: 255 characters
- Sanitized for XSS
```

### Password Requirements
```javascript
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Special characters allowed but not required
```

### ID Validation
```javascript
- Must be positive integer
- Converted to integer type
- Cannot be 0 or negative
```

### Name/Text Validation
```javascript
- Alphanumeric with spaces and basic punctuation
- Max length enforced (typically 255 for names, 5000-10000 for text)
- XSS sanitization applied
- No special characters except: - _ . , ' ( )
```

### Enum Validation
```javascript
// Case status
Allowed: ['open', 'closed', 'pending', 'active']

// User role
Allowed: ['user', 'manager', 'admin']

// Retention policy
Allowed: ['10_years', '7_years', '5_years', '3_years', 'indefinite', 'custom']

// Disposition
Allowed: ['plea', 'settlement', 'probation', 'dismissed', 'trial', 'pending']
```

## Error Responses

### Validation Failure
**Status**: `400 Bad Request`

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "value": "invalid-email"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long",
      "value": "short"
    }
  ]
}
```

### Single Field Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "name contains invalid characters",
      "value": "<script>alert(1)</script>"
    }
  ]
}
```

## Testing

### Test XSS Prevention
```bash
# Script tag injection
curl -k -X POST https://localhost:4443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(\"xss\")</script>@test.com","password":"test123"}'

# Expected: Email validation fails, script tags stripped
# Response: {"error": "Validation failed", "details": [{"message": "Must be a valid email address", ...}]}
```

### Test SQL Injection Prevention
```bash
# SQL injection attempt
curl -k -X POST https://localhost:4443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com OR 1=1","password":"anything"}'

# Expected: Email validation fails
# Response: {"error": "Validation failed" ...}
```

### Test Missing Required Fields
```bash
curl -k -X POST https://localhost:4443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'

# Expected: Password required error
# Response: {"error": "Validation failed", "details": [{"field": "password", "message": "Password is required"}]}
```

### Test Password Strength
```bash
curl -k -X POST https://localhost:4443/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User","email":"test@test.com","password":"weak","role":"user"}'

# Expected: Password strength validation fails
# Response: {"error": "Validation failed", "details": [{"field": "password", ...}]}
```

### Test ID Validation
```bash
# Non-integer ID
curl -k https://localhost:4443/api/cases/abc \
  -H "Authorization: Bearer $TOKEN"

# Expected: ID validation fails
# Response: {"error": "Validation failed", "details": [{"field": "id", "message": "id must be a positive integer"}]}
```

## Protected Endpoints

All endpoints with these methods have validation:

### Authentication
- `POST /api/auth/login` - Email & password validation

### Users
- `GET /api/users/:id` - ID validation
- `POST /api/users` - Full user validation
- `PATCH /api/users/:id` - ID + optional field validation
- `DELETE /api/users/:id` - ID validation

### Cases
- `GET /api/cases/:id` - ID validation
- `POST /api/cases` - Case creation validation
- `PATCH /api/cases/:id` - ID + update validation
- `DELETE /api/cases/:id` - ID validation

### Retention
- `PATCH /api/retention/cases/:caseId/policy` - Policy validation
- `PATCH /api/retention/cases/:caseId/legal-hold` - Boolean validation
- `DELETE /api/retention/cases/:caseId` - ID validation

### Documents
- All document operations sanitized via global middleware

## Security Benefits

### 1. XSS Protection
✅ Prevents script injection in all text fields  
✅ Stops HTML injection attacks  
✅ Protects against stored XSS (data in database)  
✅ Prevents reflected XSS (URL parameters)

### 2. SQL Injection Protection
✅ Parameterized queries prevent SQL injection  
✅ Type validation ensures correct data types  
✅ No raw SQL string concatenation  
✅ Knex.js handles escaping automatically

### 3. Data Integrity
✅ Email addresses are validated and normalized  
✅ Passwords meet strength requirements  
✅ IDs are confirmed as positive integers  
✅ Enum values restricted to allowed set

### 4. API Robustness
✅ Clear error messages for developers  
✅ Field-level error reporting  
✅ Prevents invalid data from entering database  
✅ Reduces attack surface

## Code Examples

### Adding Validation to New Endpoint
```javascript
const { validationRules } = require('../middleware/validate');

// Apply existing rule
router.post('/users', auth, validationRules.createUser, async (req, res) => {
  // req.body is already validated and sanitized
});

// Create custom validation
const customValidation = [
  body('customField')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('customField must be 5-100 characters'),
  handleValidationErrors
];

router.post('/custom', auth, customValidation, async (req, res) => {
  // ...
});
```

### Manual Sanitization
```javascript
const { sanitizeString, sanitizeObject } = require('../middleware/validate');

// Sanitize individual string
const cleanName = sanitizeString(userInput);

// Sanitize entire object
const cleanData = sanitizeObject(req.body);
```

## Maintenance

### Adding New Validation Rules
Edit `/backend/src/middleware/validate.js`:

```javascript
const validationRules = {
  // ... existing rules
  
  newEndpoint: [
    commonValidations.name('fieldName'),
    body('customField')
      .isInt({ min: 1, max: 100 })
      .withMessage('customField must be 1-100'),
    handleValidationErrors
  ]
};
```

### Updating XSS Whitelist
If you need to allow additional HTML tags:

```javascript
const xssOptions = {
  whiteList: {
    b: [],
    i: [],
    em: [],
    strong: [],
    // Add new safe tags here
    span: ['class'], // Allow span with class attribute
  }
};
```

## Dependencies

- **express-validator**: `^7.x` - Validation middleware
- **validator**: `^13.x` - String validators & sanitizers
- **xss**: `^1.x` - XSS filter
- **knex**: `^3.x` - SQL query builder with parameterization

## Production Considerations

### 1. Error Message Sanitization
In production, consider hiding detailed validation errors:

```javascript
if (process.env.NODE_ENV === 'production') {
  return res.status(400).json({ error: 'Invalid input' });
} else {
  return res.status(400).json({ error: 'Validation failed', details: errors.array() });
}
```

### 2. Rate Limiting
Combined with rate limiting, validation provides defense in depth:
- Rate limit prevents brute force attempts
- Validation catches malicious payloads
- Sanitization cleans any bypassed input

### 3. Logging
Log validation failures for security monitoring:

```javascript
console.warn('Validation failed:', {
  ip: req.ip,
  endpoint: req.path,
  errors: errors.array()
});
```

### 4. Content Security Policy
Validation complements CSP headers (already implemented):
- CSP prevents XSS execution in browser
- Input validation prevents XSS storage in database

## Testing Checklist

- [x] XSS in email field blocked
- [x] SQL injection attempts sanitized
- [x] Script tags stripped from text input
- [x] HTML injection prevented
- [x] Invalid emails rejected
- [x] Weak passwords rejected
- [x] Non-integer IDs rejected
- [x] Invalid enum values rejected
- [x] Missing required fields caught
- [x] Excessive string lengths rejected
- [ ] Load testing with valid inputs
- [ ] Penetration testing with OWASP Top 10

## Related Security Features

This validation layer works with:
- **Rate Limiting**: Prevents brute force attacks
- **HTTPS/TLS**: Encrypts data in transit
- **JWT Authentication**: Validates user identity
- **Audit Logging**: Records all access attempts
- **Parameterized Queries**: Knex.js prevents SQL injection
- **File Encryption**: AES-256-GCM for stored files

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [express-validator Documentation](https://express-validator.github.io/docs/)
- [validator.js Documentation](https://github.com/validatorjs/validator.js)
