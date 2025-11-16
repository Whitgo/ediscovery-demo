const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { encryptFile, isEncryptionEnabled } = require('../utils/encryption');

// Allowed file types for legal documents
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/tiff': '.tiff',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'message/rfc822': '.eml'
};

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure hashed filename
    const hash = crypto.randomBytes(32).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const hashedName = `${hash}${ext}`;
    
    // Store original filename in request for later use
    req.originalFilename = file.originalname;
    req.hashedFilename = hashedName;
    
    cb(null, hashedName);
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();
  
  if (ALLOWED_TYPES[mimeType]) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${Object.values(ALLOWED_TYPES).join(', ')}`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Single file upload per request
  },
  fileFilter: fileFilter
});

/**
 * Middleware to encrypt uploaded file
 * Must be used after multer upload middleware
 */
async function encryptUploadedFile(req, res, next) {
  if (!req.file) {
    return next();
  }

  // Skip encryption if not enabled
  if (!isEncryptionEnabled()) {
    console.log('Encryption not enabled - storing file unencrypted');
    return next();
  }

  try {
    const originalPath = req.file.path;
    const encryptedPath = originalPath + '.enc';

    // Encrypt the file
    const encryptionMetadata = await encryptFile(originalPath, encryptedPath);

    // Delete original unencrypted file
    fs.unlinkSync(originalPath);

    // Rename encrypted file to original name
    fs.renameSync(encryptedPath, originalPath);

    // Store encryption metadata in request for database storage
    req.encryptionMetadata = encryptionMetadata;
    req.fileEncrypted = true;

    console.log(`File encrypted: ${req.hashedFilename}`);
    next();
  } catch (error) {
    console.error('File encryption error:', error);
    
    // Clean up files on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ 
      error: 'File encryption failed', 
      details: error.message 
    });
  }
}

module.exports = { upload, encryptUploadedFile, uploadsDir, ALLOWED_TYPES };
