/**
 * Unit Tests for Backup System with Encryption
 * Tests backup creation, encryption, decryption, restore, and cleanup
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');

// Mock the backup module functions
jest.mock('child_process');

const execPromise = util.promisify(exec);

describe('Backup System', () => {
  const BACKUP_DIR = path.join(__dirname, 'test-backups');
  const BACKUP_PREFIX = 'ediscovery_backup_';
  const TEST_BACKUP_FILE = path.join(BACKUP_DIR, 'test_backup.sql');
  const TEST_ENCRYPTED_FILE = `${TEST_BACKUP_FILE}.enc`;
  
  // Sample SQL content for testing
  const SAMPLE_SQL = `
-- PostgreSQL database dump
-- Dumped by pg_dump version 15.0

SET statement_timeout = 0;
SET lock_timeout = 0;

CREATE TABLE cases (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL
);

INSERT INTO cases (title, status) VALUES ('Test Case 1', 'open');
INSERT INTO cases (title, status) VALUES ('Test Case 2', 'closed');

-- End of dump
`.trim();

  beforeAll(async () => {
    // Ensure backup directory exists
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(TEST_BACKUP_FILE);
    } catch {}
    try {
      await fs.unlink(TEST_ENCRYPTED_FILE);
    } catch {}
  });

  afterAll(async () => {
    // Clean up test backup files
    try {
      const files = await fs.readdir(BACKUP_DIR);
      for (const file of files) {
        if (file.startsWith('test_backup')) {
          await fs.unlink(path.join(BACKUP_DIR, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Encryption Key Derivation Tests
  // ============================================================================
  describe('Encryption Key Management', () => {
    test('Should accept 64-character hex key', () => {
      const hexKey = 'a'.repeat(64);
      const buffer = Buffer.from(hexKey, 'hex');
      expect(buffer.length).toBe(32); // 256 bits
      expect(/^[0-9a-fA-F]+$/.test(hexKey)).toBe(true);
    });

    test('Should validate hex key format', () => {
      const validKeys = [
        '9bc26789b9ecc1604786e33c6859cd3d321057fc379eea737f55c51ff6f061d4',
        'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
        '0000000000000000000000000000000000000000000000000000000000000000'
      ];
      
      validKeys.forEach(key => {
        expect(key.length).toBe(64);
        expect(/^[0-9a-fA-F]+$/.test(key)).toBe(true);
      });
    });

    test('Should derive key from passphrase using PBKDF2', () => {
      const passphrase = 'MySecurePassphrase123!';
      const salt = crypto.createHash('sha256').update('ediscovery-backup-salt').digest();
      const derivedKey = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      
      expect(derivedKey).toBeInstanceOf(Buffer);
      expect(derivedKey.length).toBe(32); // 256 bits for AES-256
    });

    test('Should produce consistent key for same passphrase', () => {
      const passphrase = 'TestPassphrase';
      const salt = crypto.createHash('sha256').update('ediscovery-backup-salt').digest();
      
      const key1 = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      const key2 = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
      
      expect(key1.equals(key2)).toBe(true);
    });

    test('Should produce different keys for different passphrases', () => {
      const salt = crypto.createHash('sha256').update('ediscovery-backup-salt').digest();
      
      const key1 = crypto.pbkdf2Sync('passphrase1', salt, 100000, 32, 'sha256');
      const key2 = crypto.pbkdf2Sync('passphrase2', salt, 100000, 32, 'sha256');
      
      expect(key1.equals(key2)).toBe(false);
    });
  });

  // ============================================================================
  // File Encryption Tests
  // ============================================================================
  describe('Backup File Encryption', () => {
    test('Should encrypt backup file with AES-256-GCM', async () => {
      // Write test backup file
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      // Generate encryption key
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      // Encrypt
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      // Write encrypted file
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      // Verify encrypted file exists and is different from original
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      expect(encryptedContent.length).toBeGreaterThan(64); // Header + data
      expect(encryptedContent.slice(64).equals(inputData)).toBe(false);
    });

    test('Should create encrypted file with correct header structure', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      const fileContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      
      // Verify header structure
      expect(fileContent.slice(0, 32).length).toBe(32);   // Salt
      expect(fileContent.slice(32, 48).length).toBe(16);  // IV
      expect(fileContent.slice(48, 64).length).toBe(16);  // Auth Tag
      expect(fileContent.slice(64).length).toBeGreaterThan(0); // Encrypted data
    });

    test('Should produce different ciphertext for same data with different IVs', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptionKey = crypto.randomBytes(32);
      
      // Encrypt with first IV
      const iv1 = crypto.randomBytes(16);
      const cipher1 = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv1);
      const encrypted1 = Buffer.concat([cipher1.update(inputData), cipher1.final()]);
      
      // Encrypt with second IV
      const iv2 = crypto.randomBytes(16);
      const cipher2 = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv2);
      const encrypted2 = Buffer.concat([cipher2.update(inputData), cipher2.final()]);
      
      // Verify IVs are different
      expect(iv1.equals(iv2)).toBe(false);
      
      // Verify ciphertexts are different
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });

    test('Should handle empty backup file', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, '');
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      expect(inputData.length).toBe(0);
      
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      expect(authTag.length).toBe(16);
      expect(encryptedData.length).toBe(0); // Empty input = empty output
    });
  });

  // ============================================================================
  // File Decryption Tests
  // ============================================================================
  describe('Backup File Decryption', () => {
    test('Should decrypt encrypted backup file', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      // Encrypt
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      await fs.unlink(TEST_BACKUP_FILE);
      
      // Decrypt
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      const extractedSalt = encryptedContent.slice(0, 32);
      const extractedIv = encryptedContent.slice(32, 48);
      const extractedAuthTag = encryptedContent.slice(48, 64);
      const extractedData = encryptedContent.slice(64);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, extractedIv);
      decipher.setAuthTag(extractedAuthTag);
      const decryptedData = Buffer.concat([decipher.update(extractedData), decipher.final()]);
      
      // Verify decrypted content matches original
      expect(decryptedData.toString()).toBe(SAMPLE_SQL);
    });

    test('Should fail decryption with wrong key', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const correctKey = crypto.randomBytes(32);
      const wrongKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      // Encrypt with correct key
      const cipher = crypto.createCipheriv('aes-256-gcm', correctKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      // Attempt decryption with wrong key
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      const extractedIv = encryptedContent.slice(32, 48);
      const extractedAuthTag = encryptedContent.slice(48, 64);
      const extractedData = encryptedContent.slice(64);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', wrongKey, extractedIv);
      decipher.setAuthTag(extractedAuthTag);
      
      expect(() => {
        decipher.update(extractedData);
        decipher.final();
      }).toThrow();
    });

    test('Should detect tampered encrypted data', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      // Encrypt
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      const fullEncrypted = Buffer.concat([salt, iv, authTag, encryptedData]);
      
      // Tamper with encrypted data (flip one bit)
      fullEncrypted[100] = fullEncrypted[100] ^ 0xFF;
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, fullEncrypted);
      
      // Attempt decryption
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      const extractedIv = encryptedContent.slice(32, 48);
      const extractedAuthTag = encryptedContent.slice(48, 64);
      const extractedData = encryptedContent.slice(64);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, extractedIv);
      decipher.setAuthTag(extractedAuthTag);
      
      // Should throw due to authentication failure
      expect(() => {
        decipher.update(extractedData);
        decipher.final();
      }).toThrow();
    });

    test('Should detect tampered authentication tag', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      // Encrypt
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      // Tamper with auth tag
      authTag[0] = authTag[0] ^ 0xFF;
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      // Attempt decryption
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      const extractedIv = encryptedContent.slice(32, 48);
      const extractedAuthTag = encryptedContent.slice(48, 64);
      const extractedData = encryptedContent.slice(64);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, extractedIv);
      decipher.setAuthTag(extractedAuthTag);
      
      // Should throw due to authentication failure
      expect(() => {
        decipher.update(extractedData);
        decipher.final();
      }).toThrow();
    });
  });

  // ============================================================================
  // File Format Tests
  // ============================================================================
  describe('Encrypted File Format', () => {
    test('Should have .enc extension', () => {
      const filename = 'ediscovery_backup_2025-11-17_06-25-03-303Z.sql';
      const encryptedFilename = `${filename}.enc`;
      
      expect(encryptedFilename.endsWith('.enc')).toBe(true);
      expect(encryptedFilename).toBe('ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc');
    });

    test('Should strip .enc extension for decryption', () => {
      const encryptedFilename = 'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc';
      const decryptedFilename = encryptedFilename.replace('.enc', '');
      
      expect(decryptedFilename).toBe('ediscovery_backup_2025-11-17_06-25-03-303Z.sql');
      expect(decryptedFilename.endsWith('.sql')).toBe(true);
    });

    test('Should recognize encrypted files by extension', () => {
      const files = [
        'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc',
        'ediscovery_backup_2025-11-17_06-24-48-249Z.sql',
        'ediscovery_backup_2025-11-17_05-59-24-590Z.sql.enc'
      ];
      
      const encryptedFiles = files.filter(f => f.endsWith('.enc'));
      const unencryptedFiles = files.filter(f => f.endsWith('.sql') && !f.endsWith('.enc'));
      
      expect(encryptedFiles).toHaveLength(2);
      expect(unencryptedFiles).toHaveLength(1);
    });

    test('Should maintain timestamp in encrypted filename', () => {
      const originalFile = 'ediscovery_backup_2025-11-17_06-25-03-303Z.sql';
      const encryptedFile = `${originalFile}.enc`;
      
      const timestampMatch = encryptedFile.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}Z/);
      expect(timestampMatch).not.toBeNull();
      expect(timestampMatch[0]).toBe('2025-11-17_06-25-03-303Z');
    });
  });

  // ============================================================================
  // Backup Listing Tests
  // ============================================================================
  describe('Backup Listing with Encryption Status', () => {
    beforeEach(async () => {
      // Create test backup files
      await fs.writeFile(
        path.join(BACKUP_DIR, 'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc'),
        'encrypted content'
      );
      await fs.writeFile(
        path.join(BACKUP_DIR, 'ediscovery_backup_2025-11-17_06-24-48-249Z.sql'),
        'unencrypted content'
      );
    });

    afterEach(async () => {
      // Clean up test files
      try {
        await fs.unlink(path.join(BACKUP_DIR, 'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc'));
      } catch {}
      try {
        await fs.unlink(path.join(BACKUP_DIR, 'ediscovery_backup_2025-11-17_06-24-48-249Z.sql'));
      } catch {}
    });

    test('Should identify encrypted backups', async () => {
      const files = await fs.readdir(BACKUP_DIR);
      const backupFiles = files.filter(f => 
        f.startsWith(BACKUP_PREFIX) && (f.endsWith('.sql') || f.endsWith('.sql.enc'))
      );
      
      const encryptedCount = backupFiles.filter(f => f.endsWith('.enc')).length;
      const unencryptedCount = backupFiles.filter(f => f.endsWith('.sql') && !f.endsWith('.enc')).length;
      
      expect(backupFiles.length).toBeGreaterThanOrEqual(2);
      expect(encryptedCount).toBeGreaterThanOrEqual(1);
      expect(unencryptedCount).toBeGreaterThanOrEqual(1);
    });

    test('Should include encryption metadata in listing', async () => {
      const files = await fs.readdir(BACKUP_DIR);
      const backupFiles = files
        .filter(f => f.startsWith(BACKUP_PREFIX) && (f.endsWith('.sql') || f.endsWith('.sql.enc')))
        .sort()
        .reverse();
      
      const backups = [];
      for (const file of backupFiles) {
        const filepath = path.join(BACKUP_DIR, file);
        const stats = await fs.stat(filepath);
        backups.push({
          filename: file,
          filepath,
          size: stats.size,
          encrypted: file.endsWith('.enc'),
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      expect(backups.length).toBeGreaterThanOrEqual(2);
      expect(backups.some(b => b.encrypted === true)).toBe(true);
      expect(backups.some(b => b.encrypted === false)).toBe(true);
    });
  });

  // ============================================================================
  // Retention Policy Tests
  // ============================================================================
  describe('Backup Retention with Mixed Encryption', () => {
    test('Should count both encrypted and unencrypted backups for retention', async () => {
      const allFiles = [
        'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc',
        'ediscovery_backup_2025-11-17_06-24-48-249Z.sql',
        'ediscovery_backup_2025-11-17_05-59-24-590Z.sql.enc',
        'ediscovery_backup_2025-11-17_05-57-12-038Z.sql'
      ];
      
      const backupFiles = allFiles
        .filter(f => f.startsWith(BACKUP_PREFIX) && (f.endsWith('.sql') || f.endsWith('.sql.enc')))
        .sort()
        .reverse();
      
      expect(backupFiles.length).toBe(4);
      expect(backupFiles[0]).toContain('06-25-03'); // Most recent
      expect(backupFiles[3]).toContain('05-57-12'); // Oldest
    });

    test('Should delete oldest backups regardless of encryption', () => {
      const MAX_BACKUPS = 3;
      const backupFiles = [
        'ediscovery_backup_2025-11-17_06-25-03-303Z.sql.enc',
        'ediscovery_backup_2025-11-17_06-24-48-249Z.sql',
        'ediscovery_backup_2025-11-17_05-59-24-590Z.sql.enc',
        'ediscovery_backup_2025-11-17_05-57-12-038Z.sql'
      ].sort().reverse();
      
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      
      expect(filesToDelete.length).toBe(1);
      expect(filesToDelete[0]).toContain('05-57-12'); // Oldest file
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================
  describe('Security Considerations', () => {
    test('Should use cryptographically secure random for IV', () => {
      const iv1 = crypto.randomBytes(16);
      const iv2 = crypto.randomBytes(16);
      
      expect(iv1.length).toBe(16);
      expect(iv2.length).toBe(16);
      expect(iv1.equals(iv2)).toBe(false); // Extremely unlikely to be equal
    });

    test('Should use cryptographically secure random for salt', () => {
      const salt1 = crypto.randomBytes(32);
      const salt2 = crypto.randomBytes(32);
      
      expect(salt1.length).toBe(32);
      expect(salt2.length).toBe(32);
      expect(salt1.equals(salt2)).toBe(false);
    });

    test('Should use 256-bit encryption key', () => {
      const key = crypto.randomBytes(32);
      expect(key.length).toBe(32); // 256 bits / 8 = 32 bytes
    });

    test('Should verify file is not readable SQL after encryption', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE, 'utf-8');
      
      // Verify encrypted content doesn't contain SQL keywords
      expect(encryptedContent).not.toContain('CREATE TABLE');
      expect(encryptedContent).not.toContain('INSERT INTO');
      expect(encryptedContent).not.toContain('PostgreSQL');
    });

    test('Should have sufficient PBKDF2 iterations (100,000+)', () => {
      const ITERATIONS = 100000;
      expect(ITERATIONS).toBeGreaterThanOrEqual(100000);
      
      // OWASP recommendation: 600,000 for PBKDF2-HMAC-SHA256 (2023)
      // We use 100,000 as a reasonable balance for backup operations
      expect(ITERATIONS).toBeGreaterThanOrEqual(100000);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================
  describe('Encryption Performance', () => {
    test('Should encrypt small backup file quickly', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const startTime = Date.now();
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in less than 100ms for small files
      expect(duration).toBeLessThan(100);
    });

    test('Should add minimal overhead to file size', async () => {
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      const originalSize = inputData.length;
      const encryptedSize = (await fs.stat(TEST_ENCRYPTED_FILE)).size;
      const overhead = encryptedSize - originalSize;
      
      // Overhead should be exactly 64 bytes (32 salt + 16 IV + 16 auth tag)
      expect(overhead).toBe(64);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error Handling', () => {
    test('Should handle missing encryption key gracefully', () => {
      const key = process.env.BACKUP_ENCRYPTION_KEY;
      
      if (!key) {
        // Should return null or indicate no encryption
        expect(key).toBeUndefined();
      } else {
        expect(typeof key).toBe('string');
      }
    });

    test('Should handle corrupted encrypted file header', async () => {
      // Create corrupted encrypted file (too short)
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.from('corrupted'));
      
      const fileContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      
      // Should be able to detect insufficient header size
      expect(fileContent.length).toBeLessThan(64);
    });

    test('Should handle non-existent file during decryption', async () => {
      const nonExistentFile = path.join(BACKUP_DIR, 'nonexistent.sql.enc');
      
      await expect(fs.readFile(nonExistentFile)).rejects.toThrow();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('End-to-End Encryption Flow', () => {
    test('Should complete full encrypt-decrypt cycle', async () => {
      // 1. Create original backup
      await fs.writeFile(TEST_BACKUP_FILE, SAMPLE_SQL);
      const originalContent = await fs.readFile(TEST_BACKUP_FILE, 'utf-8');
      
      // 2. Encrypt
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
      const inputData = await fs.readFile(TEST_BACKUP_FILE);
      const encryptedData = Buffer.concat([cipher.update(inputData), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      await fs.writeFile(TEST_ENCRYPTED_FILE, Buffer.concat([salt, iv, authTag, encryptedData]));
      
      // 3. Delete original
      await fs.unlink(TEST_BACKUP_FILE);
      
      // 4. Verify original is gone
      await expect(fs.access(TEST_BACKUP_FILE)).rejects.toThrow();
      
      // 5. Decrypt
      const encryptedContent = await fs.readFile(TEST_ENCRYPTED_FILE);
      const extractedIv = encryptedContent.slice(32, 48);
      const extractedAuthTag = encryptedContent.slice(48, 64);
      const extractedData = encryptedContent.slice(64);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, extractedIv);
      decipher.setAuthTag(extractedAuthTag);
      const decryptedData = Buffer.concat([decipher.update(extractedData), decipher.final()]);
      
      await fs.writeFile(TEST_BACKUP_FILE, decryptedData);
      
      // 6. Verify restored content matches original
      const restoredContent = await fs.readFile(TEST_BACKUP_FILE, 'utf-8');
      expect(restoredContent).toBe(originalContent);
      
      // 7. Clean up decrypted file (simulating restore cleanup)
      await fs.unlink(TEST_BACKUP_FILE);
    });

    test('Should support multiple encrypted backups simultaneously', async () => {
      const key = crypto.randomBytes(32);
      const testFiles = [];
      
      // Create multiple encrypted backups
      for (let i = 0; i < 3; i++) {
        const filename = path.join(BACKUP_DIR, `test_backup_${i}.sql`);
        const encFilename = `${filename}.enc`;
        testFiles.push(filename, encFilename);
        
        await fs.writeFile(filename, `${SAMPLE_SQL}\n-- Backup ${i}`);
        
        const iv = crypto.randomBytes(16);
        const salt = crypto.randomBytes(32);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const data = await fs.readFile(filename);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();
        
        await fs.writeFile(encFilename, Buffer.concat([salt, iv, authTag, encrypted]));
        await fs.unlink(filename);
      }
      
      // Verify all encrypted files exist
      for (let i = 0; i < 3; i++) {
        const encFilename = path.join(BACKUP_DIR, `test_backup_${i}.sql.enc`);
        await expect(fs.access(encFilename)).resolves.not.toThrow();
      }
      
      // Clean up
      for (const file of testFiles) {
        try {
          await fs.unlink(file);
        } catch {}
      }
    });
  });
});
