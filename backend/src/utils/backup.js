/**
 * Automated Backup System
 * Daily backups of database with 3-version retention
 * Includes AES-256-GCM encryption for backup files
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 3;
const BACKUP_PREFIX = 'ediscovery_backup';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    logger.info('Created backup directory', { path: BACKUP_DIR });
  }
}

/**
 * Get timestamp for backup filename
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').split('T').join('_').split('.')[0];
}

/**
 * Get encryption key from environment
 * Derives key using PBKDF2 if passphrase is provided
 */
function getEncryptionKey() {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  
  if (!key) {
    return null; // Encryption disabled
  }
  
  // If key is exactly 32 bytes (64 hex chars), use directly
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // Otherwise, derive key from passphrase using PBKDF2
  const salt = crypto.createHash('sha256').update('ediscovery-backup-salt').digest();
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt backup file using AES-256-GCM
 */
async function encryptBackupFile(inputFile) {
  const encryptionKey = getEncryptionKey();
  
  if (!encryptionKey) {
    logger.info('Backup encryption not configured - storing unencrypted');
    return { encrypted: false, outputFile: inputFile };
  }
  
  const outputFile = `${inputFile}.enc`;
  
  try {
    logger.info('Encrypting backup file', { inputFile: path.basename(inputFile) });
    
    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
    
    // Read input file
    const inputData = await fs.readFile(inputFile);
    
    // Encrypt data
    const encryptedData = Buffer.concat([
      cipher.update(inputData),
      cipher.final()
    ]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Write encrypted file with metadata header
    // Format: [SALT(32)][IV(16)][AUTH_TAG(16)][ENCRYPTED_DATA]
    const outputData = Buffer.concat([
      salt,
      iv,
      authTag,
      encryptedData
    ]);
    
    await fs.writeFile(outputFile, outputData);
    
    // Verify encrypted file was created
    const stats = await fs.stat(outputFile);
    logger.info('Backup encrypted successfully', { 
      filename: path.basename(outputFile), 
      sizeMB: (stats.size / 1024 / 1024).toFixed(2) 
    });
    
    // Delete unencrypted backup file
    await fs.unlink(inputFile);
    logger.debug('Removed unencrypted backup file');
    
    return {
      encrypted: true,
      outputFile,
      size: stats.size,
      algorithm: ENCRYPTION_ALGORITHM
    };
    
  } catch (error) {
    logger.error('Encryption failed', { error: error.message, inputFile: path.basename(inputFile) });
    
    // Clean up output file if it exists
    try {
      await fs.unlink(outputFile);
    } catch {}
    
    throw error;
  }
}

/**
 * Decrypt backup file using AES-256-GCM
 */
async function decryptBackupFile(inputFile) {
  const encryptionKey = getEncryptionKey();
  
  if (!encryptionKey) {
    throw new Error('BACKUP_ENCRYPTION_KEY environment variable required for decryption');
  }
  
  // Check if file is encrypted (has .enc extension)
  if (!inputFile.endsWith('.enc')) {
    logger.info('Backup file not encrypted', { filename: path.basename(backupFile) });
    return { decrypted: false, outputFile: inputFile };
  }
  
  const outputFile = inputFile.replace(/\.enc$/, '');
  
  try {
    logger.info('Decrypting backup file', { filename: path.basename(backupFile) });
    
    // Read encrypted file
    const encryptedData = await fs.readFile(inputFile);
    
    // Extract metadata from header
    const salt = encryptedData.slice(0, SALT_LENGTH);
    const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encryptedData.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    const decryptedData = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    // Write decrypted file
    await fs.writeFile(outputFile, decryptedData);
    
    const stats = await fs.stat(outputFile);
    logger.info('Backup decrypted successfully', { filename: path.basename(outputFile), sizeMB: (stats.size / 1024 / 1024).toFixed(2) });
    
    return {
      decrypted: true,
      outputFile,
      size: stats.size
    };
    
  } catch (error) {
    logger.error('Decryption failed', { error: error.message, backupFile: path.basename(backupFile) });
    
    // Clean up output file if it exists
    try {
      await fs.unlink(outputFile);
    } catch {}
    
    throw new Error('Decryption failed - invalid key or corrupted backup file');
  }
}

/**
 * Perform database backup
 */
async function performBackup() {
  await ensureBackupDir();
  
  const timestamp = getTimestamp();
  const backupFile = path.join(BACKUP_DIR, `${BACKUP_PREFIX}_${timestamp}.sql`);
  
  // Require environment variables - no defaults for security
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  
  if (!dbHost || !dbPort || !dbName || !dbUser || !dbPassword) {
    throw new Error('Database environment variables required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  }
  
  // Validate inputs to prevent command injection
  const sanitizeShellArg = (arg) => {
    if (typeof arg !== 'string') return '';
    // Remove any characters that could be used for command injection
    return arg.replace(/[^a-zA-Z0-9._-]/g, '');
  };
  
  const safeHost = sanitizeShellArg(dbHost);
  const safePort = sanitizeShellArg(dbPort);
  const safeUser = sanitizeShellArg(dbUser);
  const safeName = sanitizeShellArg(dbName);
  
  // Validate port is numeric
  if (!/^\d+$/.test(safePort)) {
    throw new Error('Invalid database port');
  }
  
  logger.info('Starting backup', { filename: path.basename(backupFile) });
  
  try {
    // Use pg_dump to create backup with sanitized inputs
    const command = `PGPASSWORD="${dbPassword}" pg_dump -h ${safeHost} -p ${safePort} -U ${safeUser} -d ${safeName} -F p -f "${backupFile}"`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('Backup warnings', { stderr });
    }
    
    // Verify backup file exists and has content
    const stats = await fs.stat(backupFile);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }
    
    logger.info('Backup completed successfully', { filename: path.basename(backupFile), sizeMB: (stats.size / 1024 / 1024).toFixed(2) });
    
    // Encrypt backup file if encryption is enabled
    const encryptionResult = await encryptBackupFile(backupFile);
    const finalFile = encryptionResult.outputFile;
    const finalStats = await fs.stat(finalFile);
    
    // Clean up old backups
    await cleanupOldBackups();
    
    return {
      success: true,
      filename: path.basename(finalFile),
      filepath: finalFile,
      size: finalStats.size,
      encrypted: encryptionResult.encrypted,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Backup failed', { error: error.message });
    
    // Clean up failed backup file if it exists
    try {
      await fs.unlink(backupFile);
    } catch {}
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Clean up old backups, keep only last MAX_BACKUPS versions
 */
async function cleanupOldBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    
    // Filter for backup files (both .sql and .sql.enc) and sort by name (timestamp embedded)
    const backupFiles = files
      .filter(f => f.startsWith(BACKUP_PREFIX) && (f.endsWith('.sql') || f.endsWith('.sql.enc')))
      .sort()
      .reverse(); // Most recent first
    
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      
      for (const file of filesToDelete) {
        const filepath = path.join(BACKUP_DIR, file);
        await fs.unlink(filepath);
        logger.info('Deleted old backup', { filename: file });
      }
    }
    
    logger.info('Total backups retained', { count: Math.min(backupFiles.length, MAX_BACKUPS) });
    
  } catch (error) {
    logger.error('Error cleaning up old backups', { error: error.message });
  }
}

/**
 * List available backups
 */
async function listBackups() {
  try {
    await ensureBackupDir();
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
    
    return backups;
    
  } catch (error) {
    logger.error('Error listing backups', { error: error.message });
    return [];
  }
}

/**
 * Restore database from backup file
 */
async function restoreBackup(backupFile = null) {
  try {
    // If no backup file specified, use the most recent
    if (!backupFile) {
      const backups = await listBackups();
      if (backups.length === 0) {
        throw new Error('No backups available to restore');
      }
      backupFile = backups[0].filepath;
    }
    
    // Validate backup file path to prevent directory traversal
    const normalizedPath = path.normalize(backupFile);
    const backupDir = path.resolve(BACKUP_DIR);
    const resolvedPath = path.resolve(normalizedPath);
    
    if (!resolvedPath.startsWith(backupDir)) {
      throw new Error('Invalid backup file path - directory traversal detected');
    }
    
    // Verify backup file exists
    await fs.access(backupFile);
    
    logger.info('Starting restore from backup', { filename: path.basename(backupFile) });
    
    // Decrypt backup file if it's encrypted
    let actualBackupFile = backupFile;
    let decryptResult = null;
    if (backupFile.endsWith('.enc')) {
      logger.info('Decrypting backup file');
      decryptResult = await decryptBackupFile(backupFile);
      actualBackupFile = decryptResult.outputFile;
    }
    
    // Require environment variables - no defaults for security
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT;
    const dbName = process.env.DB_NAME;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    
    if (!dbHost || !dbPort || !dbName || !dbUser || !dbPassword) {
      throw new Error('Database environment variables required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    }
    
    // Validate and sanitize inputs to prevent command injection
    const sanitizeShellArg = (arg) => {
      if (typeof arg !== 'string') return '';
      return arg.replace(/[^a-zA-Z0-9._-]/g, '');
    };
    
    const safeHost = sanitizeShellArg(dbHost);
    const safePort = sanitizeShellArg(dbPort);
    const safeUser = sanitizeShellArg(dbUser);
    const safeName = sanitizeShellArg(dbName);
    
    if (!/^\d+$/.test(safePort)) {
      throw new Error('Invalid database port');
    }
    
    // Drop and recreate database (for clean restore)
    logger.warn('Dropping existing database');
    const dropCommand = `PGPASSWORD="${dbPassword}" psql -h ${safeHost} -p ${safePort} -U ${safeUser} -d postgres -c "DROP DATABASE IF EXISTS ${safeName};"`;
    await execPromise(dropCommand);
    
    logger.info('Creating fresh database');
    const createCommand = `PGPASSWORD="${dbPassword}" psql -h ${safeHost} -p ${safePort} -U ${safeUser} -d postgres -c "CREATE DATABASE ${safeName};"`;
    await execPromise(createCommand);
    
    // Restore from backup
    logger.info('Restoring data from backup');
    const restoreCommand = `PGPASSWORD="${dbPassword}" psql -h ${safeHost} -p ${safePort} -U ${safeUser} -d ${safeName} -f "${actualBackupFile}"`;
    const { stdout, stderr } = await execPromise(restoreCommand);
    
    if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
      logger.warn('Restore warnings', { stderr });
    }
    
    // Clean up decrypted file if we created one
    if (decryptResult) {
      try {
        await fs.unlink(actualBackupFile);
        logger.debug('Cleaned up decrypted backup file');
      } catch {}
    }
    
    logger.info('Database restored successfully', { filename: path.basename(backupFile) });
    
    return {
      success: true,
      backup_file: path.basename(backupFile),
      decrypted: !!decryptResult,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Restore failed', { error: error.message });
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get backup statistics
 */
async function getBackupStats() {
  const backups = await listBackups();
  
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  const latest = backups.length > 0 ? backups[0] : null;
  
  return {
    total_backups: backups.length,
    total_size_mb: (totalSize / 1024 / 1024).toFixed(2),
    latest_backup: latest ? {
      filename: latest.filename,
      size_mb: (latest.size / 1024 / 1024).toFixed(2),
      created: latest.created
    } : null,
    backups
  };
}

module.exports = {
  performBackup,
  restoreBackup,
  listBackups,
  getBackupStats,
  cleanupOldBackups
};
