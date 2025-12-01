# eDiscovery FastAPI Service

Advanced search, export, and audit endpoints for the eDiscovery system.

## Features

### 🔍 Search Endpoints (`/api/search`)
- **POST /api/search/** - Advanced full-text search with filtering
  - Full-text search across documents
  - Filter by case, document type, custodian, date range
  - Tag-based filtering
  - Pagination support
  - Relevance scoring
  
- **GET /api/search/suggest** - Search suggestions
- **GET /api/search/stats** - Search statistics

### 📤 Export Endpoints (`/api/export`)
- **POST /api/export/documents** - Export documents to CSV, JSON, or XLSX
  - Batch export with filtering
  - Background job processing
  - Multiple format support
  - Metadata inclusion option
  
- **GET /api/export/job/{job_id}** - Check export job status
- **GET /api/export/download/{job_id}** - Download completed export
- **GET /api/export/formats** - List available export formats

### 📊 Audit Endpoints (`/api/audit`)
- **GET /api/audit/logs** - Retrieve audit logs with advanced filtering
  - Filter by user, action, resource, status
  - Date range filtering
  - Pagination support
  
- **GET /api/audit/stats** - Audit statistics and metrics
- **GET /api/audit/actions** - List all audit action types
- **GET /api/audit/resource-types** - List all resource types
- **GET /api/audit/timeline** - Activity timeline visualization

## Installation

### Prerequisites
- Python 3.9+
- PostgreSQL database (shared with Node.js backend)

### Setup

1. **Install dependencies:**
```bash
cd backend/fastapi
pip install -r requirements.txt
```

2. **Configure environment:**
Create a `.env` file:
```env
DATABASE_URL=postgresql://ediscovery_user:securepass123@localhost:5432/ediscovery_db
API_HOST=0.0.0.0
API_PORT=8000
NODEJS_BACKEND_URL=http://localhost:4443
SECRET_KEY=your-secret-key-here
```

3. **Run the service:**
```bash
# Development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once running, access the interactive API documentation:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

## Usage Examples

### Search Documents

```bash
curl -X POST "http://localhost:8000/api/search/" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "contract",
    "case_id": 1,
    "limit": 50,
    "offset": 0
  }'
```

### Export Documents

```bash
# Start export job
curl -X POST "http://localhost:8000/api/export/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "format": "csv",
    "include_metadata": true
  }'

# Check job status
curl "http://localhost:8000/api/export/job/{job_id}"

# Download when complete
curl "http://localhost:8000/api/export/download/{job_id}" -o export.csv
```

### Get Audit Logs

```bash
curl "http://localhost:8000/api/audit/logs?action=upload&limit=100"
```

### Get Audit Statistics

```bash
curl "http://localhost:8000/api/audit/stats?hours=24"
```

## Architecture

This FastAPI service complements the existing Node.js/Express backend:

- **Node.js Backend (Port 4443):** Core CRUD operations, authentication, file uploads
- **FastAPI Service (Port 8000):** Advanced search, bulk exports, audit analytics

Both services share the same PostgreSQL database.

## Database Schema

The service uses existing tables:
- `documents` - Document metadata and files
- `cases` - Case information
- `users` - User accounts
- `audit_logs` - Audit trail records

## Development

### Run tests:
```bash
pytest
```

### Code formatting:
```bash
black .
flake8 .
```

### Type checking:
```bash
mypy .
```

## Production Deployment

### Using Docker:
```bash
docker build -t ediscovery-fastapi .
docker run -p 8000:8000 ediscovery-fastapi
```

### Using systemd:
```bash
sudo systemctl start ediscovery-fastapi
sudo systemctl enable ediscovery-fastapi
```

## Performance

- Async/await for non-blocking I/O
- Background tasks for long-running exports
- Database connection pooling
- Response caching (can be added with Redis)

## Security

- CORS configured for allowed origins
- Database parameterized queries (SQL injection prevention)
- Input validation with Pydantic models
- Rate limiting (can be added)

## Contributing

See main project README for contribution guidelines.

## License

See main project LICENSE file.
