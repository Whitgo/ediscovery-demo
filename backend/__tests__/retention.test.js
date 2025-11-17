/**
 * Unit Tests for Data Retention API
 * Tests normal scenarios, edge cases, and error handling
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const retentionRouter = require('../src/api/retention');

// Mock the data retention utilities
jest.mock('../src/utils/dataRetention', () => ({
  RETENTION_POLICIES: {
    '10_years': 3650,
    '7_years': 2555,
    '5_years': 1825,
    '3_years': 1095,
    'indefinite': null,
    'custom': null
  },
  getExpiredCases: jest.fn(),
  deleteCaseData: jest.fn(),
  runRetentionCleanup: jest.fn(),
  getCasesApproachingRetention: jest.fn(),
  updateCaseRetentionPolicy: jest.fn(),
  setLegalHold: jest.fn()
}));

const {
  getExpiredCases,
  deleteCaseData,
  runRetentionCleanup,
  getCasesApproachingRetention,
  updateCaseRetentionPolicy,
  setLegalHold
} = require('../src/utils/dataRetention');

// Setup Express app for testing
function setupApp() {
  const app = express();
  app.use(express.json());
  
  // Mock knex middleware
  app.use((req, res, next) => {
    req.knex = mockKnex;
    next();
  });
  
  app.use('/api/retention', retentionRouter);
  
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
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1)
  };
  
  const mockKnex = jest.fn((tableName) => mockChain);
  mockKnex.fn = { now: () => new Date().toISOString() };
  mockKnex.transaction = jest.fn();
  mockKnex.raw = jest.fn();
  
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
const managerUser = { id: 1, email: 'manager@test.com', name: 'Manager', role: 'manager' };
const regularUser = { id: 2, email: 'user@test.com', name: 'User', role: 'user' };
const adminUser = { id: 3, email: 'admin@test.com', name: 'Admin', role: 'admin' };

describe('Data Retention API', () => {
  let app;
  
  beforeEach(() => {
    app = setupApp();
    jest.clearAllMocks();
    
    // Reset all mock implementations
    mockKnex.mockClear();
    mockKnex.first.mockClear();
    mockKnex.insert.mockClear();
    mockKnex.update.mockClear();
    mockKnex.groupBy.mockClear();
    mockKnex.limit.mockClear();
  });
  
  // ============================================================================
  // GET /api/retention/policies - Get retention policy options
  // ============================================================================
  describe('GET /api/retention/policies', () => {
    test('Normal: Should return retention policies for authenticated user', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/retention/policies')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('policies');
      expect(response.body).toHaveProperty('available_policies');
      expect(response.body).toHaveProperty('descriptions');
      expect(response.body.available_policies).toContain('10_years');
      expect(response.body.descriptions).toHaveProperty('10_years');
    });
    
    test('Error: Should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/retention/policies');
      
      expect(response.status).toBe(401);
    });
    
    test('Error: Should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/retention/policies')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ============================================================================
  // GET /api/retention/cases/approaching - Get cases approaching retention
  // ============================================================================
  describe('GET /api/retention/cases/approaching', () => {
    test('Normal: Manager should get cases approaching retention with default 90 days', async () => {
      const mockCases = [
        { id: 1, case_name: 'Case 1', retention_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        { id: 2, case_name: 'Case 2', retention_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
      ];
      
      getCasesApproachingRetention.mockResolvedValue(mockCases);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.cases).toHaveLength(2);
      expect(response.body.cases[0]).toHaveProperty('days_remaining');
      expect(getCasesApproachingRetention).toHaveBeenCalledWith(mockKnex, 90);
    });
    
    test('Normal: Manager should get cases with custom days threshold', async () => {
      getCasesApproachingRetention.mockResolvedValue([]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching?days=30')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(getCasesApproachingRetention).toHaveBeenCalledWith(mockKnex, 30);
    });
    
    test('Edge: Should handle empty result set', async () => {
      getCasesApproachingRetention.mockResolvedValue([]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
      expect(response.body.cases).toEqual([]);
    });
    
    test('Edge: Should handle invalid days parameter', async () => {
      getCasesApproachingRetention.mockResolvedValue([]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching?days=invalid')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(getCasesApproachingRetention).toHaveBeenCalledWith(mockKnex, 90); // Falls back to default
    });
    
    test('Error: Regular user should be denied access', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });
    
    test('Error: Should handle database errors', async () => {
      getCasesApproachingRetention.mockRejectedValue(new Error('Database connection failed'));
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/approaching')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database connection failed');
    });
  });
  
  // ============================================================================
  // GET /api/retention/cases/expired - Get expired cases
  // ============================================================================
  describe('GET /api/retention/cases/expired', () => {
    test('Normal: Manager should get list of expired cases', async () => {
      const mockExpired = [
        { id: 1, case_name: 'Expired Case 1', retention_date: '2020-01-01T00:00:00.000Z' },
        { id: 2, case_name: 'Expired Case 2', retention_date: '2019-01-01T00:00:00.000Z' }
      ];
      
      getExpiredCases.mockResolvedValue(mockExpired);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/expired')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.cases).toEqual(mockExpired);
      expect(getExpiredCases).toHaveBeenCalledWith(mockKnex);
    });
    
    test('Edge: Should handle empty expired cases', async () => {
      getExpiredCases.mockResolvedValue([]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/cases/expired')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });
    
    test('Error: Non-manager should be denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/retention/cases/expired')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
  });
  
  // ============================================================================
  // PATCH /api/retention/cases/:caseId/policy - Update retention policy
  // ============================================================================
  describe('PATCH /api/retention/cases/:caseId/policy', () => {
    test('Normal: Manager should update case retention policy', async () => {
      const mockResult = {
        retention_policy: '7_years',
        retention_date: new Date('2030-01-01')
      };
      
      updateCaseRetentionPolicy.mockResolvedValue(mockResult);
      mockKnex.insert.mockResolvedValue([1]); // Audit log insert
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/123/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({ policy: '7_years' });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Retention policy updated');
      expect(response.body.case_id).toBe('123');
      expect(response.body.retention_policy).toBe('7_years');
      expect(updateCaseRetentionPolicy).toHaveBeenCalledWith(mockKnex, '123', '7_years', undefined);
    });
    
    test('Normal: Manager should update to custom policy with custom date', async () => {
      const customDate = '2028-12-31';
      const mockResult = {
        retention_policy: 'custom',
        retention_date: customDate
      };
      
      updateCaseRetentionPolicy.mockResolvedValue(mockResult);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/456/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({ policy: 'custom', custom_date: customDate });
      
      expect(response.status).toBe(200);
      expect(updateCaseRetentionPolicy).toHaveBeenCalledWith(mockKnex, '456', 'custom', customDate);
    });
    
    test('Error: Should reject request without policy', async () => {
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/123/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Policy is required');
    });
    
    test('Error: Regular user should be denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/123/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({ policy: '7_years' });
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      updateCaseRetentionPolicy.mockRejectedValue(new Error('Invalid policy'));
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/123/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({ policy: 'invalid_policy' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Invalid policy');
    });
  });
  
  // ============================================================================
  // PATCH /api/retention/cases/:caseId/legal-hold - Set legal hold
  // ============================================================================
  describe('PATCH /api/retention/cases/:caseId/legal-hold', () => {
    test('Normal: Manager should activate legal hold', async () => {
      const mockResult = { case_id: '789', legal_hold: true };
      
      setLegalHold.mockResolvedValue(mockResult);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/789/legal-hold')
        .set('Authorization', `Bearer ${token}`)
        .send({ legal_hold: true });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Legal hold activated');
      expect(setLegalHold).toHaveBeenCalledWith(mockKnex, '789', true);
    });
    
    test('Normal: Manager should remove legal hold', async () => {
      const mockResult = { case_id: '789', legal_hold: false };
      
      setLegalHold.mockResolvedValue(mockResult);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/789/legal-hold')
        .set('Authorization', `Bearer ${token}`)
        .send({ legal_hold: false });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Legal hold removed');
    });
    
    test('Error: Should reject non-boolean legal_hold', async () => {
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/789/legal-hold')
        .set('Authorization', `Bearer ${token}`)
        .send({ legal_hold: 'yes' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('legal_hold must be a boolean');
    });
    
    test('Error: Should reject missing legal_hold field', async () => {
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/789/legal-hold')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(response.status).toBe(400);
    });
    
    test('Error: Regular user denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .patch('/api/retention/cases/789/legal-hold')
        .set('Authorization', `Bearer ${token}`)
        .send({ legal_hold: true });
      
      expect(response.status).toBe(403);
    });
  });
  
  // ============================================================================
  // DELETE /api/retention/cases/:caseId - Delete case manually
  // ============================================================================
  describe('DELETE /api/retention/cases/:caseId', () => {
    test('Normal: Manager should delete case not on legal hold', async () => {
      const mockCase = { id: 101, case_number: 'CASE-101', legal_hold: false };
      const mockDeleteResult = {
        success: true,
        case_id: 101,
        case_number: 'CASE-101',
        documents_deleted: 5,
        files_deleted: 5,
        notifications_deleted: 2
      };
      
      mockKnex.first.mockResolvedValue(mockCase);
      deleteCaseData.mockResolvedValue(mockDeleteResult);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .delete('/api/retention/cases/101')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
      expect(response.body.documents_deleted).toBe(5);
      expect(deleteCaseData).toHaveBeenCalledWith(mockKnex, '101', 'manual_admin', 'Manager');
    });
    
    test('Error: Should prevent deletion of case on legal hold', async () => {
      const mockCase = { id: 102, case_number: 'CASE-102', legal_hold: true };
      
      mockKnex.first.mockResolvedValue(mockCase);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .delete('/api/retention/cases/102')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('legal hold');
      expect(deleteCaseData).not.toHaveBeenCalled();
    });
    
    test('Error: Should return 404 for non-existent case', async () => {
      mockKnex.first.mockResolvedValue(null);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .delete('/api/retention/cases/999')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Case not found');
    });
    
    test('Error: Should handle deletion failures', async () => {
      const mockCase = { id: 103, legal_hold: false };
      const mockDeleteResult = { success: false, error: 'Deletion failed' };
      
      mockKnex.first.mockResolvedValue(mockCase);
      deleteCaseData.mockResolvedValue(mockDeleteResult);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .delete('/api/retention/cases/103')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Deletion failed');
    });
    
    test('Error: Regular user denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .delete('/api/retention/cases/101')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
  });
  
  // ============================================================================
  // POST /api/retention/cleanup/run - Manual cleanup
  // ============================================================================
  describe('POST /api/retention/cleanup/run', () => {
    test('Normal: Manager should run manual cleanup successfully', async () => {
      const mockResults = {
        total_cases_checked: 3,
        cases_deleted: [
          { case_id: 1, documents_deleted: 5 },
          { case_id: 2, documents_deleted: 3 }
        ],
        errors: []
      };
      
      runRetentionCleanup.mockResolvedValue(mockResults);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .post('/api/retention/cleanup/run')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Retention cleanup completed');
      expect(response.body.total_cases_checked).toBe(3);
      expect(response.body.cases_deleted).toHaveLength(2);
      expect(runRetentionCleanup).toHaveBeenCalledWith(mockKnex);
    });
    
    test('Edge: Should handle cleanup with no eligible cases', async () => {
      const mockResults = {
        total_cases_checked: 0,
        cases_deleted: [],
        errors: []
      };
      
      runRetentionCleanup.mockResolvedValue(mockResults);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .post('/api/retention/cleanup/run')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total_cases_checked).toBe(0);
    });
    
    test('Edge: Should handle partial failures during cleanup', async () => {
      const mockResults = {
        total_cases_checked: 3,
        cases_deleted: [{ case_id: 1, documents_deleted: 5 }],
        errors: [
          { case_id: 2, error: 'File deletion failed' },
          { case_id: 3, error: 'Database error' }
        ]
      };
      
      runRetentionCleanup.mockResolvedValue(mockResults);
      mockKnex.insert.mockResolvedValue([1]);
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .post('/api/retention/cleanup/run')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.cases_deleted).toHaveLength(1);
      expect(response.body.errors).toHaveLength(2);
    });
    
    test('Error: Regular user denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .post('/api/retention/cleanup/run')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle cleanup failure', async () => {
      runRetentionCleanup.mockRejectedValue(new Error('Cleanup process crashed'));
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .post('/api/retention/cleanup/run')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Cleanup process crashed');
    });
  });
  
  // ============================================================================
  // GET /api/retention/log - Get retention log
  // ============================================================================
  describe('GET /api/retention/log', () => {
    test('Normal: Manager should retrieve retention logs with default pagination', async () => {
      const mockLogs = [
        { id: 1, action: 'case_deleted', case_id: 1, executed_at: new Date().toISOString() },
        { id: 2, action: 'case_deleted', case_id: 2, executed_at: new Date().toISOString() }
      ];
      
      // Setup the chain: knex('table').orderBy().limit().offset()
      mockKnex.mockReturnValue({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue(mockLogs)
          })
        })
      });
      
      // Mock count query: knex('table').count()
      const countMock = {
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ count: '50' })
        })
      };
      mockKnex.mockReturnValueOnce({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue(mockLogs)
          })
        })
      }).mockReturnValueOnce(countMock);
      
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/log')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(50);
      expect(response.body.limit).toBe(100);
      expect(response.body.offset).toBe(0);
      expect(response.body.logs).toEqual(mockLogs);
    });
    
    test('Normal: Manager should retrieve logs with custom pagination', async () => {
      const mockLogs = [];
      
      mockKnex.mockReturnValue({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue(mockLogs)
          })
        })
      });
      
      const countMock = {
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ count: '200' })
        })
      };
      mockKnex.mockReturnValueOnce({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue(mockLogs)
          })
        })
      }).mockReturnValueOnce(countMock);
      
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/log?limit=50&offset=100')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(100);
    });
    
    test('Edge: Should handle invalid pagination parameters', async () => {
      mockKnex.mockReturnValue({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue([])
          })
        })
      });
      
      const countMock = {
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ count: '10' })
        })
      };
      mockKnex.mockReturnValueOnce({
        ...mockKnex,
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            offset: jest.fn().mockResolvedValue([])
          })
        })
      }).mockReturnValueOnce(countMock);
      
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/log?limit=invalid&offset=bad')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100); // Falls back to default
      expect(response.body.offset).toBe(0);
    });
    
    test('Error: Regular user denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/retention/log')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
  });
  
  // ============================================================================
  // GET /api/retention/stats - Get retention statistics
  // ============================================================================
  describe('GET /api/retention/stats', () => {
    test('Normal: Manager should retrieve comprehensive statistics', async () => {
      const mockPolicyStats = [
        { retention_policy: '10_years', count: '25' },
        { retention_policy: '7_years', count: '15' },
        { retention_policy: 'indefinite', count: '5' }
      ];
      
      mockKnex.groupBy.mockResolvedValue(mockPolicyStats);
      mockKnex.first.mockResolvedValueOnce({ count: '3' }) // legal hold
                      .mockResolvedValueOnce({ count: '12' }); // deleted
      
      getExpiredCases.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      getCasesApproachingRetention.mockResolvedValue([{ id: 3 }, { id: 4 }, { id: 5 }]);
      
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.by_policy).toEqual(mockPolicyStats);
      expect(response.body.legal_hold_count).toBe(3);
      expect(response.body.expired_count).toBe(2);
      expect(response.body.approaching_count).toBe(3);
      expect(response.body.deleted_count).toBe(12);
    });
    
    test('Edge: Should handle empty statistics', async () => {
      mockKnex.groupBy.mockResolvedValue([]);
      mockKnex.first.mockResolvedValue({ count: '0' });
      getExpiredCases.mockResolvedValue([]);
      getCasesApproachingRetention.mockResolvedValue([]);
      
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.by_policy).toEqual([]);
      expect(response.body.legal_hold_count).toBe(0);
      expect(response.body.expired_count).toBe(0);
    });
    
    test('Error: Regular user denied', async () => {
      const token = generateToken(regularUser);
      
      const response = await request(app)
        .get('/api/retention/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Error: Should handle database errors', async () => {
      mockKnex.groupBy.mockRejectedValue(new Error('Stats query failed'));
      const token = generateToken(managerUser);
      
      const response = await request(app)
        .get('/api/retention/stats')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Stats query failed');
    });
  });
});
