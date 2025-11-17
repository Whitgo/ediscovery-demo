/**
 * Unit Tests for RBAC Middleware
 * Tests role hierarchy, permissions, and access control across all endpoints
 */

const {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requirePermission,
  hasPermission,
  canAccess,
  canModifyOwn,
  getUserPermissions
} = require('../src/middleware/rbac');

describe('RBAC System', () => {
  
  // ============================================================================
  // Constants and Configuration
  // ============================================================================
  describe('ROLES constant', () => {
    test('Should define all five roles', () => {
      expect(ROLES.ADMIN).toBe('admin');
      expect(ROLES.MANAGER).toBe('manager');
      expect(ROLES.USER).toBe('user');
      expect(ROLES.SUPPORT).toBe('support');
      expect(ROLES.VIEWER).toBe('viewer');
    });
    
    test('Should have exactly 5 roles', () => {
      expect(Object.keys(ROLES)).toHaveLength(5);
    });
  });
  
  describe('ROLE_HIERARCHY constant', () => {
    test('Admin should inherit all roles', () => {
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toContain(ROLES.ADMIN);
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toContain(ROLES.MANAGER);
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toContain(ROLES.USER);
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toContain(ROLES.SUPPORT);
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toContain(ROLES.VIEWER);
      expect(ROLE_HIERARCHY[ROLES.ADMIN]).toHaveLength(5);
    });
    
    test('Manager should inherit manager, user, support, and viewer', () => {
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).toContain(ROLES.MANAGER);
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).toContain(ROLES.USER);
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).toContain(ROLES.SUPPORT);
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).toContain(ROLES.VIEWER);
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).not.toContain(ROLES.ADMIN);
      expect(ROLE_HIERARCHY[ROLES.MANAGER]).toHaveLength(4);
    });
    
    test('User should only inherit user role', () => {
      expect(ROLE_HIERARCHY[ROLES.USER]).toContain(ROLES.USER);
      expect(ROLE_HIERARCHY[ROLES.USER]).not.toContain(ROLES.ADMIN);
      expect(ROLE_HIERARCHY[ROLES.USER]).not.toContain(ROLES.MANAGER);
      expect(ROLE_HIERARCHY[ROLES.USER]).toHaveLength(1);
    });
    
    test('Support should inherit support and viewer', () => {
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).toContain(ROLES.SUPPORT);
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).toContain(ROLES.VIEWER);
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).not.toContain(ROLES.ADMIN);
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).not.toContain(ROLES.MANAGER);
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).not.toContain(ROLES.USER);
      expect(ROLE_HIERARCHY[ROLES.SUPPORT]).toHaveLength(2);
    });
    
    test('Viewer should only inherit viewer role', () => {
      expect(ROLE_HIERARCHY[ROLES.VIEWER]).toContain(ROLES.VIEWER);
      expect(ROLE_HIERARCHY[ROLES.VIEWER]).toHaveLength(1);
    });
  });
  
  // ============================================================================
  // hasPermission Function
  // ============================================================================
  describe('hasPermission()', () => {
    test('Should return true when user role matches allowed role', () => {
      expect(hasPermission('manager', ['manager'])).toBe(true);
      expect(hasPermission('user', ['user'])).toBe(true);
    });
    
    test('Should return true when user role inherits allowed role', () => {
      expect(hasPermission('admin', ['manager'])).toBe(true);
      expect(hasPermission('admin', ['user'])).toBe(true);
      expect(hasPermission('admin', ['viewer'])).toBe(true);
      expect(hasPermission('manager', ['viewer'])).toBe(true);
      expect(hasPermission('support', ['viewer'])).toBe(true);
    });
    
    test('Should return false when user role does not have permission', () => {
      expect(hasPermission('user', ['manager'])).toBe(false);
      expect(hasPermission('user', ['admin'])).toBe(false);
      expect(hasPermission('viewer', ['user'])).toBe(false);
      expect(hasPermission('viewer', ['manager'])).toBe(false);
      expect(hasPermission('manager', ['admin'])).toBe(false);
    });
    
    test('Should return true when user role matches any in allowed list', () => {
      expect(hasPermission('user', ['admin', 'manager', 'user'])).toBe(true);
      expect(hasPermission('manager', ['admin', 'manager'])).toBe(true);
    });
    
    test('Should handle invalid inputs gracefully', () => {
      expect(hasPermission(null, ['manager'])).toBe(false);
      expect(hasPermission('manager', null)).toBe(false);
      expect(hasPermission('manager', [])).toBe(false);
      expect(hasPermission('', ['manager'])).toBe(false);
    });
    
    test('Should handle unknown roles', () => {
      expect(hasPermission('unknown_role', ['manager'])).toBe(false);
    });
  });
  
  // ============================================================================
  // canAccess Function - Permission Matrix
  // ============================================================================
  describe('canAccess() - Case Permissions', () => {
    test('All roles should be able to read cases', () => {
      expect(canAccess('admin', 'read', 'case')).toBe(true);
      expect(canAccess('manager', 'read', 'case')).toBe(true);
      expect(canAccess('user', 'read', 'case')).toBe(true);
      expect(canAccess('support', 'read', 'case')).toBe(true);
      expect(canAccess('viewer', 'read', 'case')).toBe(true);
    });
    
    test('Only admin and manager should create cases', () => {
      expect(canAccess('admin', 'create', 'case')).toBe(true);
      expect(canAccess('manager', 'create', 'case')).toBe(true);
      expect(canAccess('user', 'create', 'case')).toBe(false);
      expect(canAccess('support', 'create', 'case')).toBe(false);
      expect(canAccess('viewer', 'create', 'case')).toBe(false);
    });
    
    test('Only admin and manager should update cases', () => {
      expect(canAccess('admin', 'update', 'case')).toBe(true);
      expect(canAccess('manager', 'update', 'case')).toBe(true);
      expect(canAccess('user', 'update', 'case')).toBe(false);
      expect(canAccess('support', 'update', 'case')).toBe(false);
      expect(canAccess('viewer', 'update', 'case')).toBe(false);
    });
    
    test('Only admin and manager should delete cases', () => {
      expect(canAccess('admin', 'delete', 'case')).toBe(true);
      expect(canAccess('manager', 'delete', 'case')).toBe(true);
      expect(canAccess('user', 'delete', 'case')).toBe(false);
      expect(canAccess('support', 'delete', 'case')).toBe(false);
      expect(canAccess('viewer', 'delete', 'case')).toBe(false);
    });
  });
  
  describe('canAccess() - Document Permissions', () => {
    test('All roles should read and download documents', () => {
      ['admin', 'manager', 'user', 'support', 'viewer'].forEach(role => {
        expect(canAccess(role, 'read', 'document')).toBe(true);
        expect(canAccess(role, 'download', 'document')).toBe(true);
      });
    });
    
    test('All except viewer should upload documents', () => {
      expect(canAccess('admin', 'upload', 'document')).toBe(true);
      expect(canAccess('manager', 'upload', 'document')).toBe(true);
      expect(canAccess('user', 'upload', 'document')).toBe(true);
      expect(canAccess('support', 'upload', 'document')).toBe(true);
      expect(canAccess('viewer', 'upload', 'document')).toBe(false);
    });
    
    test('Only admin, manager, and user should delete documents', () => {
      expect(canAccess('admin', 'delete', 'document')).toBe(true);
      expect(canAccess('manager', 'delete', 'document')).toBe(true);
      expect(canAccess('user', 'delete', 'document')).toBe(true);
      expect(canAccess('support', 'delete', 'document')).toBe(false);
      expect(canAccess('viewer', 'delete', 'document')).toBe(false);
    });
  });
  
  describe('canAccess() - User Management Permissions', () => {
    test('Only admin and manager should manage users', () => {
      ['read', 'create', 'update', 'delete'].forEach(action => {
        expect(canAccess('admin', action, 'user')).toBe(true);
        expect(canAccess('manager', action, 'user')).toBe(true);
        expect(canAccess('user', action, 'user')).toBe(false);
        expect(canAccess('support', action, 'user')).toBe(false);
        expect(canAccess('viewer', action, 'user')).toBe(false);
      });
    });
  });
  
  describe('canAccess() - Audit Log Permissions', () => {
    test('Admin, manager, and support should read audit logs', () => {
      expect(canAccess('admin', 'read', 'audit')).toBe(true);
      expect(canAccess('manager', 'read', 'audit')).toBe(true);
      expect(canAccess('support', 'read', 'audit')).toBe(true);
      expect(canAccess('user', 'read', 'audit')).toBe(false);
      expect(canAccess('viewer', 'read', 'audit')).toBe(false);
    });
  });
  
  describe('canAccess() - Retention Permissions', () => {
    test('Only admin and manager should manage retention', () => {
      ['read', 'update', 'delete'].forEach(action => {
        expect(canAccess('admin', action, 'retention')).toBe(true);
        expect(canAccess('manager', action, 'retention')).toBe(true);
        expect(canAccess('user', action, 'retention')).toBe(false);
        expect(canAccess('support', action, 'retention')).toBe(false);
        expect(canAccess('viewer', action, 'retention')).toBe(false);
      });
    });
  });
  
  describe('canAccess() - Privacy/GDPR Permissions', () => {
    test('Only admin and manager should manage privacy requests', () => {
      expect(canAccess('admin', 'read', 'privacy')).toBe(true);
      expect(canAccess('manager', 'read', 'privacy')).toBe(true);
      expect(canAccess('admin', 'manage', 'privacy')).toBe(true);
      expect(canAccess('manager', 'manage', 'privacy')).toBe(true);
      expect(canAccess('user', 'read', 'privacy')).toBe(false);
      expect(canAccess('support', 'read', 'privacy')).toBe(false);
    });
  });
  
  describe('canAccess() - Notification Permissions', () => {
    test('Admin, manager, and user should manage notifications', () => {
      expect(canAccess('admin', 'read', 'notification')).toBe(true);
      expect(canAccess('manager', 'read', 'notification')).toBe(true);
      expect(canAccess('user', 'read', 'notification')).toBe(true);
      expect(canAccess('support', 'read', 'notification')).toBe(false);
      expect(canAccess('viewer', 'read', 'notification')).toBe(false);
      
      expect(canAccess('admin', 'update', 'notification')).toBe(true);
      expect(canAccess('manager', 'update', 'notification')).toBe(true);
      expect(canAccess('user', 'update', 'notification')).toBe(true);
    });
  });
  
  describe('canAccess() - Export Permissions', () => {
    test('Admin, manager, and user should create exports', () => {
      expect(canAccess('admin', 'create', 'export')).toBe(true);
      expect(canAccess('manager', 'create', 'export')).toBe(true);
      expect(canAccess('user', 'create', 'export')).toBe(true);
      expect(canAccess('support', 'create', 'export')).toBe(false);
      expect(canAccess('viewer', 'create', 'export')).toBe(false);
    });
  });
  
  describe('canAccess() - Tag Permissions', () => {
    test('All roles should read tags', () => {
      ['admin', 'manager', 'user', 'support', 'viewer'].forEach(role => {
        expect(canAccess(role, 'read', 'tag')).toBe(true);
      });
    });
    
    test('Only admin, manager, and user should create tags', () => {
      expect(canAccess('admin', 'create', 'tag')).toBe(true);
      expect(canAccess('manager', 'create', 'tag')).toBe(true);
      expect(canAccess('user', 'create', 'tag')).toBe(true);
      expect(canAccess('support', 'create', 'tag')).toBe(false);
      expect(canAccess('viewer', 'create', 'tag')).toBe(false);
    });
  });
  
  describe('canAccess() - Undefined Permissions', () => {
    test('Should deny access to undefined permissions (fail-secure)', () => {
      expect(canAccess('admin', 'unknown_action', 'case')).toBe(false);
      expect(canAccess('admin', 'read', 'unknown_resource')).toBe(false);
      expect(canAccess('manager', 'hack', 'database')).toBe(false);
    });
  });
  
  // ============================================================================
  // canModifyOwn Function
  // ============================================================================
  describe('canModifyOwn()', () => {
    const createMockRequest = (userId, userRole) => ({
      user: { id: userId, role: userRole }
    });
    
    test('Admin should modify any resource', () => {
      const req = createMockRequest(1, 'admin');
      expect(canModifyOwn(req, 999)).toBe(true);
      expect(canModifyOwn(req, 1)).toBe(true);
    });
    
    test('Manager should modify any resource', () => {
      const req = createMockRequest(2, 'manager');
      expect(canModifyOwn(req, 999)).toBe(true);
      expect(canModifyOwn(req, 2)).toBe(true);
    });
    
    test('User should only modify own resources', () => {
      const req = createMockRequest(3, 'user');
      expect(canModifyOwn(req, 3)).toBe(true);
      expect(canModifyOwn(req, 999)).toBe(false);
    });
    
    test('Support should only modify own resources', () => {
      const req = createMockRequest(4, 'support');
      expect(canModifyOwn(req, 4)).toBe(true);
      expect(canModifyOwn(req, 999)).toBe(false);
    });
    
    test('Viewer should only modify own resources', () => {
      const req = createMockRequest(5, 'viewer');
      expect(canModifyOwn(req, 5)).toBe(true);
      expect(canModifyOwn(req, 999)).toBe(false);
    });
  });
  
  // ============================================================================
  // getUserPermissions Function
  // ============================================================================
  describe('getUserPermissions()', () => {
    test('Should return permission object for admin', () => {
      const permissions = getUserPermissions('admin');
      expect(permissions).toHaveProperty('case');
      expect(permissions).toHaveProperty('document');
      expect(permissions).toHaveProperty('user');
      expect(permissions.case.read).toBe(true);
      expect(permissions.case.create).toBe(true);
      expect(permissions.user.create).toBe(true);
    });
    
    test('Admin should have all permissions', () => {
      const permissions = getUserPermissions('admin');
      expect(permissions.case.read).toBe(true);
      expect(permissions.case.create).toBe(true);
      expect(permissions.case.update).toBe(true);
      expect(permissions.case.delete).toBe(true);
      expect(permissions.user.read).toBe(true);
      expect(permissions.user.create).toBe(true);
    });
    
    test('Viewer should have minimal permissions', () => {
      const permissions = getUserPermissions('viewer');
      expect(permissions.case.read).toBe(true);
      expect(permissions.case.create).toBe(false);
      expect(permissions.case.update).toBe(false);
      expect(permissions.case.delete).toBe(false);
      expect(permissions.user.read).toBe(false);
      expect(permissions.document.read).toBe(true);
      expect(permissions.document.create).toBe(false); // No upload action in matrix
    });
    
    test('User should have intermediate permissions', () => {
      const permissions = getUserPermissions('user');
      expect(permissions.case.read).toBe(true);
      expect(permissions.case.create).toBe(false);
      expect(permissions.document.read).toBe(true);
      expect(permissions.document.create).toBe(false); // No upload action in matrix
      expect(permissions.document.delete).toBe(true);
      expect(permissions.user.read).toBe(false);
    });
  });
  
  // ============================================================================
  // requireRole Middleware
  // ============================================================================
  describe('requireRole() Middleware', () => {
    let req, res, next;
    
    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });
    
    test('Should call next() when user has required role', () => {
      req.user = { id: 1, role: 'admin' };
      const middleware = requireRole('admin');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('Should call next() when user role inherits required role', () => {
      req.user = { id: 1, role: 'admin' };
      const middleware = requireRole('manager');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('Should call next() when user has one of multiple required roles', () => {
      req.user = { id: 2, role: 'user' };
      const middleware = requireRole('admin', 'manager', 'user');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    test('Should return 401 when user is not authenticated', () => {
      req.user = null;
      const middleware = requireRole('manager');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Authentication required'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('Should return 403 when user lacks required role', () => {
      req.user = { id: 3, role: 'user' };
      const middleware = requireRole('manager');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Access denied',
        required_roles: ['manager'],
        your_role: 'user'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('Should return 403 when viewer tries admin-only action', () => {
      req.user = { id: 5, role: 'viewer' };
      const middleware = requireRole('admin', 'manager');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
    
    test('Should prevent privilege escalation (manager trying admin)', () => {
      req.user = { id: 2, role: 'manager' };
      const middleware = requireRole('admin');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        required_roles: ['admin'],
        your_role: 'manager'
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // requirePermission Middleware
  // ============================================================================
  describe('requirePermission() Middleware', () => {
    let req, res, next;
    
    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });
    
    test('Should call next() when user has permission', () => {
      req.user = { id: 1, role: 'admin' };
      const middleware = requirePermission('create', 'case');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    test('Should return 401 when not authenticated', () => {
      req.user = null;
      const middleware = requirePermission('read', 'case');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
    
    test('Should return 403 when user lacks permission', () => {
      req.user = { id: 3, role: 'user' };
      const middleware = requirePermission('delete', 'user');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Access denied',
        required_permission: 'user:delete',
        your_role: 'user'
      }));
      expect(next).not.toHaveBeenCalled();
    });
    
    test('Should allow viewer to read documents', () => {
      req.user = { id: 5, role: 'viewer' };
      const middleware = requirePermission('read', 'document');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    test('Should prevent viewer from uploading documents', () => {
      req.user = { id: 5, role: 'viewer' };
      const middleware = requirePermission('upload', 'document');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // Integration Tests - Real-World Scenarios
  // ============================================================================
  describe('Integration Scenarios', () => {
    test('Scenario: Admin creates a manager account', () => {
      // Admin has permission to create users
      expect(canAccess('admin', 'create', 'user')).toBe(true);
      
      // Admin can assign manager role (handled in API endpoint logic)
      const req = { user: { id: 1, role: 'admin' } };
      expect(canModifyOwn(req, 999)).toBe(true);
    });
    
    test('Scenario: Manager tries to create admin account (should fail)', () => {
      // Manager has permission to create users
      expect(canAccess('manager', 'create', 'user')).toBe(true);
      
      // But admin creation check happens in API endpoint
      // Manager does NOT have admin role
      expect(hasPermission('manager', ['admin'])).toBe(false);
    });
    
    test('Scenario: User uploads and deletes own document', () => {
      const userId = 3;
      const req = { user: { id: userId, role: 'user' } };
      
      // User can upload
      expect(canAccess('user', 'upload', 'document')).toBe(true);
      
      // User can delete
      expect(canAccess('user', 'delete', 'document')).toBe(true);
      
      // User can modify own resources
      expect(canModifyOwn(req, userId)).toBe(true);
    });
    
    test('Scenario: Support views audit logs', () => {
      expect(canAccess('support', 'read', 'audit')).toBe(true);
      expect(canAccess('support', 'read', 'case')).toBe(true);
      expect(canAccess('support', 'read', 'document')).toBe(true);
    });
    
    test('Scenario: Viewer has read-only access', () => {
      expect(canAccess('viewer', 'read', 'case')).toBe(true);
      expect(canAccess('viewer', 'read', 'document')).toBe(true);
      expect(canAccess('viewer', 'download', 'document')).toBe(true);
      
      // Cannot modify anything
      expect(canAccess('viewer', 'create', 'case')).toBe(false);
      expect(canAccess('viewer', 'upload', 'document')).toBe(false);
      expect(canAccess('viewer', 'delete', 'document')).toBe(false);
    });
    
    test('Scenario: Role hierarchy - Admin has all manager permissions', () => {
      const managerPerms = getUserPermissions('manager');
      
      // Check that admin can do everything manager can
      Object.keys(managerPerms).forEach(resource => {
        Object.keys(managerPerms[resource]).forEach(action => {
          if (managerPerms[resource][action]) {
            expect(canAccess('admin', action, resource)).toBe(true);
          }
        });
      });
    });
    
    test('Scenario: Prevent privilege escalation attempts', () => {
      // User cannot access manager-only endpoints
      expect(hasPermission('user', ['manager'])).toBe(false);
      expect(hasPermission('user', ['admin'])).toBe(false);
      
      // Manager cannot access admin-only endpoints
      expect(hasPermission('manager', ['admin'])).toBe(false);
      
      // Support cannot access user management
      expect(canAccess('support', 'create', 'user')).toBe(false);
      expect(canAccess('support', 'update', 'user')).toBe(false);
    });
    
    test('Scenario: Multiple roles allowed (notifications)', () => {
      // Admin, manager, and user can all manage notifications
      expect(hasPermission('admin', ['admin', 'manager', 'user'])).toBe(true);
      expect(hasPermission('manager', ['admin', 'manager', 'user'])).toBe(true);
      expect(hasPermission('user', ['admin', 'manager', 'user'])).toBe(true);
      
      // But support and viewer cannot
      expect(hasPermission('support', ['admin', 'manager', 'user'])).toBe(false);
      expect(hasPermission('viewer', ['admin', 'manager', 'user'])).toBe(false);
    });
  });
});
