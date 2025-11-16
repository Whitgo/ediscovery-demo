const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

// AES-256-GCM encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits for key derivation

/**
 * Get encryption key from environment
 * In production, this should be stored in a secure key management service (AWS KMS, Azure Key Vault, etc.)
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY not set in environment variables');
  }
  
  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
  }
  
  return keyBuffer;
}

/**
 * Generate a random encryption key (for setup)
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt a file with AES-256-GCM
 * @param {string} inputPath - Path to source file
 * @param {string} outputPath - Path to encrypted output file
 * @returns {Promise<Object>} - Encryption metadata (iv, authTag, salt)
 */
async function encryptFile(inputPath, outputPath) {
  const key = getEncryptionKey();
  
  // Generate random IV (initialization vector)
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Generate random salt (for additional security in metadata)
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Create streams
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  
  try {
    // Encrypt the file
    await pipelineAsync(
      input,
      cipher,
      output
    );
    
    // Get authentication tag (verifies integrity)
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
      algorithm: ALGORITHM
    };
  } catch (error) {
    // Clean up output file on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a file with AES-256-GCM
 * @param {string} inputPath - Path to encrypted file
 * @param {string} outputPath - Path to decrypted output file
 * @param {Object} metadata - Encryption metadata (iv, authTag)
 * @returns {Promise<void>}
 */
async function decryptFile(inputPath, outputPath, metadata) {
  const key = getEncryptionKey();
  
  if (!metadata.iv || !metadata.authTag) {
    throw new Error('Missing encryption metadata (iv or authTag)');
  }
  
  // Convert hex strings back to buffers
  const iv = Buffer.from(metadata.iv, 'hex');
  const authTag = Buffer.from(metadata.authTag, 'hex');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Create streams
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  
  try {
    // Decrypt the file
    await pipelineAsync(
      input,
      decipher,
      output
    );
  } catch (error) {
    // Clean up output file on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Decryption failed: File has been tampered with or wrong key');
    }
    
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt a buffer (for smaller data)
 * @param {Buffer} buffer - Data to encrypt
 * @returns {Object} - Encrypted data and metadata
 */
function encryptBuffer(buffer) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt a buffer
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {Object} metadata - Encryption metadata
 * @returns {Buffer} - Decrypted data
 */
function decryptBuffer(encryptedData, metadata) {
  const key = getEncryptionKey();
  const iv = Buffer.from(metadata.iv, 'hex');
  const authTag = Buffer.from(metadata.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const encrypted = Buffer.from(encryptedData, 'base64');
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

/**
 * Check if encryption is enabled
 */
function isEncryptionEnabled() {
  return !!process.env.ENCRYPTION_KEY;
}

module.exports = {
  encryptFile,
  decryptFile,
  encryptBuffer,
  decryptBuffer,
  generateEncryptionKey,
  isEncryptionEnabled
};
