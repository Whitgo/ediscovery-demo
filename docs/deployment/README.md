# Deployment Documentation

This section covers deployment strategies, configuration, and environment setup for the eDiscovery Demo application.

## 📑 Contents

### [Local Development Setup](./local-setup.md)
- Prerequisites installation
- Environment configuration
- Database setup
- Running the application

### [Docker Deployment](./docker.md)
- Docker Compose configuration
- Container management
- Volume management
- Network configuration

### [Production Deployment](./production.md)
- Production checklist
- Security hardening
- Performance optimization
- Monitoring and logging

### [Environment Variables](./environment-variables.md)
- Complete configuration reference
- Required vs optional variables
- Security considerations
- Environment-specific settings

### [Database Setup](./database.md)
- PostgreSQL installation
- Schema migrations
- Seed data
- Backup and restore

## 🚀 Quick Start

### Development Environment

1. **Clone the repository**
```bash
git clone https://github.com/Whitgo/ediscovery-demo.git
cd ediscovery-demo
```

2. **Start database**
```bash
docker-compose up -d postgres
```

3. **Configure environment**
```bash
cd backend
cp .env.example .env
# Edit .env with your settings
```

4. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

5. **Run migrations**
```bash
cd backend
npx knex migrate:latest
npx knex seed:run
```

6. **Start servers**
```bash
# Backend (in backend directory)
npm run dev

# Frontend (in frontend directory)
npm run dev
```

7. **Access application**
- Frontend: http://localhost:5173
- Backend: https://localhost:4443
- Database: localhost:5432

## 🐳 Docker Deployment

### Using Docker Compose

```bash
docker-compose up -d
```

Services included:
- **postgres**: PostgreSQL 15 database
- **backend**: Node.js API server
- **frontend**: Vite React application

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f
```

## 🔧 Configuration

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ediscovery
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=ediscovery

# Authentication
JWT_SECRET=your-secret-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com

# Outlook Integration (optional)
OUTLOOK_CLIENT_ID=your-azure-app-id
OUTLOOK_CLIENT_SECRET=your-azure-app-secret
OUTLOOK_REDIRECT_URI=http://localhost:4443/api/outlook/callback

# Encryption
ENCRYPTION_KEY=32-character-key-for-backup-encryption

# Environment
NODE_ENV=development
PORT=4443
```

### Frontend (.env)
```env
VITE_API_BASE_URL=https://localhost:4443
```

## 📦 Build for Production

### Backend
```bash
cd backend
npm run build  # If build script exists
NODE_ENV=production node src/server.js
```

### Frontend
```bash
cd frontend
npm run build
# Serve dist/ directory with nginx or similar
```

## 🔒 Production Checklist

Before deploying to production:

### Security
- [ ] Replace self-signed SSL certificates
- [ ] Set strong JWT_SECRET
- [ ] Configure production CORS_ORIGIN
- [ ] Enable rate limiting
- [ ] Review and restrict database permissions
- [ ] Enable firewall rules
- [ ] Set up HTTPS only
- [ ] Disable debug logging

### Performance
- [ ] Enable compression
- [ ] Configure caching
- [ ] Optimize database indexes
- [ ] Set up CDN for static assets
- [ ] Configure load balancing (if needed)

### Monitoring
- [ ] Set up error tracking
- [ ] Configure log aggregation
- [ ] Enable health checks
- [ ] Set up alerting
- [ ] Configure backup monitoring

### Backup
- [ ] Automated daily backups
- [ ] Backup retention policy
- [ ] Test restore procedures
- [ ] Off-site backup storage

## 🌐 Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /var/www/ediscovery/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass https://localhost:4443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Health Checks

Backend health endpoint:
```bash
curl https://localhost:4443/api/health
```

Database connection check:
```bash
psql -h localhost -U postgres -d ediscovery -c "SELECT 1"
```

## 🔄 Updates and Maintenance

### Update application
```bash
git pull origin main
cd backend && npm install
cd ../frontend && npm install
npx knex migrate:latest
```

### Restart services
```bash
# Docker
docker-compose restart

# PM2
pm2 restart all

# Systemd
sudo systemctl restart ediscovery-backend
sudo systemctl restart ediscovery-frontend
```

## 📱 Supported Platforms

- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+
- **macOS**: 11+ (Big Sur)
- **Windows**: 10+ with WSL2
- **Docker**: 20.10+
- **Node.js**: 18+
- **PostgreSQL**: 15+

## 🆘 Troubleshooting

### Common Issues

**Database connection failed**
- Check PostgreSQL is running
- Verify credentials in .env
- Check firewall rules

**CORS errors**
- Verify CORS_ORIGIN in backend/.env
- Check browser console for exact origin
- Restart backend after .env changes

**Port already in use**
- Check for existing processes
- Change PORT in .env
- Kill conflicting processes

**SSL certificate errors**
- Normal for development (self-signed)
- Use `-k` flag with curl
- Install trusted certificates for production

---

**Last Updated**: November 26, 2025  
**Minimum Requirements**: Node.js 18+, PostgreSQL 15+, 2GB RAM
