/**
 * Frontend RBAC Utilities
 * Centralized role checking to match backend implementation
 */

// Role definitions (must match backend)
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  SUPPORT: 'support',
  VIEWER: 'viewer'
};

// Role hierarchy (higher roles inherit lower permissions)
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.MANAGER]: [ROLES.MANAGER, ROLES.USER, ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.USER]: [ROLES.USER],
  [ROLES.SUPPORT]: [ROLES.SUPPORT, ROLES.VIEWER],
  [ROLES.VIEWER]: [ROLES.VIEWER]
};

/**
 * Check if a user's role has permission for any of the allowed roles
 * @param {string} userRole - The user's role
 * @param {string[]} allowedRoles - Array of roles that have permission
 * @returns {boolean} - True if user has permission
 */
export function hasRole(userRole, ...allowedRoles) {
  if (!userRole || !allowedRoles || allowedRoles.length === 0) {
    return false;
  }

  // Check if user's role or any inherited roles are in allowed list
  const userHierarchy = ROLE_HIERARCHY[userRole] || [userRole];
  return allowedRoles.some(role => userHierarchy.includes(role));
}

/**
 * Check if user can perform an action on a resource (UI visibility checks)
 * @param {string} userRole - The user's role
 * @param {string} action - The action (read, create, update, delete, etc.)
 * @param {string} resource - The resource (case, document, user, etc.)
 * @returns {boolean} - True if user can perform action
 */
export function canAccess(userRole, action, resource) {
  // Permission matrix (should match backend)
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
    'document:edit': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT],
    
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
    
    // Notifications
    'notification:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
    'notification:update': [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER],
  };

  const permissionKey = `${resource}:${action}`;
  const allowedRoles = permissions[permissionKey];

  if (!allowedRoles) {
    return false; // Deny by default
  }

  return hasRole(userRole, ...allowedRoles);
}

/**
 * Get display label for a role
 * @param {string} role - Role value
 * @returns {string} - Display label
 */
export function getRoleLabel(role) {
  const labels = {
    [ROLES.ADMIN]: 'Admin',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.USER]: 'User',
    [ROLES.SUPPORT]: 'Support',
    [ROLES.VIEWER]: 'Viewer'
  };
  return labels[role] || role;
}

/**
 * Get role description
 * @param {string} role - Role value
 * @returns {string} - Role description
 */
export function getRoleDescription(role) {
  const descriptions = {
    [ROLES.ADMIN]: 'Full system access, user management',
    [ROLES.MANAGER]: 'Case management, user management, retention policies',
    [ROLES.USER]: 'Case and document access, notifications',
    [ROLES.SUPPORT]: 'Read access to cases, documents, audit logs',
    [ROLES.VIEWER]: 'Read-only access to assigned cases'
  };
  return descriptions[role] || '';
}

/**
 * Get all available roles (for dropdowns, etc.)
 * @returns {Array} - Array of role objects with value, label, description
 */
export function getAllRoles() {
  return [
    { value: ROLES.ADMIN, label: getRoleLabel(ROLES.ADMIN), description: getRoleDescription(ROLES.ADMIN) },
    { value: ROLES.MANAGER, label: getRoleLabel(ROLES.MANAGER), description: getRoleDescription(ROLES.MANAGER) },
    { value: ROLES.USER, label: getRoleLabel(ROLES.USER), description: getRoleDescription(ROLES.USER) },
    { value: ROLES.SUPPORT, label: getRoleLabel(ROLES.SUPPORT), description: getRoleDescription(ROLES.SUPPORT) },
    { value: ROLES.VIEWER, label: getRoleLabel(ROLES.VIEWER), description: getRoleDescription(ROLES.VIEWER) }
  ];
}

/**
 * Check if a user can modify their own resource
 * @param {Object} user - User object with id and role
 * @param {number} resourceUserId - User ID who owns the resource
 * @returns {boolean} - True if user can modify
 */
export function canModifyOwn(user, resourceUserId) {
  if (!user) return false;
  
  // Admins and managers can modify anything
  if (hasRole(user.role, ROLES.ADMIN, ROLES.MANAGER)) {
    return true;
  }
  
  // Users can modify their own resources
  return user.id === resourceUserId;
}
