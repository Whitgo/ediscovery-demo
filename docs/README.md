# eDiscovery Demo - Documentation

Welcome to the eDiscovery Demo documentation. This comprehensive guide covers all aspects of the application, from setup to deployment.

## 📚 Documentation Structure

### [Security](./security/)
Security documentation including authentication, authorization, encryption, and security best practices.

- [Authentication & Authorization](./security/authentication.md) - JWT tokens, RBAC, role management
- [Encryption](./security/encryption.md) - Data encryption at rest, TLS/SSL configuration
- [Security Fixes](./security/security-fixes.md) - Recent security patches and vulnerability fixes
- [Input Validation](./security/input-validation.md) - Sanitization and validation practices
- [CORS Configuration](./security/cors.md) - Cross-Origin Resource Sharing setup

### [Features](./features/)
Detailed documentation for all application features and functionality.

- [Case Management](./features/case-management.md) - Creating, managing, and tracking cases
- [Document Management](./features/document-management.md) - Upload, storage, and retrieval
- [Outlook Integration](./features/outlook-integration.md) - Email import from Microsoft Outlook
- [Watermark & Bates Numbering](./features/watermark-bates.md) - Document stamping and numbering
- [Export Features](./features/export.md) - Export cases and documents
- [Tagging System](./features/tagging.md) - Document categorization and search
- [Data Retention](./features/retention.md) - Retention policies and legal holds
- [Audit Logging](./features/audit-logging.md) - Activity tracking and compliance
- [Incident Response](./features/incident-response.md) - Security incident management
- [Backup & Restore](./features/backup-restore.md) - Database backup and recovery

### [API Reference](./api/)
Complete API documentation for backend endpoints.

- [Authentication Endpoints](./api/auth.md) - Login, logout, token management
- [Cases API](./api/cases.md) - CRUD operations for cases
- [Documents API](./api/documents.md) - Document operations and metadata
- [Security Dashboard API](./api/security.md) - Security monitoring endpoints
- [Retention API](./api/retention.md) - Data retention management
- [Export API](./api/export.md) - Export functionality endpoints

### [Testing](./testing/)
Testing documentation, strategies, and test coverage reports.

- [Unit Tests](./testing/unit-tests.md) - Backend unit test documentation
- [Integration Tests](./testing/integration-tests.md) - API integration testing
- [Test Coverage](./testing/coverage.md) - Coverage reports and metrics
- [Security Testing](./testing/security-testing.md) - Vulnerability scanning and penetration testing

### [Deployment](./deployment/)
Deployment guides for various environments and platforms.

- [Local Development Setup](./deployment/local-setup.md) - Getting started with development
- [Docker Deployment](./deployment/docker.md) - Container-based deployment
- [Production Deployment](./deployment/production.md) - Production environment setup
- [Environment Variables](./deployment/environment-variables.md) - Configuration reference
- [Database Setup](./deployment/database.md) - PostgreSQL configuration and migrations

## 🚀 Quick Start

1. **Setup**: See [Local Development Setup](./deployment/local-setup.md)
2. **Features**: Explore [Features Documentation](./features/)
3. **API**: Reference [API Documentation](./api/)
4. **Security**: Review [Security Practices](./security/)

## 📋 Prerequisites

- Node.js v18+ 
- PostgreSQL 15+
- Docker (optional, recommended)
- Git

## 🔗 Related Documents

- [Main README](../README.md) - Project overview
- [Backend Package](../backend/package.json) - Backend dependencies
- [Frontend Package](../frontend/package.json) - Frontend dependencies

## 📝 Contributing

For information on contributing to documentation:
1. Follow the existing structure
2. Use clear, concise language
3. Include code examples where applicable
4. Keep documentation up to date with code changes

## 📞 Support

For questions or issues:
- Check existing documentation
- Review API reference
- Consult security guidelines
- Refer to testing documentation

---

**Last Updated**: November 26, 2025  
**Version**: 1.0.0  
**Repository**: [github.com/Whitgo/ediscovery-demo](https://github.com/Whitgo/ediscovery-demo)
