# API Reference

Complete API documentation for all backend endpoints.

## 📑 Contents

### [Authentication API](./auth.md)
- `POST /api/auth/login` - User login
- `GET /api/auth/rate-limit-info` - Rate limit status

### [Cases API](./cases.md)
- `GET /api/cases` - List all cases
- `POST /api/cases` - Create new case
- `GET /api/cases/:id` - Get case details
- `PATCH /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### [Documents API](./documents.md)
- `GET /api/documents/case/:caseId/documents` - List documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:id` - Get document metadata
- `GET /api/documents/:id/download` - Download document
- `DELETE /api/documents/:id` - Delete document

### [Security Dashboard API](./security.md)
- `GET /api/security/dashboard` - Security overview
- `GET /api/security/failed-logins` - Failed login history
- `GET /api/security/audit-logs` - Audit log entries
- `GET /api/security/active-sessions` - Active user sessions
- `GET /api/security/alerts` - Security alerts

### [Retention API](./retention.md)
- `GET /api/retention/stats` - Retention statistics
- `GET /api/retention/cases/approaching` - Cases approaching deadline
- `GET /api/retention/cases/expired` - Expired cases
- `PATCH /api/retention/cases/:id/policy` - Update retention policy
- `POST /api/retention/cases/:id/legal-hold` - Apply legal hold

### [Export API](./export.md)
- `POST /api/export/case/:caseId` - Export case
- `POST /api/export/documents` - Export documents
- `GET /api/export/:exportId/download` - Download export

### [Tags API](./tags.md)
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag
- `GET /api/tags/:id` - Get tag details
- `POST /api/tags/documents/:documentId/tags` - Tag document
- `DELETE /api/tags/documents/:documentId/tags/:tagId` - Remove tag

### [Outlook API](./outlook.md)
- `GET /api/outlook/auth-url` - Get OAuth URL
- `POST /api/outlook/callback` - OAuth callback
- `GET /api/outlook/messages` - List emails
- `POST /api/outlook/import` - Import email to case

### [Backup API](./backup.md)
- `POST /api/backup/create` - Create backup
- `GET /api/backup/list` - List backups
- `POST /api/backup/restore` - Restore from backup

### [Incidents API](./incidents.md)
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `GET /api/incidents/:id` - Get incident details
- `PATCH /api/incidents/:id` - Update incident

## 🔐 Authentication

All API endpoints (except `/api/auth/login`) require authentication via JWT token:

```http
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

```bash
curl -X POST http://localhost:4443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

Response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "role": "admin",
    "email": "admin@demo.com"
  }
}
```

## 🛡️ Role-Based Access

API endpoints enforce RBAC. Required roles are documented in each endpoint.

| Role | Permissions |
|------|-------------|
| **admin** | Full access to all endpoints |
| **manager** | Case management, retention, security monitoring |
| **user** | Case and document operations |
| **support** | Audit logs, incident response |
| **viewer** | Read-only access |

## 📊 Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

## 🔢 HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 📝 Common Parameters

### Pagination
```
?limit=50&offset=0
```

### Filtering
```
?status=open&assigned_to=user@example.com
```

### Sorting
```
?sortBy=created_at&order=desc
```

### Date Range
```
?startDate=2024-01-01&endDate=2024-12-31
```

## 🚀 Rate Limiting

Authentication endpoints are rate-limited:
- **Window**: 15 minutes
- **Max Requests**: 5 failed attempts
- **Scope**: Per IP address

Check rate limit status:
```bash
curl http://localhost:4443/api/auth/rate-limit-info
```

## 🔗 Base URLs

- **Development**: `https://localhost:4443`
- **Production**: Configure via `API_BASE_URL` environment variable

## 📖 API Versioning

Current version: **v1** (no version prefix required)

Future versions will use prefix: `/api/v2/...`

## 🧪 Testing API Endpoints

### Using cURL
```bash
curl -X GET https://localhost:4443/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -k
```

### Using HTTPie
```bash
http GET https://localhost:4443/api/cases \
  "Authorization:Bearer $TOKEN" \
  --verify=no
```

### Using Postman
1. Import API collection
2. Set `Authorization` header with Bearer token
3. Disable SSL verification for development

---

**Last Updated**: November 26, 2025  
**API Version**: 1.0  
**Base URL**: https://localhost:4443
