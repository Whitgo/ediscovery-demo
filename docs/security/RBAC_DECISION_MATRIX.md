# Role-Based Access Control (RBAC) - Decision Matrix

## Overview

The eDiscovery system implements a comprehensive Role-Based Access Control (RBAC) system with five distinct roles. Each role has specific permissions across all resources, following the principle of least privilege.

## Role Hierarchy

```
Admin (Highest Privilege)
  ↓
Manager
  ↓
User
  ↓
Support
  ↓
Viewer (Lowest Privilege)
```

**Role Inheritance:** Higher roles inherit permissions from lower roles (e.g., Admin inherits all Manager permissions).

## Available Roles

### 1. Admin (`admin`)
**Purpose:** System administrators with full access  
**Use Case:** IT staff, system managers, security administrators  
**Demo User:** `admin@demo.com` / `demo123`

### 2. Manager (`manager`)
**Purpose:** Legal team managers with case and user management abilities  
**Use Case:** Senior attorneys, case managers, supervisors  
**Demo User:** `alice@demo.com` / `demo123`

### 3. User (`user`)
**Purpose:** Standard users who work on cases and documents  
**Use Case:** Attorneys, paralegals, legal assistants  
**Demo User:** `bob@demo.com` / `demo123`

### 4. Support (`support`)
**Purpose:** Read access with audit capabilities for support staff  
**Use Case:** Technical support, compliance officers, auditors  
**Demo User:** `sandra@demo.com` / `demo123`

### 5. Viewer (`viewer`)
**Purpose:** Read-only access to assigned cases  
**Use Case:** External consultants, read-only stakeholders  
**Demo User:** `victor@demo.com` / `demo123`

---

## Complete Permission Matrix

| Resource | Action | Admin | Manager | User | Support | Viewer |
|----------|--------|-------|---------|------|---------|--------|
| **Cases** | | | | | | |
| View all cases | ✅ | ✅ | ✅ | ✅ | ✅ |
| View case details | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create case | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update case | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete case | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Documents** | | | | | | |
| View documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete documents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Log document views | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Users** | | | | | | |
| View all users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View user details | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modify admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Audit Logs** | | | | | | |
| View audit logs | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Retention** | | | | | | |
| View retention policies | ✅ | ✅ | ✅ | ✅ | ✅ |
| View approaching cases | ✅ | ✅ | ❌ | ❌ | ❌ |
| View expired cases | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update retention policy | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set/remove legal hold | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete case data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Trigger cleanup | ✅ | ✅ | ❌ | ❌ | ❌ |
| View retention logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| View retention stats | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Privacy/GDPR** | | | | | | |
| Submit data request | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all requests | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve/reject requests | ✅ | ✅ | ❌ | ❌ | ❌ |
| Execute deletions | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Notifications** | | | | | | |
| View notifications | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark as read | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete notification | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage preferences | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Export** | | | | | | |
| Export documents | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Tags** | | | | | | |
| View tags | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create tags | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Implementation

**Location:** `backend/src/middleware/rbac.js`

**Key Functions:**
- `requireRole(...roles)` - Middleware to require specific role(s)
- `requirePermission(action, resource)` - Permission-based access control
- `hasPermission(userRole, allowedRoles)` - Check if user has permission
- `canAccess(userRole, action, resource)` - Resource-action permission check

**Usage Example:**
```javascript
const { requireRole } = require('../middleware/rbac');

// Only admins and managers
router.get('/users', auth, requireRole('admin', 'manager'), async (req, res) => {
  // Handler code
});
```

---

## Testing

```bash
# Login as admin
curl -k -X POST https://localhost:4443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Test with token
curl -k https://localhost:4443/api/users \
  -H "Authorization: Bearer <token>"
```

**See full documentation for complete testing guide.**

---

**Last Updated:** November 17, 2025  
**Status:** ✅ Implemented and Production Ready
