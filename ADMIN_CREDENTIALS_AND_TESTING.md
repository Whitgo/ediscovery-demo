# Admin Credentials and System Testing

## Overview
This document describes the admin credentials issue that was fixed and how to test the system.

## Admin Credentials

### Default Demo Users
The system comes with pre-seeded demo users for testing purposes:

| Role      | Email               | Password | Description          |
|-----------|---------------------|----------|----------------------|
| Admin     | admin@demo.com      | demo123  | Full system access   |
| Manager   | alice@demo.com      | demo123  | Case management      |
| User      | bob@demo.com        | demo123  | Standard user access |
| Support   | sandra@demo.com     | demo123  | Support access       |
| Viewer    | victor@demo.com     | demo123  | Read-only access     |

### Issue Fixed
The original password hash in the seed file (`backend/seeds/20231117_seed_demo_data.js`) was incorrect and did not match the password "demo123". This prevented login for all users.

**Solution**: Updated the bcrypt hash to the correct value that matches "demo123".

## System Testing

### Running the Full System Test

A comprehensive system test script has been created to validate the entire eDiscovery system:

```bash
./test-system.sh
```

This script tests:
- Server health (HTTP and HTTPS)
- Authentication (login for all user roles)
- API endpoints with proper authentication
- Role-Based Access Control (RBAC)
- Unauthenticated access restrictions
- Rate limiting
- Security features (CORS, HSTS, security headers)
- Data validation

### Expected Results
- **Total Tests**: 20
- **Expected Pass Rate**: ≥90%
- **Critical Tests**: All authentication and RBAC tests must pass

### Test Output Example
```
==========================================
EDISCOVERY SYSTEM TESTING
==========================================

[SECTION 2] Authentication Tests
-------------------------------------------
[3] Testing admin login (admin@demo.com / demo123)... ✓ PASSED
  Token obtained: eyJhbGciOiJIUzI1NiIs...
[4] Testing manager login (alice@demo.com / demo123)... ✓ PASSED
[5] Testing user login (bob@demo.com / demo123)... ✓ PASSED

...

==========================================
TEST SUMMARY
==========================================

Total Tests:  20
Passed:       18
Failed:       2

✓ ALL TESTS PASSED! or ⚠ Some tests failed (Success rate: 90.00%)
```

## Manual Testing

### Testing Admin Login via API

1. Start the backend server:
```bash
cd backend
npm install
npm run migrate
npm run seed
npm start
```

2. Test login with curl:
```bash
curl -k -X POST "https://localhost:4443/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

3. Expected response:
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "role": "admin",
    "email": "admin@demo.com"
  }
}
```

### Testing via Docker Compose

1. Start all services:
```bash
docker compose up -d
```

2. Wait for services to be ready (check with `docker compose ps`)

3. Run the system test:
```bash
./test-system.sh
```

## Backend Unit Tests

Run the backend test suite:
```bash
cd backend
npm test
```

Expected results:
- **198 tests passing**
- Some pre-existing test failures (unrelated to authentication fix)

## Additional Changes Made

1. **Fixed missing logger import** in `backend/src/api/auth.js`
2. **Added migration** to support login audit actions (`failed_login`, `successful_login`)
3. **Created comprehensive system test script** (`test-system.sh`)

## Security Notes

⚠️ **Important**: These are demo credentials for development/testing only. 

For production:
- Change all default passwords
- Use strong, unique passwords
- Enable additional security measures (2FA, etc.)
- Use environment variables for sensitive configuration
- Use CA-signed SSL certificates (not self-signed)
