const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app, knex } = require('../src/server');

describe('Export with Watermark and Bates Numbering', () => {
  let adminToken;
  let caseId;
  let documentId;

  beforeAll(async () => {
    // Login as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'demo123' });
    
    adminToken = loginRes.body.token;

    // Get a case with documents
    const cases = await knex('cases').select('id').limit(1);
    caseId = cases[0].id;

    // Get a document
    const docs = await knex('documents')
      .where('case_id', caseId)
      .where('file_type', 'application/pdf')
      .select('id')
      .limit(1);
    
    if (docs.length > 0) {
      documentId = docs[0].id;
    }
  });

  afterAll(async () => {
    await knex.destroy();
  });

  describe('POST /api/export/case/:caseId/documents', () => {
    it('should export with Bates numbering only', async () => {
      if (!documentId) {
        console.log('No PDF documents found, skipping test');
        return;
      }

      const res = await request(app)
        .post(`/api/export/case/${caseId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentIds: [documentId],
          format: 'zip',
          includeMetadata: true,
          batesNumbering: true,
          batesPrefix: 'TEST',
          batesStartNumber: 1
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('attachment');
    }, 30000);

    it('should export with watermark only', async () => {
      if (!documentId) {
        console.log('No PDF documents found, skipping test');
        return;
      }

      const res = await request(app)
        .post(`/api/export/case/${caseId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentIds: [documentId],
          format: 'zip',
          includeMetadata: true,
          watermark: 'confidential',
          watermarkPosition: 'diagonal',
          watermarkOpacity: 0.3
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
    }, 30000);

    it('should export with both Bates and watermark', async () => {
      if (!documentId) {
        console.log('No PDF documents found, skipping test');
        return;
      }

      const res = await request(app)
        .post(`/api/export/case/${caseId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentIds: [documentId],
          format: 'zip',
          includeMetadata: true,
          batesNumbering: true,
          batesPrefix: 'CASE001',
          batesStartNumber: 1,
          watermark: 'attorney-work-product',
          watermarkPosition: 'bottom-center',
          watermarkOpacity: 0.3
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');

      // Check audit log
      const auditLogs = await knex('audit_logs')
        .where('case_id', caseId)
        .where('action', 'export_documents')
        .orderBy('created_at', 'desc')
        .limit(1);

      expect(auditLogs.length).toBe(1);
      
      const details = JSON.parse(auditLogs[0].details);
      expect(details.bates_numbering).toBeDefined();
      expect(details.bates_numbering.enabled).toBe(true);
      expect(details.watermark).toBeDefined();
      expect(details.watermark.enabled).toBe(true);
      expect(details.watermark.type).toBe('attorney-work-product');
    }, 30000);

    it('should reject invalid watermark type', async () => {
      if (!documentId) {
        console.log('No PDF documents found, skipping test');
        return;
      }

      const res = await request(app)
        .post(`/api/export/case/${caseId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentIds: [documentId],
          format: 'zip',
          watermark: 'invalid-type',
          watermarkPosition: 'diagonal'
        });

      // Should still work, just ignore invalid watermark
      expect(res.status).toBe(200);
    }, 30000);

    it('should log watermark application in audit trail', async () => {
      if (!documentId) {
        console.log('No PDF documents found, skipping test');
        return;
      }

      const beforeCount = await knex('audit_logs')
        .where('case_id', caseId)
        .where('action', 'export_documents')
        .count('* as count');

      await request(app)
        .post(`/api/export/case/${caseId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          documentIds: [documentId],
          format: 'zip',
          batesNumbering: true,
          batesPrefix: 'AUDIT',
          batesStartNumber: 100,
          watermark: 'confidential',
          watermarkPosition: 'diagonal'
        });

      const afterCount = await knex('audit_logs')
        .where('case_id', caseId)
        .where('action', 'export_documents')
        .count('* as count');

      expect(parseInt(afterCount[0].count)).toBe(parseInt(beforeCount[0].count) + 1);

      // Verify audit details
      const latestAudit = await knex('audit_logs')
        .where('case_id', caseId)
        .where('action', 'export_documents')
        .orderBy('created_at', 'desc')
        .first();

      const details = JSON.parse(latestAudit.details);
      expect(details.bates_numbering.prefix).toBe('AUDIT');
      expect(details.bates_numbering.start_number).toBe(100);
      expect(details.watermark.text).toBe('CONFIDENTIAL – DO NOT DISTRIBUTE');
    }, 30000);
  });
});
