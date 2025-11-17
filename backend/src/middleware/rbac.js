/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Provides centralized authorization checks for all API endpoints.
 * Ensures consistent role enforcement across the application.
 */

// Define available roles in order of privilege (highest to lowest)
const ROLES = {
  ADMIN: 'admin',      // Full system access, user management, system configuration
  MANAGER: 'manager',  // Case management, user management, retention policies, audit logs
  USER: 'user',        // Case and document access, notifications
  SUPPORT: 'support',  // Read access to cases, documents, audit logs (no modifications)
  VIEWER: 'viewer'     // Read-only access to assigned cases
};

// Role hierarchy for inheritance (higher roles inherit lower role permissions)
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.MANAGER]: [ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.USER]: [ROLES.USER],
  [ROLES.SUPPORT]: [ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.VIEWER]: [ROLES.VIEWER]
};

/**
 * Check if a user's role has permission
 * @param {string} userRole - The user's role
 * @param {string[]} allowedRoles - Array of roles that have permission
 * @returns {boolean} - True if user has permission
 */
function hasPermission(userRole, allowedRoles) {
  if (!userRole || !allowedRoles || !allowedRoles.length) {
    return false;
  }

  // Check if user's role or any inherited roles are in allowed list
  const userHierarchy = ROLE_HIERARCHY[userRole] || [userRole];
  return allowedRoles.some(role => userHierarchy.includes(role));
}

/**
 * Middleware to require specific role(s) for route access
 * @param {...string} roles - One or more roles that have access
 * @returns {Function} - Express middleware function
 * 
 * @example
 * router.get('/users', auth, requireRole('admin', 'manager'), async (req, res) => {
 *   // Only admins and managers can access
 * });
 * 
 * @example
 * router.delete('/cases/:id', auth, requireRole('manager'), async (req, res) => {
 *   // Only managers (and admins by inheritance) can access
 * });
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    // Check if user has required role
    if (!hasPermission(req.user.role, roles)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        required_roles: roles,
        your_role: req.user.role
      });
    }

    // User has permission, continue
    next();
  };
}

/**
 * Check if user has permission to access a specific resource
 * @param {string} userRole - The user's role
 * @param {string} action - The action being performed (read, write, delete, etc.)
 * @param {string} resource - The resource type (case, document, user, etc.)
 * @param {Object} resourceData - Optional resource data for ownership checks
 * @returns {boolean} - True if user has permission
 */
function canAccess(userRole, action, resource, resourceData = {}) {
  // Permission matrix
  const permissions = {
    // Cases
    'case:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
    'case:create': [ROLES.ADMIN, ROLES.MANAGER],
    'case:update': [ROLES.ADMIN, ROLES.MANAGER],
    'case:delete': [ROLES.ADMIN, ROLES.MANAGER],
    
    // Documents
    'document:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
    'document:upload': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT],
    'document:download': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
    'document:delete': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
    
    // Users
    'user:read': [ROLES.ADMIN, ROLES.MANAGER],
    'user:create': [ROLES.ADMIN, ROLES.MANAGER],
    'user:update': [ROLES.ADMIN, ROLES.MANAGER],
    'user:delete': [ROLES.ADMIN, ROLES.MANAGER],
    
    // Audit Logs
    'audit:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT],
    
    // Retention
    'retention:read': [ROLES.ADMIN, ROLES.MANAGER],
    'retention:update': [ROLES.ADMIN, ROLES.MANAGER],
    'retention:delete': [ROLES.ADMIN, ROLES.MANAGER],
    
    // Privacy/GDPR
    'privacy:read': [ROLES.ADMIN, ROLES.MANAGER],
    'privacy:manage': [ROLES.ADMIN, ROLES.MANAGER],
    
    // Notifications
    'notification:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
    'notification:update': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
    
    // Export
    'export:create': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
    
    // Tags
    'tag:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
    'tag:create': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
  };

  const permissionKey = `${resource}:${action}`;
  const allowedRoles = permissions[permissionKey];

  if (!allowedRoles) {
    // Permission not defined, deny by default (fail-secure)
    return false;
  }

  return hasPermission(userRole, allowedRoles);
}

/**
 * Middleware to require specific permission for route access
 * @param {string} action - The action being performed
 * @param {string} resource - The resource type
 * @returns {Function} - Express middleware function
 * 
 * @example
 * router.post('/cases', auth, requirePermission('create', 'case'), async (req, res) => {
 *   // Only users with case:create permission can access
 * });
 */
function requirePermission(action, resource) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    if (!canAccess(req.user.role, action, resource)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You don't have permission to ${action} ${resource}`,
        required_permission: `${resource}:${action}`,
        your_role: req.user.role
      });
    }

    next();
  };
}

/**
 * Check if user can modify a resource they own
 * @param {Object} req - Express request object
 * @param {number} resourceUserId - The user ID who owns the resource
 * @returns {boolean} - True if user can modify
 */
function canModifyOwn(req, resourceUserId) {
  // Admins and managers can modify anything
  if (hasPermission(req.user.role, [ROLES.ADMIN, ROLES.MANAGER])) {
    return true;
  }

  // Users can modify their own resources
  return req.user.id === resourceUserId;
}

/**
 * Get user's effective permissions based on role
 * @param {string} role - User's role
 * @returns {Object} - Object mapping resources to allowed actions
 */
function getUserPermissions(role) {
  const permissions = {};
  
  const resources = ['case', 'document', 'user', 'audit', 'retention', 'privacy', 'notification', 'export', 'tag'];
  const actions = ['read', 'create', 'update', 'delete', 'manage'];

  resources.forEach(resource => {
    permissions[resource] = {};
    actions.forEach(action => {
      permissions[resource][action] = canAccess(role, action, resource);
    });
  });

  return permissions;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requirePermission,
  hasPermission,
  canAccess,
  canModifyOwn,
  getUserPermissions
};
