# Security Documentation

This section covers all security-related aspects of the eDiscovery Demo application.

## 📑 Contents

### [Authentication & Authorization](./authentication.md)
- JWT token-based authentication
- Role-Based Access Control (RBAC)
- Permission matrix
- User roles and capabilities

### [Encryption](./encryption.md)
- Data encryption at rest
- TLS/SSL configuration
- Backup encryption
- Secure token storage

### [Security Fixes](./security-fixes.md)
- Recent vulnerability patches
- SQL injection prevention
- Input validation improvements
- CORS configuration fixes

### [Input Validation](./input-validation.md)
- Input sanitization middleware
- XSS prevention
- Parameter validation
- Bounds checking

### [CORS Configuration](./cors.md)
- Allowed origins
- Development vs production settings
- Security headers
- Preflight requests

## 🔒 Security Best Practices

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** regularly
3. **Keep dependencies updated** to patch vulnerabilities
4. **Enable rate limiting** on authentication endpoints
5. **Monitor audit logs** for suspicious activity
6. **Use strong passwords** and enforce password policies
7. **Implement MFA** for sensitive operations
8. **Regular security audits** and penetration testing

## 🛡️ Security Headers

The application implements comprehensive security headers:
- Content Security Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## 🚨 Incident Response

See [Incident Response documentation](../features/incident-response.md) for:
- Automated threat detection
- Brute force attack prevention
- Unauthorized access monitoring
- Incident reporting and tracking

## 📊 Security Monitoring

The security dashboard provides real-time monitoring of:
- Failed login attempts
- Active sessions
- Unauthorized access attempts
- Suspicious IP addresses
- Security events timeline

Access at: `/api/security/dashboard` (Admin/Manager only)

## 🔐 Encryption Details

- **Algorithm**: AES-256-GCM for backup encryption
- **TLS**: Self-signed certificates for development, Let's Encrypt recommended for production
- **Passwords**: bcrypt with salt rounds = 10
- **Tokens**: JWT with HS256 signature

## ⚠️ Known Limitations

- Self-signed SSL certificates in development (expected browser warnings)
- Rate limiting disabled by default (enable in production)
- CORS allows localhost origins for development

## 📝 Security Checklist

Before deploying to production:

- [ ] Replace self-signed SSL certificates with trusted certificates
- [ ] Set strong JWT_SECRET environment variable
- [ ] Configure production CORS_ORIGIN
- [ ] Enable rate limiting
- [ ] Set up automated backups with encryption
- [ ] Configure monitoring and alerting
- [ ] Review and restrict database permissions
- [ ] Enable firewall rules
- [ ] Set up intrusion detection
- [ ] Implement MFA for admin accounts

---

**Last Updated**: November 26, 2025
