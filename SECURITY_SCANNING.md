# Security Vulnerability Scanning

This document describes the comprehensive security vulnerability scanning system implemented for the eDiscovery application.

## Overview

The application now includes multiple layers of automated security scanning to detect and prevent vulnerabilities before they reach production.

## Scan Types

### 1. Dependency Vulnerability Scanning (npm audit)

**What it does:** Scans npm packages for known security vulnerabilities using the npm advisory database.

**How to run:**
```bash
# Backend
cd backend
npm run security:audit

# Frontend  
cd frontend
npm audit
```

**Current Status:**
- Backend: 0 critical, 0 high, 18 moderate
- Frontend: 0 critical, 3 high, 24 moderate

**Auto-fix:**
```bash
npm run security:fix
```

### 2. Static Code Analysis (ESLint Security Plugin)

**What it does:** Detects common security anti-patterns in JavaScript code including:
- SQL injection risks
- Command injection
- Path traversal
- Unsafe regex
- Eval usage
- Timing attacks
- CSRF vulnerabilities

**How to run:**
```bash
cd backend
npm run security:lint
```

**Common Issues Detected:**
- Non-literal file system operations (file uploads)
- Object injection sinks (dynamic property access)
- Unsafe regular expressions
- Command execution

### 3. Docker Image Scanning (Trivy)

**What it does:** Scans Docker images for vulnerabilities in OS packages and application dependencies.

**Installation:**
```bash
./backend/scripts/install-trivy.sh
```

**How to run:**
```bash
# Scan backend image
trivy image ediscovery-demo-backend:latest

# Scan frontend image  
trivy image ediscovery-demo-frontend:latest
```

### 4. Comprehensive Security Scan

**All-in-one security scan** that runs:
- npm audit (backend + frontend)
- Outdated package check
- Docker image scanning (if Trivy installed)
- Secret pattern detection
- HTTP security headers check

**How to run:**
```bash
./backend/scripts/security-scan.sh
```

**Output:**
- Console summary
- JSON reports in `./security-reports/`
- HTML report with charts

## GitHub Actions Integration

Automated security scanning runs on:
- ✅ Every push to main/develop
- ✅ Every pull request
- ✅ Daily scheduled scan at 2 AM UTC
- ✅ Manual workflow dispatch

**Workflow:** `.github/workflows/security-scan.yml`

**What happens:**
1. **Dependency Scan** - Checks for vulnerable npm packages
2. **Docker Scan** - Scans container images with Trivy
3. **Code Scan** - Runs ESLint security plugin and CodeQL
4. **Summary** - Generates comprehensive security report

**Build Fails If:**
- Any CRITICAL vulnerabilities found
- More than 3 HIGH vulnerabilities found

## Security Headers

Enhanced security headers implemented with Helmet:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | default-src 'self' | Prevents XSS attacks |
| Strict-Transport-Security | max-age=31536000 | Forces HTTPS |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | DENY | Prevents clickjacking |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer info |

**Verify:**
```bash
curl -I https://localhost:4443
```

## npm Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run security:audit` | Run npm audit (moderate+) |
| `npm run security:fix` | Auto-fix vulnerabilities |
| `npm run security:scan` | Comprehensive security scan |
| `npm run security:check` | Check outdated + audit |
| `npm run security:lint` | ESLint security scan |

### Frontend

| Command | Description |
|---------|-------------|
| `npm audit` | Check for vulnerabilities |
| `npm audit fix` | Auto-fix vulnerabilities |

## Vulnerability Remediation

### Priority Levels

1. **🔴 Critical** - Fix immediately, block deployment
2. **🟠 High** - Fix within 24-48 hours
3. **🟡 Moderate** - Fix within 1-2 weeks
4. **🟢 Low** - Fix during regular maintenance

### Remediation Steps

1. **Review the vulnerability:**
   ```bash
   npm audit
   ```

2. **Check if auto-fix available:**
   ```bash
   npm audit fix
   ```

3. **For breaking changes:**
   ```bash
   npm audit fix --force
   # WARNING: Test thoroughly after this!
   ```

4. **Manual update if needed:**
   ```bash
   npm update package-name
   # or
   npm install package-name@latest
   ```

5. **Verify the fix:**
   ```bash
   npm run test
   npm run security:audit
   ```

## Trivy Ignore File

To suppress false positives or accepted risks:

**File:** `.trivyignore`

**Format:**
```
# CVE-2024-1234
# Reason: False positive - not applicable to our use case
# Date: 2024-11-17
# Review by: 2025-01-17
CVE-2024-1234
```

## Security Reports

Reports are generated in `./security-reports/` with timestamps:

```
security-reports/
├── npm-audit-backend-20241117_052600.json
├── npm-audit-frontend-20241117_052600.json
├── npm-outdated-backend-20241117_052600.json
├── npm-outdated-frontend-20241117_052600.json
├── trivy-backend-20241117_052600.json
├── trivy-frontend-20241117_052600.json
├── http-headers-20241117_052600.txt
└── security-summary-20241117_052600.html
```

## Integration with CI/CD

### Pre-commit Hook (Recommended)

```bash
# .git/hooks/pre-commit
#!/bin/bash
cd backend && npm run security:lint
if [ $? -ne 0 ]; then
    echo "Security issues found! Fix before committing."
    exit 1
fi
```

### Pre-deployment Check

```bash
# Before deploying
./backend/scripts/security-scan.sh
if [ $? -ne 0 ]; then
    echo "Security scan failed! Fix before deploying."
    exit 1
fi
```

## Compliance Impact

This security scanning implementation addresses:

### SOC 2 (Security Trust Principle)
- ✅ CC7.1 - Detection of security vulnerabilities
- ✅ CC7.2 - Monitoring of security events
- ✅ CC8.1 - Change management controls

### GDPR (Article 32 - Security)
- ✅ Technical measures to ensure security
- ✅ Regular testing of security measures

### California Bar (ABA Model Rule 1.1)
- ✅ Reasonable efforts to prevent data breaches
- ✅ Regular security assessments

## Known Issues

### Backend
- 18 moderate vulnerabilities in test dependencies (jest ecosystem)
  - Status: Non-production, dev dependencies only
  - Impact: Low (not in production code)
  - Action: Monitor for updates

### Frontend
- 3 high, 24 moderate vulnerabilities in build tools
  - Status: Dev dependencies (webpack-dev-server, postcss)
  - Impact: Low (development environment only)
  - Action: Update when stable versions available

## Best Practices

1. **Run scans regularly:**
   ```bash
   npm run security:scan  # Weekly
   ```

2. **Review reports:**
   - Check HTML summary report
   - Prioritize critical/high issues
   - Document decisions for accepted risks

3. **Keep dependencies updated:**
   ```bash
   npm outdated
   npm update
   ```

4. **Monitor GitHub Security Advisories:**
   - Enable Dependabot alerts
   - Review weekly security digest

5. **Test after updates:**
   ```bash
   npm run test
   npm run security:audit
   ```

## Next Steps

1. **Enable Snyk integration** for continuous monitoring
2. **Set up Dependabot** for automated PRs
3. **Implement security dashboard** (Priority #6)
4. **Schedule quarterly penetration testing**
5. **Create incident response playbook**

## Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Trivy documentation](https://aquasecurity.github.io/trivy/)
- [ESLint security plugin](https://github.com/eslint-community/eslint-plugin-security)
- [Helmet.js documentation](https://helmetjs.github.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Contact

For security issues, contact: [security@example.com]

**Do NOT commit security issues to public repositories!**
