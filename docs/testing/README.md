# Testing Documentation

This section covers testing strategies, methodologies, and test coverage for the eDiscovery Demo application.

## 📑 Contents

### [Unit Tests](./unit-tests.md)
- Backend unit test suite
- Test organization and structure
- Mocking strategies
- Assertion patterns

### [Integration Tests](./integration-tests.md)
- API endpoint testing
- Database integration tests
- Authentication flow testing
- End-to-end scenarios

### [Test Coverage](./coverage.md)
- Coverage reports and metrics
- Coverage goals and targets
- Untested code identification
- Coverage improvement strategies

### [Security Testing](./security-testing.md)
- Vulnerability scanning
- Penetration testing
- Security audit results
- Compliance testing

## 🧪 Test Framework

The project uses **Jest** as the primary testing framework with:
- **Supertest** for API endpoint testing
- **Node Test Coverage** for coverage reporting
- **Custom test fixtures** for consistent test data

## 📊 Current Test Coverage

```
File                     | % Stmts | % Branch | % Funcs | % Lines
-------------------------|---------|----------|---------|--------
All files                |   78.5  |   72.3   |   81.2  |   79.1
backend/src/api/         |   85.3  |   78.9   |   88.1  |   86.2
backend/src/middleware/  |   72.1  |   68.5   |   75.3  |   73.4
backend/src/utils/       |   68.9  |   61.2   |   70.5  |   69.8
```

## 🎯 Testing Standards

### Unit Tests
- **Coverage Target**: 80% minimum
- **Naming Convention**: `filename.test.js`
- **Location**: `backend/__tests__/`
- **Run Command**: `npm test`

### Test Structure
```javascript
describe('Feature/Module Name', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
  });

  describe('specific functionality', () => {
    test('should do something specific', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## 🔍 Test Categories

### 1. Authentication Tests (`auditLogging.test.js`)
- Login endpoint validation
- Token generation
- Invalid credentials handling
- Rate limiting

### 2. RBAC Tests (`rbac.test.js`)
- Role-based access control
- Permission verification
- Unauthorized access prevention

### 3. Upload Tests (`upload.test.js`)
- File upload functionality
- File type validation
- Size limit enforcement
- Malicious file detection

### 4. Tagging Tests (`tags.test.js`)
- Tag creation and management
- Tag assignment to documents
- Tag search and filtering

### 5. Watermark Tests (`watermark.test.js`)
- PDF watermarking
- Bates numbering
- Watermark positioning
- Batch processing

### 6. Retention Tests (`retention.test.js`)
- Retention policy application
- Deadline calculation
- Legal hold functionality
- Automated cleanup

### 7. Backup Tests (`backup.test.js`)
- Backup creation
- Encrypted backup files
- Backup verification
- Restore functionality

### 8. Security Tests (`security.test.js`)
- Input validation
- SQL injection prevention
- XSS prevention
- CORS configuration

## 🚀 Running Tests

### Run All Tests
```bash
cd backend
npm test
```

### Run Specific Test Suite
```bash
npm test -- upload.test.js
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run with Open Handles Detection
```bash
npm test -- --detectOpenHandles
```

### Watch Mode
```bash
npm test -- --watch
```

## 📈 Coverage Reports

Coverage reports are generated in:
- **HTML**: `backend/coverage/lcov-report/index.html`
- **JSON**: `backend/coverage/coverage-final.json`
- **LCOV**: `backend/coverage/lcov.info`

View HTML report:
```bash
cd backend
open coverage/lcov-report/index.html
```

## ✅ Testing Checklist

Before merging code:

- [ ] All tests pass
- [ ] New features have tests
- [ ] Coverage meets minimum threshold
- [ ] No skipped or pending tests
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Performance tests pass (if applicable)

## 🐛 Common Testing Issues

### Issue: Tests hang or timeout
**Solution**: Use `--detectOpenHandles` to identify open connections

### Issue: Database connection errors
**Solution**: Ensure PostgreSQL is running and test database exists

### Issue: Flaky tests
**Solution**: Check for timing issues, async/await problems, or shared state

### Issue: Low coverage
**Solution**: Add tests for uncovered branches and edge cases

## 🔒 Security Testing

### Tools Used
- **npm audit** - Dependency vulnerability scanning
- **ESLint** - Static code analysis
- **Trivy** - Container vulnerability scanning
- **Custom security rules** - Application-specific checks

### Security Test Commands
```bash
# Check npm dependencies
npm audit

# Run security linter
npm run lint:security

# Full security scan
npm run security:scan
```

## 📝 Writing Tests

### Best Practices
1. **Arrange-Act-Assert** pattern
2. Clear test descriptions
3. Isolated test cases
4. Mock external dependencies
5. Test edge cases and errors
6. Use meaningful assertions
7. Clean up after tests

### Example Test
```javascript
test('should create case with valid data', async () => {
  // Arrange
  const caseData = {
    name: 'Test Case',
    number: '2024-TEST-001',
    status: 'open'
  };

  // Act
  const response = await request(app)
    .post('/api/cases')
    .set('Authorization', `Bearer ${token}`)
    .send(caseData);

  // Assert
  expect(response.status).toBe(201);
  expect(response.body.name).toBe(caseData.name);
  expect(response.body.id).toBeDefined();
});
```

---

**Last Updated**: November 26, 2025  
**Test Framework**: Jest 29.x  
**Coverage Tool**: NYC/Istanbul
