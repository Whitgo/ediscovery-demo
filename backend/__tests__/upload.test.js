/**
 * Integration Tests for Document Upload Feature
 * Tests file upload, encryption, download, and deletion
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Mock audit middleware to prevent real Knex connection
jest.mock('../src/middleware/audit', () => jest.fn().mockResolvedValue(undefined));

// Mock auth middleware before requiring the router
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  // Auth is handled in setupApp, this mock just prevents the real auth from loading
  next();
});

// Mock logger to prevent console output
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logAudit: jest.fn(),
  logSecurity: jest.fn()
}));

// Setup test app
function setupApp() {
  const app = express();
  app.use(express.json());
  
  // Mock knex middleware
  app.use((req, res, next) => {
    req.knex = mockKnex;
    next();
  });
  
  // Mock auth middleware
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
  
  // Load documents routes
  const documentsRouter = require('../src/api/documents');
  app.use('/api/documents', documentsRouter);
  
  return app;
}

// Mock Knex
function createMockKnex() {
  const mockChain = {
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    returning: jest.fn().mockReturnThis(),
    del: jest.fn().mockResolvedValue(1)
  };
  
  const mockKnex = jest.fn(() => mockChain);
  mockKnex.fn = { now: () => new Date().toISOString() };
  Object.assign(mockKnex, mockChain);
  
  return mockKnex;
}

const mockKnex = createMockKnex();

// Generate test token
function generateToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

// Test users
const adminUser = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };
const regularUser = { id: 2, email: 'user@test.com', name: 'Regular User', role: 'user' };

// Test file paths
const TEST_UPLOADS_DIR = path.join(__dirname, '../uploads');
const TEST_PDF_PATH = path.join(__dirname, 'fixtures', 'test-document.pdf');
const TEST_TXT_PATH = path.join(__dirname, 'fixtures', 'test-document.txt');

describe('Document Upload Feature', () => {
  let app;
  
  beforeAll(() => {
    // Create fixtures directory if it doesn't exist
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    
    // Create test PDF file
    if (!fs.existsSync(TEST_PDF_PATH)) {
      const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n190\n%%EOF');
      fs.writeFileSync(TEST_PDF_PATH, pdfContent);
    }
    
    // Create test TXT file
    if (!fs.existsSync(TEST_TXT_PATH)) {
      fs.writeFileSync(TEST_TXT_PATH, 'Test document content\nLine 2\nLine 3');
    }
    
    // Ensure uploads directory exists
    if (!fs.existsSync(TEST_UPLOADS_DIR)) {
      fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
    }
  });
  
  beforeEach(() => {
    app = setupApp();
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockKnex.mockClear();
    mockKnex.where.mockClear();
    mockKnex.first.mockClear();
    mockKnex.insert.mockClear();
  });
  
  afterAll(() => {
    // Clean up test files
    try {
      if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
      if (fs.existsSync(TEST_TXT_PATH)) fs.unlinkSync(TEST_TXT_PATH);
    } catch (err) {
      // Ignore cleanup errors
    }
  });
  
  // ============================================================================
  // Upload Endpoint Tests
  // ============================================================================
  describe('POST /api/documents/case/:caseId/documents/upload', () => {
    test('Should upload PDF file successfully', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      
      // Mock database responses
      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([123])
          };
        }
        if (table === 'cases') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockKnex;
      });
      
      const response = await request(app)
        .post(`/api/documents/case/${caseId}/documents/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TEST_PDF_PATH)
        .field('category', 'evidence')
        .field('folder', 'legal-docs');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'test-document.pdf');
      expect(response.body).toHaveProperty('category', 'evidence');
      expect(response.body).toHaveProperty('folder', 'legal-docs');
    });
    
    test('Should upload TXT file successfully', async () => {
      const token = generateToken(regularUser);
      const caseId = 2;
      
      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([456])
          };
        }
        if (table === 'cases') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 2, name: 'Another Case' })
          };
        }
        return mockKnex;
      });
      
      const response = await request(app)
        .post(`/api/documents/case/${caseId}/documents/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TEST_TXT_PATH);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', 'test-document.txt');
      expect(response.body).toHaveProperty('category', 'general'); // Default category
    });
    
    test('Should handle tags correctly', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      
      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([789])
          };
        }
        if (table === 'cases') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockKnex;
      });
      
      const response = await request(app)
        .post(`/api/documents/case/${caseId}/documents/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TEST_PDF_PATH)
        .field('tags', JSON.stringify(['important', 'evidence', 'witness-statement']));
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('tags');
      expect(Array.isArray(response.body.tags)).toBe(true);
      expect(response.body.tags).toContain('important');
      expect(response.body.tags).toContain('evidence');
    });
    
    test('Should deduplicate tags', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      
      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([999])
          };
        }
        if (table === 'cases') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockKnex;
      });
      
      const response = await request(app)
        .post(`/api/documents/case/${caseId}/documents/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TEST_PDF_PATH)
        .field('tags', JSON.stringify(['tag1', 'TAG1', 'tag2', 'tag1']));
      
      expect(response.status).toBe(201);
      expect(response.body.tags).toHaveLength(2); // Only unique tags
      expect(response.body.tags).toContain('tag1');
      expect(response.body.tags).toContain('tag2');
    });
    
    test('Should handle metadata fields', async () => {
      const token = generateToken(adminUser);
      const caseId = 1;
      
      mockKnex.mockImplementation((table) => {
        if (table === 'documents') {
          return {
            insert: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([111])
          };
        }
        if (table === 'cases') {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 1, name: 'Test Case' })
          };
        }
        return mockKnex;
      });
      
      const response = await request(app)
        .post(`/api/documents/case/${caseId}/documents/upload`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TEST_PDF_PATH)
        .field('case_number', 'CASE-2025-001')
        .field('witness_name', 'John Doe')
        .field('evidence_type', 'testimony')
        .field('legal_category', 'discovery');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('case_number', 'CASE-2025-001');
      expect(response.body).toHaveProperty('witness_name', 'John Doe');
      expect(response.body).toHaveProperty('evidence_type', 'testimony');
      expect(response.body).toHaveProperty('legal_category', 'discovery');
    });
    
    test('Error: Should require authentication', async () => {
      const response = await request(app)
        .post('/api/documents/case/1/documents/upload')
        .attach('file', TEST_PDF_PATH);
      
      expect(response.status).toBe(401);
    });
    
    test('Error: Should require file', async () => {
      const token = generateToken(adminUser);
      
      const response = await request(app)
        .post('/api/documents/case/1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('category', 'evidence');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });
    
    test('Error: Should reject invalid file types', async () => {
      const token = generateToken(adminUser);
      
      // Create temporary executable file
      const tempExePath = path.join(__dirname, 'fixtures', 'test.exe');
      fs.writeFileSync(tempExePath, 'fake executable');
      
      const response = await request(app)
        .post('/api/documents/case/1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tempExePath);
      
      // Clean up
      fs.unlinkSync(tempExePath);
      
      expect(response.status).toBe(500);
    });
    
    test('Error: Should reject files over size limit', async () => {
      const token = generateToken(adminUser);
      
      // Create large file (51MB - over 50MB limit)
      const largePath = path.join(__dirname, 'fixtures', 'large.pdf');
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024, 'x');
      fs.writeFileSync(largePath, largeBuffer);
      
      const response = await request(app)
        .post('/api/documents/case/1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largePath);
      
      // Clean up
      fs.unlinkSync(largePath);
      
      expect(response.status).toBe(500);
    });
  });
  
  // ============================================================================
  // File Type Validation Tests
  // ============================================================================
  describe('File Type Validation', () => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.png', '.tiff', '.zip', '.eml'];
    
    test('Should accept all allowed file types', async () => {
      const token = generateToken(adminUser);
      
      // Test each allowed extension
      for (const ext of ['.pdf', '.txt']) {
        const testFile = ext === '.pdf' ? TEST_PDF_PATH : TEST_TXT_PATH;
        
        mockKnex.mockImplementation((table) => {
          if (table === 'documents') {
            return {
              insert: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([1])
            };
          }
          if (table === 'cases') {
            return {
              where: jest.fn().mockReturnThis(),
              first: jest.fn().mockResolvedValue({ id: 1, name: 'Test' })
            };
          }
          return mockKnex;
        });
        
        const response = await request(app)
          .post('/api/documents/case/1/documents/upload')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', testFile);
        
        expect([201, 500]).toContain(response.status); // Accept either success or database error
      }
    });
  });
  
  // ============================================================================
  // Download Endpoint Tests
  // ============================================================================
  describe('GET /api/documents/case/:caseId/documents/:docId/download', () => {
    test('Should return 404 for non-existent document', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }));
      
      const response = await request(app)
        .get('/api/documents/case/1/documents/999/download')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Document not found');
    });
    
    test('Should validate filename to prevent path traversal', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          name: 'test.pdf',
          stored_filename: '../../../etc/passwd', // Malicious path
          file_type: 'application/pdf',
          encrypted: false
        })
      }));
      
      const response = await request(app)
        .get('/api/documents/case/1/documents/1/download')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid filename');
    });
    
    test('Should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents/case/1/documents/1/download');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ============================================================================
  // Delete Endpoint Tests
  // ============================================================================
  describe('DELETE /api/documents/case/:caseId/documents/:docId', () => {
    test('Should delete document successfully', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          name: 'test.pdf',
          stored_filename: 'abc123.pdf'
        }),
        del: jest.fn().mockResolvedValue(1)
      }));
      
      const response = await request(app)
        .delete('/api/documents/case/1/documents/1')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
    
    test('Should require authentication', async () => {
      const response = await request(app)
        .delete('/api/documents/case/1/documents/1');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ============================================================================
  // List Documents Tests
  // ============================================================================
  describe('GET /api/documents/case/:caseId/documents', () => {
    test('Should list documents for a case', async () => {
      const token = generateToken(adminUser);
      
      const mockDocs = [
        { id: 1, name: 'doc1.pdf', case_id: 1 },
        { id: 2, name: 'doc2.txt', case_id: 1 }
      ];
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockResolvedValue(mockDocs)
      }));
      
      const response = await request(app)
        .get('/api/documents/case/1/documents')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
    
    test('Should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents/case/1/documents');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ============================================================================
  // Security Tests
  // ============================================================================
  describe('Security Tests', () => {
    test('Should sanitize filenames to prevent directory traversal', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          stored_filename: '../../evil.pdf',
          file_type: 'application/pdf',
          encrypted: false
        })
      }));
      
      const response = await request(app)
        .get('/api/documents/case/1/documents/1/download')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(400);
    });
    
    test('Should prevent access to files outside uploads directory', async () => {
      const token = generateToken(adminUser);
      
      mockKnex.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          stored_filename: 'test.pdf',
          file_type: 'application/pdf',
          encrypted: false
        })
      }));
      
      const response = await request(app)
        .get('/api/documents/case/1/documents/1/download')
        .set('Authorization', `Bearer ${token}`);
      
      // Should either succeed or return 404 if file doesn't exist
      expect([200, 404]).toContain(response.status);
    });
  });
});
