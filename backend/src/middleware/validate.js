/**
 * Input Validation and Sanitization Middleware
 * Prevents XSS, SQL Injection, and other injection attacks
 */

const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');
const validator = require('validator');

/**
 * XSS Sanitization Configuration
 * Allows basic formatting but strips dangerous tags/attributes
 */
const xssOptions = {
  whiteList: {
    // Allow basic text formatting only
    b: [],
    i: [],
    em: [],
    strong: [],
    br: [],
    p: []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  
  // Remove any HTML/script tags
  const cleaned = xss(value, xssOptions);
  
  // Trim whitespace
  return validator.trim(cleaned);
}

/**
 * Sanitize all string fields in an object recursively
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Middleware to sanitize request body, query, and params
 */
function sanitizeInput(req, res, next) {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

/**
 * Validation error handler middleware
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
}

/**
 * Common validation rules
 */
const commonValidations = {
  // Email validation
  email: () => body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  // Password validation (for user creation/update)
  password: (required = true) => {
    const validation = body('password');
    
    if (required) {
      validation.notEmpty().withMessage('Password is required');
    } else {
      validation.optional();
    }
    
    return validation
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
  },
  
  // ID parameter validation (numeric IDs)
  id: (paramName = 'id') => param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a positive integer`)
    .toInt(),
  
  // Case number validation
  caseNumber: () => body('number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Case number must not exceed 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Case number can only contain letters, numbers, hyphens, and underscores'),
  
  // Name validation (for cases, users, etc.)
  name: (fieldName = 'name') => body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isLength({ min: 1, max: 255 })
    .withMessage(`${fieldName} must be between 1 and 255 characters`)
    .matches(/^[a-zA-Z0-9\s\-_.,'()]+$/)
    .withMessage(`${fieldName} contains invalid characters`),
  
  // Text field validation (notes, descriptions, etc.)
  text: (fieldName, maxLength = 5000) => body(fieldName)
    .optional()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`${fieldName} must not exceed ${maxLength} characters`),
  
  // Enum validation
  enum: (fieldName, allowedValues) => body(fieldName)
    .optional()
    .isIn(allowedValues)
    .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`),
  
  // Boolean validation
  boolean: (fieldName) => body(fieldName)
    .optional()
    .isBoolean()
    .withMessage(`${fieldName} must be a boolean value`)
    .toBoolean(),
  
  // Date validation
  date: (fieldName) => body(fieldName)
    .optional()
    .isISO8601()
    .withMessage(`${fieldName} must be a valid ISO 8601 date`)
    .toDate(),
  
  // Array validation
  array: (fieldName, itemType = 'string') => body(fieldName)
    .optional()
    .isArray()
    .withMessage(`${fieldName} must be an array`),
  
  // Integer validation
  integer: (fieldName, min = null, max = null) => {
    let validation = body(fieldName)
      .optional()
      .isInt();
    
    if (min !== null) {
      validation = validation.isInt({ min });
    }
    if (max !== null) {
      validation = validation.isInt({ max });
    }
    
    return validation
      .withMessage(`${fieldName} must be an integer${min !== null ? ` >= ${min}` : ''}${max !== null ? ` <= ${max}` : ''}`)
      .toInt();
  },
  
  // Pagination validation
  pagination: () => [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000')
      .toInt(),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
      .toInt()
  ]
};

/**
 * Validation rule sets for different endpoints
 */
const validationRules = {
  // User registration/creation
  createUser: [
    commonValidations.name('name'),
    commonValidations.email(),
    commonValidations.password(true),
    commonValidations.enum('role', ['user', 'manager', 'admin']),
    handleValidationErrors
  ],
  
  // User update
  updateUser: [
    commonValidations.id('id'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('email').optional().isEmail().normalizeEmail(),
    commonValidations.password(false),
    commonValidations.enum('role', ['user', 'manager', 'admin']),
    handleValidationErrors
  ],
  
  // Case creation
  createCase: [
    commonValidations.name('name'),
    commonValidations.caseNumber(),
    commonValidations.enum('status', ['open', 'closed', 'pending', 'active']),
    commonValidations.text('notes', 10000),
    commonValidations.text('disposition_notes', 5000),
    commonValidations.enum('disposition', ['plea', 'settlement', 'probation', 'dismissed', 'trial', 'pending']),
    handleValidationErrors
  ],
  
  // Case update
  updateCase: [
    commonValidations.id('id'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    commonValidations.enum('status', ['open', 'closed', 'pending', 'active']),
    commonValidations.text('notes', 10000),
    handleValidationErrors
  ],
  
  // Document metadata update
  updateDocument: [
    commonValidations.id('docId'),
    commonValidations.id('caseId'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('category').optional().trim().isLength({ max: 100 }),
    body('folder').optional().trim().isLength({ max: 255 }),
    handleValidationErrors
  ],
  
  // Login validation
  login: [
    commonValidations.email(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],
  
  // Retention policy update
  updateRetentionPolicy: [
    commonValidations.id('caseId'),
    commonValidations.enum('policy', ['10_years', '7_years', '5_years', '3_years', 'indefinite', 'custom']),
    body('custom_date').optional().isISO8601().toDate(),
    handleValidationErrors
  ],
  
  // Legal hold
  updateLegalHold: [
    commonValidations.id('caseId'),
    commonValidations.boolean('legal_hold'),
    handleValidationErrors
  ],
  
  // Privacy request
  createPrivacyRequest: [
    commonValidations.enum('type', ['export', 'deletion', 'rectification']),
    commonValidations.text('reason', 1000),
    handleValidationErrors
  ],
  
  // Generic ID validation
  validateId: [
    commonValidations.id('id'),
    handleValidationErrors
  ],
  
  // Generic caseId validation
  validateCaseId: [
    commonValidations.id('caseId'),
    handleValidationErrors
  ]
};

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  handleValidationErrors,
  validationRules,
  commonValidations
};
