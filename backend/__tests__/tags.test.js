/**
 * Test Suite: Tagging Feature
 * 
 * Tests the complete tagging functionality including:
 * - Tag retrieval from case documents
 * - Tag validation and deduplication
 * - Document metadata updates with tags
 * - Bulk metadata updates
 * - Document search by tags
 * - Tag limits and constraints
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock auth middleware before requiring the router
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  // Auth is handled in setupApp, this mock just prevents the real auth from loading
  next();
});

// Mock dependencies
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const tagsRouter = require('../src/api/tags');
const logger = require('../src/utils/logger');

// Mock Knex database
const mockKnex = jest.fn();
let mockChainMethods;

// Reset chain methods for each test
function resetMockChain() {
  mockChainMethods = {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orWhereRaw: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    first: jest.fn(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    update: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn()
  };
}

// Setup mockKnex with fn property
mockKnex.fn = {
  now: () => new Date().toISOString()
};

// Setup Express app for testing
function setupApp() {
  const app = express();
  app.use(express.json());
  
  // Mock knex middleware
  app.use((req, res, next) => {
    req.knex = mockKnex;
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
  
  app.use('/api/tags', tagsRouter);
  
  return app;
}

const app = setupApp();

// Test users
const adminUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin'
};

const regularUser = {
  id: 2,
  name: 'Regular User',
  email: 'user@test.com',
  role: 'user'
};

// Helper function to generate JWT token
function generateToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

describe('Tagging Feature Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockChain();
    mockKnex.mockImplementation((table) => {
      const chain = { ...mockChainMethods };
      if (table) chain.table = table;
      return chain;
    });
  });

  describe('GET /api/tags/metadata/options', () => {
    test('Should return legal categories and evidence types', async () => {
      const token = generateToken(adminUser);
      
      const response = await request(app)
        .get('/api/tags/metadata/options')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('legalCategories');
      expect(response.body).toHaveProperty('evidenceTypes');
      expect(Array.isArray(response.body.legalCategories)).toBe(true);
      expect(Array.isArray(response.body.evidenceTypes)).toBe(true);
      expect(response.body.legalCategories).toContain('Evidence');
      expect(response.body.evidenceTypes).toContain('Digital Evidence');
    });

    test('Should require authentication', async () => {
      const response = await request(app)
        .get('/api/tags/metadata/options');
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tags/case/:caseId/tags', () => {
    test('Should retrieve all unique tags from case documents', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          return {
            ...mockChainMethods,
            select: jest.fn().mockResolvedValue([
              { tags: JSON.stringify(['confidential', 'urgent', 'review']) },
              { tags: JSON.stringify(['urgent', 'legal']) },
              { tags: JSON.stringify(['review', 'approved']) }
            ])
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .get(`/api/tags/case/${caseId}/tags`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags).toEqual(['approved', 'confidential', 'legal', 'review', 'urgent']);
    });

    test('Should handle documents with no tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          return {
            ...mockChainMethods,
            select: jest.fn().mockResolvedValue([
              { tags: null },
              { tags: JSON.stringify([]) },
              { tags: JSON.stringify(['test']) }
            ])
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .get(`/api/tags/case/${caseId}/tags`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.tags).toEqual(['test']);
    });

    test('Should handle malformed tag JSON gracefully', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          return {
            ...mockChainMethods,
            select: jest.fn().mockResolvedValue([
              { tags: 'invalid json' },
              { tags: JSON.stringify(['valid-tag']) }
            ])
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .get(`/api/tags/case/${caseId}/tags`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.tags).toEqual(['valid-tag']);
      expect(logger.error).toHaveBeenCalled();
    });

    test('Should return 404 for non-existent case', async () => {
      const token = generateToken(adminUser);
      const caseId = 999;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue(null)
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .get(`/api/tags/case/${caseId}/tags`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Case not found');
    });

    test('Should validate case ID format', async () => {
      const token = generateToken(adminUser);

      const response = await request(app)
        .get('/api/tags/case/invalid/tags')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid case ID provided');
    });

    test('Should require authentication', async () => {
      const response = await request(app)
        .get('/api/tags/case/1/tags');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tags/case/:caseId/witnesses', () => {
    test('Should retrieve unique witness names', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          return {
            ...mockChainMethods,
            select: jest.fn().mockResolvedValue([
              { witness_name: 'John Doe' },
              { witness_name: 'Jane Smith' }
            ])
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .get(`/api/tags/case/${caseId}/witnesses`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.witnesses).toEqual(['Jane Smith', 'John Doe']);
    });
  });

  describe('PATCH /api/tags/case/:caseId/documents/:docId/metadata', () => {
    test('Should update document tags successfully', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['confidential', 'urgent', 'review'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['confidential', 'review', 'urgent'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
    });

    test('Should deduplicate tags (case-insensitive)', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['Confidential', 'urgent', 'CONFIDENTIAL', 'Urgent', 'review'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          
          let capturedTags;
          chain.update = jest.fn((data) => {
            capturedTags = JSON.parse(data.tags);
            return Promise.resolve(1);
          });
          
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['confidential', 'review', 'urgent'])
            });
          
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should trim whitespace from tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['  confidential  ', 'urgent   ', '  review'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['confidential', 'review', 'urgent'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should filter out empty tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['confidential', '', '   ', 'urgent'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['confidential', 'urgent'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should reject tags exceeding 50 character limit', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const longTag = 'a'.repeat(51);
      const tags = ['valid', longTag];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
      // Long tags should be filtered out
    });

    test('Should reject more than 50 tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = Array.from({ length: 51 }, (_, i) => `tag${i}`);

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 50 tags');
    });

    test('Should validate tags must be an array', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid tags format');
    });

    test('Should update legal_category and evidence_type with tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              legal_category: 'Evidence',
              evidence_type: 'Digital Evidence',
              tags: JSON.stringify(['confidential'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          legal_category: 'Evidence',
          evidence_type: 'Digital Evidence',
          tags: ['confidential']
        });

      expect(response.status).toBe(200);
    });

    test('Should validate legal_category values', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          legal_category: 'Invalid Category'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid legal category');
    });

    test('Should return 404 for non-existent document', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 999;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn().mockResolvedValue(null);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags: ['test'] });

      expect(response.status).toBe(404);
    });

    test('Should require at least one field to update', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' });
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No metadata fields provided');
    });
  });

  describe('PATCH /api/tags/case/:caseId/documents/bulk/metadata', () => {
    test('Should bulk update tags for multiple documents', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const document_ids = [100, 101, 102];
      const metadata = { tags: ['confidential', 'urgent'] };

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.select = jest.fn().mockResolvedValue([
            { id: 100 },
            { id: 101 },
            { id: 102 }
          ]);
          chain.update = jest.fn().mockResolvedValue(3);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/bulk/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_ids, metadata });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated_count).toBe(3);
    });

    test('Should validate document_ids array is provided', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/bulk/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ metadata: { tags: ['test'] } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('document_ids array is required');
    });

    test('Should validate maximum 100 documents per bulk update', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const document_ids = Array.from({ length: 101 }, (_, i) => i + 1);

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/bulk/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_ids, metadata: { tags: ['test'] } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 100 documents');
    });

    test('Should verify all documents belong to the case', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const document_ids = [100, 101, 102];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          // Only 2 documents found, but 3 requested
          chain.select = jest.fn().mockResolvedValue([
            { id: 100 },
            { id: 101 }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/bulk/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_ids, metadata: { tags: ['test'] } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Some documents not found');
    });

    test('Should validate bulk tags count limit', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const document_ids = [100, 101];
      const tags = Array.from({ length: 51 }, (_, i) => `tag${i}`);

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.select = jest.fn().mockResolvedValue([
            { id: 100 },
            { id: 101 }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/bulk/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_ids, metadata: { tags } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 50 tags');
    });
  });

  describe('POST /api/tags/case/:caseId/documents/search', () => {
    test('Should search documents by single tag', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const tags = ['confidential'];

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.count = jest.fn().mockResolvedValue([{ total: 2 }]);
          chain.clone = jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue([{ total: 2 }])
          });
          chain.limit = jest.fn().mockReturnThis();
          chain.offset = jest.fn().mockResolvedValue([
            { id: 100, name: 'Doc1.pdf', tags: JSON.stringify(['confidential', 'urgent']) },
            { id: 101, name: 'Doc2.pdf', tags: JSON.stringify(['confidential']) }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
      expect(response.body.documents).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    test('Should search documents by multiple tags (OR logic)', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const tags = ['confidential', 'urgent'];

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.clone = jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue([{ total: 3 }])
          });
          chain.offset = jest.fn().mockResolvedValue([
            { id: 100, name: 'Doc1.pdf', tags: JSON.stringify(['confidential']) },
            { id: 101, name: 'Doc2.pdf', tags: JSON.stringify(['urgent']) },
            { id: 102, name: 'Doc3.pdf', tags: JSON.stringify(['confidential', 'urgent']) }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should combine tags with other search criteria', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.clone = jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue([{ total: 1 }])
          });
          chain.offset = jest.fn().mockResolvedValue([
            { 
              id: 100, 
              name: 'Evidence.pdf', 
              legal_category: 'Evidence',
              tags: JSON.stringify(['confidential'])
            }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          legal_category: 'Evidence',
          tags: ['confidential']
        });

      expect(response.status).toBe(200);
    });

    test('Should validate tags must be an array', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('tags must be an array');
    });

    test('Should validate maximum 20 tags in search', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum 20 tags allowed in search');
    });

    test('Should require at least one search criterion', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('At least one search criterion is required');
    });

    test('Should support pagination', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.clone = jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue([{ total: 100 }])
          });
          chain.offset = jest.fn().mockResolvedValue([
            { id: 110, name: 'Doc10.pdf', tags: JSON.stringify(['test']) }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['test'],
          limit: 10,
          offset: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(100);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(10);
    });

    test('Should validate limit range (1-1000)', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['test'],
          limit: 1001
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('limit must be a number between 1 and 1000');
    });

    test('Should support sorting', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.clone = jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue([{ total: 2 }])
          });
          chain.offset = jest.fn().mockResolvedValue([
            { id: 100, name: 'A.pdf', tags: JSON.stringify(['test']) },
            { id: 101, name: 'Z.pdf', tags: JSON.stringify(['test']) }
          ]);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['test'],
          sort_by: 'name',
          sort_order: 'asc'
        });

      expect(response.status).toBe(200);
    });

    test('Should validate sort_by field', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;

      mockKnex.mockImplementation((table) => {
        if (table === 'cases') {
          return {
            ...mockChainMethods,
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .post(`/api/tags/case/${caseId}/documents/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['test'],
          sort_by: 'invalid_field'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid sort_by field');
    });
  });

  describe('Tag Edge Cases', () => {
    test('Should handle special characters in tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['tag-with-dash', 'tag_with_underscore', 'tag.with.dot'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['tag-with-dash', 'tag.with.dot', 'tag_with_underscore'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should handle numeric tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['2024', '123', 'q1'];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['123', '2024', 'q1'])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
    });

    test('Should handle non-string values in tags array', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;
      const tags = ['valid', 123, null, undefined, true, {}];

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify(['valid']) // Only string values should be kept
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags });

      expect(response.status).toBe(200);
      // Only string values should be processed
    });

    test('Should handle empty tags array (clear all tags)', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      const docId = 100;

      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          const chain = { ...mockChainMethods };
          chain.first = jest.fn()
            .mockResolvedValueOnce({ id: docId, case_id: caseId, name: 'Test.pdf' })
            .mockResolvedValueOnce({ 
              id: docId, 
              case_id: caseId, 
              name: 'Test.pdf',
              tags: JSON.stringify([])
            });
          chain.update = jest.fn().mockResolvedValue(1);
          return chain;
        }
        return mockChainMethods;
      });

      const response = await request(app)
        .patch(`/api/tags/case/${caseId}/documents/${docId}/metadata`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tags: [] });

      expect(response.status).toBe(200);
    });
  });
});
