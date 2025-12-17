# MMC Application Deployment Guide

This guide covers deploying the MMC application to Dokploy (or any Docker-based hosting platform) with PostgreSQL, Redis, and Nginx.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Dokploy Setup](#dokploy-setup)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [File Storage Options](#file-storage-options)
- [Health Monitoring](#health-monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Dokploy instance (or any Docker-compatible hosting)
- Domain name (optional, for SSL)
- Git repository access

## Quick Start

1. Clone the repository to your server:
   ```bash
   git clone <repository-url>
   cd mmc
   ```

2. Copy and configure environment variables:
   ```bash
   cp .env.production.example .env
   ```

3. Generate secure secrets:
   ```bash
   # Generate SESSION_SECRET (32+ characters)
   openssl rand -base64 32
   
   # Generate ENCRYPTION_KEY (64 hex characters)
   openssl rand -hex 32
   ```

4. Edit `.env` with your values (see [Environment Configuration](#environment-configuration))

5. Start the stack:
   ```bash
   docker-compose up -d
   ```

6. Verify deployment:
   ```bash
   curl http://localhost/health
   ```

## Environment Configuration

### Required Variables

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | See format below |
| `SESSION_SECRET` | Session cookie signing key (32+ chars) | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | AES-256 encryption key (64 hex chars) | `openssl rand -hex 32` |

**DATABASE_URL Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

For Docker Compose deployments, use the service name as host:
```
postgresql://mmc_user:your_password@postgres:5432/mmc_db
```

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection for caching/realtime |
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Application port (internal) |
| `FILE_STORAGE_PATH` | `/app/uploads` | Local file storage path |
| `POSTGRES_USER` | `mmc` | PostgreSQL username |
| `POSTGRES_PASSWORD` | - | PostgreSQL password |
| `POSTGRES_DB` | `mmc` | PostgreSQL database name |
| `HTTP_PORT` | `80` | External HTTP port |
| `HTTPS_PORT` | `443` | External HTTPS port |
| `LOG_LEVEL` | `info` | Logging level |

### S3-Compatible Storage (Optional)

For cloud file storage, configure these additional variables:
```bash
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
# For non-AWS S3-compatible services:
AWS_S3_ENDPOINT=https://your-endpoint.com
```


## Dokploy Setup

### Step 1: Create Application in Dokploy

1. Log into your Dokploy dashboard
2. Click "Create Application"
3. Select "Docker Compose" as the deployment type
4. Connect your Git repository or upload files directly

### Step 2: Configure Environment Variables

In Dokploy's application settings:

1. Navigate to "Environment Variables"
2. Add all required variables from [Environment Configuration](#environment-configuration)
3. Ensure `POSTGRES_PASSWORD` matches the password in `DATABASE_URL`

### Step 3: Configure Volumes

Dokploy automatically handles Docker volumes. Verify these volumes are created:
- `mmc-pg-data` - PostgreSQL data persistence
- `mmc-redis-data` - Redis data persistence  
- `mmc-uploads` - User uploaded files

### Step 4: Configure Domain (Optional)

1. Navigate to "Domains" in Dokploy
2. Add your domain name
3. Enable "Auto SSL" for automatic Let's Encrypt certificates
4. Or configure custom SSL certificates (see [SSL Certificate Setup](#ssl-certificate-setup))

### Step 5: Deploy

1. Click "Deploy" in Dokploy
2. Monitor the build logs for any errors
3. Wait for health checks to pass (may take 30-60 seconds)

## SSL Certificate Setup

### Option 1: Dokploy Auto SSL (Recommended)

Dokploy can automatically provision Let's Encrypt certificates:

1. Add your domain in Dokploy's "Domains" section
2. Enable "Auto SSL"
3. Ensure ports 80 and 443 are accessible from the internet

### Option 2: Manual SSL Certificates

For custom certificates (e.g., wildcard or enterprise certificates):

1. Create SSL directory:
   ```bash
   mkdir -p docker/nginx/ssl
   ```

2. Copy your certificates:
   ```bash
   cp /path/to/fullchain.pem docker/nginx/ssl/
   cp /path/to/privkey.pem docker/nginx/ssl/
   ```

3. Update `docker-compose.yml` to mount SSL volume:
   ```yaml
   nginx:
     volumes:
       - ./docker/nginx/ssl:/etc/nginx/ssl:ro
   ```

4. Enable HTTPS in `docker/nginx/nginx.conf`:
   - Uncomment the HTTPS server block (lines starting with `# server { listen 443`)
   - Uncomment the HTTP to HTTPS redirect in the HTTP server block
   - Comment out the HTTP proxy location block

5. Restart Nginx:
   ```bash
   docker-compose restart nginx
   ```

### Option 3: Let's Encrypt with Certbot

For standalone Let's Encrypt setup:

1. Install certbot on your host:
   ```bash
   apt-get install certbot
   ```

2. Obtain certificates:
   ```bash
   certbot certonly --standalone -d yourdomain.com
   ```

3. Copy certificates to the SSL directory:
   ```bash
   cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/
   cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/
   ```

4. Set up auto-renewal cron job:
   ```bash
   0 0 1 * * certbot renew --quiet && docker-compose restart nginx
   ```

## File Storage Options

### Local Volume Storage (Default)

Files are stored in the `mmc-uploads` Docker volume mounted at `/app/uploads`.

**Backup uploads:**
```bash
docker run --rm -v mmc-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .
```

**Restore uploads:**
```bash
docker run --rm -v mmc-uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /data
```

### S3-Compatible Storage

For scalable cloud storage, configure S3 environment variables and the application will automatically use S3 for file operations.

## Health Monitoring

### Health Check Endpoint

The `/health` endpoint returns application status:

```bash
curl http://localhost/health
```

**Response format:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": { "status": "up", "latency": 5 },
    "redis": { "status": "up", "latency": 2 }
  }
}
```

**Status values:**
- `healthy` - All services operational
- `degraded` - Redis down, but database operational
- `unhealthy` - Database down

### Docker Health Checks

All services have built-in health checks:

```bash
# Check all service health
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' mmc-app
```

### Monitoring with Dokploy

Dokploy provides built-in monitoring:
- CPU and memory usage graphs
- Container logs
- Automatic restart on health check failures


## Troubleshooting

### Application Won't Start

**Symptom:** Container exits immediately after starting

**Check environment variables:**
```bash
docker-compose logs app | grep "Missing required"
```

Common causes:
- Missing `DATABASE_URL`, `SESSION_SECRET`, or `ENCRYPTION_KEY`
- Invalid format for environment variables

**Solution:** Verify all required variables are set in `.env`

---

### Database Connection Failed

**Symptom:** "Failed to connect to PostgreSQL after 5 attempts"

**Check PostgreSQL status:**
```bash
docker-compose ps postgres
docker-compose logs postgres
```

Common causes:
- PostgreSQL container not healthy
- Incorrect credentials in `DATABASE_URL`
- Network connectivity issues

**Solutions:**
1. Wait for PostgreSQL to be healthy:
   ```bash
   docker-compose up -d postgres
   docker-compose exec postgres pg_isready
   ```

2. Verify credentials match:
   ```bash
   # DATABASE_URL credentials should match POSTGRES_USER/POSTGRES_PASSWORD
   ```

3. Restart the stack:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

### Migration Errors

**Symptom:** "Database migration failed"

**View migration logs:**
```bash
docker-compose logs app | grep -A 10 "migration"
```

Common causes:
- Database schema conflicts
- Insufficient permissions

**Solutions:**
1. Check database permissions:
   ```bash
   docker-compose exec postgres psql -U mmc -d mmc -c "\du"
   ```

2. Reset database (WARNING: destroys data):
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

---

### 502 Bad Gateway

**Symptom:** Nginx returns 502 error page

**Check application status:**
```bash
docker-compose ps app
docker-compose logs app --tail 50
```

Common causes:
- Application container not running
- Application crashed during startup
- Health check failing

**Solutions:**
1. Restart application:
   ```bash
   docker-compose restart app
   ```

2. Check for startup errors in logs

3. Verify health endpoint:
   ```bash
   docker-compose exec app wget -qO- http://localhost:3000/health
   ```

---

### Redis Connection Issues

**Symptom:** Application shows "degraded" status

**Check Redis:**
```bash
docker-compose ps redis
docker-compose exec redis redis-cli ping
```

The application continues to work without Redis, but realtime features and caching are disabled.

**Solution:** Restart Redis:
```bash
docker-compose restart redis
```

---

### SSL Certificate Issues

**Symptom:** HTTPS not working or certificate errors

**Check certificate files:**
```bash
ls -la docker/nginx/ssl/
```

**Verify certificate validity:**
```bash
openssl x509 -in docker/nginx/ssl/fullchain.pem -text -noout | grep -A2 "Validity"
```

**Check Nginx configuration:**
```bash
docker-compose exec nginx nginx -t
```

---

### Disk Space Issues

**Symptom:** Containers failing, database errors

**Check disk usage:**
```bash
df -h
docker system df
```

**Clean up Docker:**
```bash
# Remove unused images and containers
docker system prune -a

# Remove unused volumes (WARNING: may delete data)
docker volume prune
```

---

### Viewing Logs

**All services:**
```bash
docker-compose logs -f
```

**Specific service:**
```bash
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f nginx
```

**Last N lines:**
```bash
docker-compose logs --tail 100 app
```

---

### Backup and Restore

**Backup PostgreSQL:**
```bash
docker-compose exec postgres pg_dump -U mmc mmc > backup.sql
```

**Restore PostgreSQL:**
```bash
cat backup.sql | docker-compose exec -T postgres psql -U mmc mmc
```

**Backup all volumes:**
```bash
# Stop services first
docker-compose stop

# Backup
docker run --rm -v mmc-pg-data:/data -v $(pwd):/backup alpine tar czf /backup/pg-data.tar.gz -C /data .
docker run --rm -v mmc-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /data .

# Restart services
docker-compose start
```

---

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**Increase container resources in `docker-compose.yml`:**
```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

---

### Getting Help

1. Check application logs for specific error messages
2. Verify all environment variables are correctly set
3. Ensure Docker and Docker Compose are up to date
4. Review the [Architecture documentation](ARCHITECTURE.md) for system design details
