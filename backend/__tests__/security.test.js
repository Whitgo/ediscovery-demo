/**
 * Unit Tests for Security Monitoring API
 * Tests security dashboard, audit logs, failed logins, and access control
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock audit middleware to prevent real Knex connection
jest.mock('../src/middleware/audit', () => jest.fn().mockResolvedValue(undefined));

// Mock the auth middleware before importing routes
jest.mock('../src/middleware/auth', () => (req, res, next) => next());

// Mock logger to prevent console output during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logAudit: jest.fn(),
  logSecurity: jest.fn(),
  logError: jest.fn(),
  logRequest: jest.fn(),
  logResponse: jest.fn()
}));

const securityRouter = require('../src/api/security');
const logger = require('../src/utils/logger');

// Setup Express app for testing
function setupApp() {
  const app = express();
  app.use(express.json());
  
  // Mock knex middleware
  app.use((req, res, next) => {
    req.knex = mockKnex;
    req.ip = '127.0.0.1';
    next();
  });
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });
  
  app.use('/api/security', securityRouter);
  
  return app;
}

// Create mock knex database with chainable methods
function createMockKnex() {
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereLike: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    modify: jest.fn().mockReturnThis(),
    first: jest.fn(),
    then: jest.fn()
  };
  
  const mockKnex = jest.fn((tableName) => mockChain);
  mockKnex.fn = { now: () => new Date().toISOString() };
  mockKnex.transaction = jest.fn();
  mockKnex.raw = jest.fn().mockReturnValue('NOW()');
  
  // Attach chain methods to mockKnex itself for direct calls
  Object.assign(mockKnex, mockChain);
  
  return mockKnex;
}

const mockKnex = createMockKnex();

// Generate test JWT token
function generateToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

// Test users
const adminUser = { id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' };
const managerUser = { id: 2, email: 'manager@test.com', name: 'Manager', role: 'manager' };
const regularUser = { id: 3, email: 'user@test.com', name: 'User', role: 'user' };
const supportUser = { id: 4, email: 'support@test.com', name: 'Support', role: 'support' };
const viewerUser = { id: 5, email: 'viewer@test.com', name: 'Viewer', role: 'viewer' };

// Sample audit log data
const mockFailedLogin = {
  id: 1,
  action: 'failed_login',
  user: null,
  timestamp: new Date('2025-11-18T10:00:00Z'),
  details: JSON.stringify({ ip: '192.168.1.100', reason: 'Invalid password' }),
  object_type: null,
  object_id: null
};

const mockSuccessfulLogin = {
  id: 2,
  action: 'login',
  user: 3,
  timestamp: new Date('2025-11-18T11:00:00Z'),
  details: JSON.stringify({ ip: '192.168.1.101' }),
  object_type: null,
  object_id: null
};

const mockSecurityEvent = {
  id: 3,
  action: 'access_denied',
  user: 3,
  timestamp: new Date('2025-11-18T09:00:00Z'),
  details: JSON.stringify({ reason: 'Insufficient permissions', status: 403 }),
  object_type: 'case',
  object_id: 123
};

const mockAuditLogWithUser = {
  id: 4,
  action: 'case_created',
  user: 2,
  username: 'manager@test.com',
  email: 'manager@test.com',
  role: 'manager',
  timestamp: new Date('2025-11-18T12:00:00Z'),
  details: JSON.stringify({ caseId: 456 }),
  object_type: 'case',
  object_id: 456
};

describe('Security Monitoring API', () => {
  let app;
  
  beforeEach(() => {
    app = setupApp();
    jest.clearAllMocks();
  });
  
  // ============================================================================
  // GET /api/security/dashboard - Security Dashboard
  // ============================================================================
  describe('GET /api/security/dashboard', () => {
    test('Normal: Should return comprehensive dashboard data for admin', async () => {
      const token = generateToken(adminUser);
      
      // Mock all chain methods and resolve queries
      const mockQuery = () => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          whereNotNull: jest.fn().mockReturnThis(),
          whereRaw: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          having: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          distinct: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          modify: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: '0' }),
          then: jest.fn((cb) => cb({ count: '0' }))
        };
        // Return empty array by default for terminal methods
        return Object.assign(Promise.resolve([]), chain);
      };
      
      mockKnex.mockImplementation(mockQuery);
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('failedLoginCount24h');
      expect(response.body.stats).toHaveProperty('successfulLoginCount24h');
      expect(response.body.stats).toHaveProperty('activeSessionCount');
      expect(response.body).toHaveProperty('failedLogins');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('securityEvents');
      expect(response.body).toHaveProperty('topUsers');
      expect(response.body).toHaveProperty('suspiciousIPs');
      expect(logger.logAudit).toHaveBeenCalledWith('security_dashboard_accessed', adminUser.id, expect.objectContaining({ ip: expect.any(String) }));
    });
    
    test('Normal: Should return dashboard data for manager', async () => {
      const token = generateToken(managerUser);
      
      // Simple mock setup
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      }));
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(logger.logAudit).toHaveBeenCalledWith('security_dashboard_accessed', managerUser.id, expect.any(Object));
    });
    
    test('Error: Should deny access for regular user', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should deny access for support user', async () => {
      const token = generateToken(supportUser);
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should deny access for viewer', async () => {
      const token = generateToken(viewerUser);
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should require authentication', async () => {
      const response = await request(app)
        .get('/api/security/dashboard');
      
      expect(response.status).toBe(401);
    });
    
    test('Error: Should handle database errors gracefully', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      }));
      
      const response = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // GET /api/security/failed-logins - Failed Login History
  // ============================================================================
  describe('GET /api/security/failed-logins', () => {
    test('Normal: Should return failed login history with default parameters', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([mockFailedLogin]),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '10' })
      }));
      
      const response = await request(app)
        .get('/api/security/failed-logins')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit', 100);
      expect(response.body).toHaveProperty('offset', 0);
    });
    
    test('Normal: Should accept custom pagination parameters', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '150' })
      }));
      
      const response = await request(app)
        .get('/api/security/failed-logins?limit=50&offset=25&hours=48')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(25);
    });
    
    test('Normal: Manager should have access', async () => {
      const token = generateToken(managerUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      }));
      
      const response = await request(app)
        .get('/api/security/failed-logins')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Error: Should deny access for non-admin/manager users', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/security/failed-logins')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockRejectedValue(new Error('Query failed'))
      }));
      
      const response = await request(app)
        .get('/api/security/failed-logins')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // GET /api/security/audit-logs - Audit Logs
  // ============================================================================
  describe('GET /api/security/audit-logs', () => {
    test('Normal: Should return audit logs for admin', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([mockAuditLogWithUser]),
        modify: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '50' })
      }));
      
      const response = await request(app)
        .get('/api/security/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
    });
    
    test('Normal: Should filter by action', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([mockSuccessfulLogin]),
        modify: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '20' })
      }));
      
      const response = await request(app)
        .get('/api/security/audit-logs?action=login')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Normal: Should filter by user ID', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([mockAuditLogWithUser]),
        modify: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '10' })
      }));
      
      const response = await request(app)
        .get('/api/security/audit-logs?user=2')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Normal: Should allow support user access', async () => {
      const token = generateToken(supportUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        modify: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      }));
      
      const response = await request(app)
        .get('/api/security/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Error: Should deny access for regular user', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/security/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockRejectedValue(new Error('Database error'))
      }));
      
      const response = await request(app)
        .get('/api/security/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // GET /api/security/active-sessions - Active Sessions
  // ============================================================================
  describe('GET /api/security/active-sessions', () => {
    test('Normal: Should return active sessions for admin', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([
          {
            user: 2,
            username: 'manager@test.com',
            email: 'manager@test.com',
            role: 'manager',
            last_activity: new Date('2025-11-18T12:30:00Z')
          },
          {
            user: 3,
            username: 'user@test.com',
            email: 'user@test.com',
            role: 'user',
            last_activity: new Date('2025-11-18T12:25:00Z')
          }
        ])
      }));
      
      const response = await request(app)
        .get('/api/security/active-sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(2);
    });
    
    test('Normal: Should return empty sessions when none active', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      }));
      
      const response = await request(app)
        .get('/api/security/active-sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.sessions).toEqual([]);
    });
    
    test('Normal: Manager should have access', async () => {
      const token = generateToken(managerUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      }));
      
      const response = await request(app)
        .get('/api/security/active-sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Error: Should deny access for non-admin/manager', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/security/active-sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockRejectedValue(new Error('Connection timeout'))
      }));
      
      const response = await request(app)
        .get('/api/security/active-sessions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // GET /api/security/alerts - Security Alerts
  // ============================================================================
  describe('GET /api/security/alerts', () => {
    test('Normal: Should return security alerts for admin', async () => {
      const token = generateToken(adminUser);
      
      let callCount = 0;
      mockKnex.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Suspicious IPs query
          return {
            select: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            whereRaw: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            having: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockResolvedValue([
              { ip: '192.168.1.100', attempts: '8' },
              { ip: '10.0.0.50', attempts: '6' }
            ])
          };
        } else if (callCount === 2) {
          // Unauthorized attempts query
          return {
            where: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ count: '25' })
          };
        } else {
          // Restore operations query
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([
              {
                id: 100,
                action: 'backup_restored',
                user: 1,
                timestamp: new Date('2025-11-18T10:00:00Z')
              }
            ])
          };
        }
      });
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });
    
    test('Normal: Should categorize alerts by severity', async () => {
      const token = generateToken(adminUser);
      
      let callCount = 0;
      mockKnex.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            whereRaw: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            having: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockResolvedValue([
              { ip: '192.168.1.100', attempts: '15' } // High severity (>=10)
            ])
          };
        } else if (callCount === 2) {
          return {
            where: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ count: '5' }) // Below threshold
          };
        } else {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([])
          };
        }
      });
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      // Check that high severity alert exists for 15 attempts
      const highSeverityAlerts = response.body.alerts.filter(a => a.severity === 'high');
      expect(highSeverityAlerts.length).toBeGreaterThan(0);
    });
    
    test('Normal: Should return empty alerts when none detected', async () => {
      const token = generateToken(adminUser);
      
      // Mock all chain methods and resolve queries
      const mockQuery = () => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          whereRaw: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          having: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: '0' })
        };
        return Object.assign(Promise.resolve([]), chain);
      };
      
      mockKnex.mockImplementation(mockQuery);
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.alerts).toEqual([]);
    });
    
    test('Normal: Manager should have access', async () => {
      const token = generateToken(managerUser);
      
      // Mock all chain methods and resolve queries
      const mockQuery = () => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          whereRaw: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          having: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: '0' })
        };
        return Object.assign(Promise.resolve([]), chain);
      };
      
      mockKnex.mockImplementation(mockQuery);
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
    });
    
    test('Error: Should deny access for regular user', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockRejectedValue(new Error('Query timeout'))
      }));
      
      const response = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  // ============================================================================
  // Integration Tests - Cross-endpoint scenarios
  // ============================================================================
  describe('Integration Tests', () => {
    test('Should maintain consistent access control across all endpoints', async () => {
      const endpoints = [
        '/api/security/dashboard',
        '/api/security/failed-logins',
        '/api/security/active-sessions',
        '/api/security/alerts'
      ];
      
      // Setup mock responses
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' }),
        then: jest.fn().mockResolvedValue([])
      }));
      
      const userToken = generateToken(regularUser);
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`);
        
        expect(response.status).toBe(403);
      }
    });
    
    test('Should log all dashboard access attempts', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      }));
      
      await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${token}`);
      
      expect(logger.logAudit).toHaveBeenCalledWith(
        'security_dashboard_accessed',
        adminUser.id,
        expect.objectContaining({ ip: expect.any(String) })
      );
    });
  });
});
