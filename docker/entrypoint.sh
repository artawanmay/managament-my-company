#!/bin/sh
# =============================================================================
# Docker Entrypoint Script for MMC Application
# =============================================================================
#
# This script handles the startup sequence for the containerized application:
# 1. Validates required environment variables
# 2. Waits for PostgreSQL to be ready (with exponential backoff)
# 3. Runs database migrations
# 4. Starts the application server
#
# Requirements: 1.2, 2.1, 2.2
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
MAX_RETRIES=${DB_MAX_RETRIES:-5}
BASE_DELAY=${DB_BASE_DELAY:-1}

# Required environment variables
REQUIRED_VARS="DATABASE_URL SESSION_SECRET ENCRYPTION_KEY"

# -----------------------------------------------------------------------------
# Logging Functions
# -----------------------------------------------------------------------------
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warn() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# -----------------------------------------------------------------------------
# Environment Validation
# -----------------------------------------------------------------------------
# Validates that all required environment variables are set and non-empty
# Exits with code 1 if any required variable is missing
# -----------------------------------------------------------------------------
validate_environment() {
    log_info "Validating environment variables..."
    
    missing_vars=""
    
    for var in $REQUIRED_VARS; do
        eval value=\$$var
        if [ -z "$value" ]; then
            log_error "Missing required environment variable: $var"
            missing_vars="$missing_vars $var"
        fi
    done
    
    if [ -n "$missing_vars" ]; then
        log_error "Environment validation failed. Missing variables:$missing_vars"
        exit 1
    fi
    
    log_info "Environment validation passed"
}

# -----------------------------------------------------------------------------
# Database URL Parsing
# -----------------------------------------------------------------------------
# Extracts host and port from DATABASE_URL for connection checking
# Supports PostgreSQL URLs: postgresql://user:pass@host:port/database
# -----------------------------------------------------------------------------
parse_database_url() {
    # Extract host:port from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    
    # Remove protocol prefix
    url_without_protocol=$(echo "$DATABASE_URL" | sed 's|^[a-z]*://||')
    
    # Remove credentials (user:pass@)
    url_without_creds=$(echo "$url_without_protocol" | sed 's|^[^@]*@||')
    
    # Extract host:port (before the first /)
    host_port=$(echo "$url_without_creds" | cut -d'/' -f1)
    
    # Split host and port
    DB_HOST=$(echo "$host_port" | cut -d':' -f1)
    DB_PORT=$(echo "$host_port" | cut -d':' -f2)
    
    # Default port if not specified
    if [ "$DB_PORT" = "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        DB_PORT=5432
    fi
    
    log_info "Database host: $DB_HOST, port: $DB_PORT"
}

# -----------------------------------------------------------------------------
# PostgreSQL Wait with Exponential Backoff
# -----------------------------------------------------------------------------
# Waits for PostgreSQL to be ready using exponential backoff
# Delays: 1s, 2s, 4s, 8s, 16s (configurable via BASE_DELAY)
# Exits with code 1 after MAX_RETRIES failed attempts
# -----------------------------------------------------------------------------
wait_for_postgres() {
    log_info "Waiting for PostgreSQL to be ready..."
    
    parse_database_url
    
    attempt=1
    delay=$BASE_DELAY
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Connection attempt $attempt/$MAX_RETRIES..."
        
        # Try to connect using nc (netcat) or pg_isready if available
        if command -v pg_isready > /dev/null 2>&1; then
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; then
                log_info "PostgreSQL is ready!"
                return 0
            fi
        elif command -v nc > /dev/null 2>&1; then
            if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
                log_info "PostgreSQL is ready!"
                return 0
            fi
        else
            # Fallback: try to connect using Node.js
            if node -e "
                const net = require('net');
                const socket = new net.Socket();
                socket.setTimeout(2000);
                socket.on('connect', () => { socket.destroy(); process.exit(0); });
                socket.on('error', () => process.exit(1));
                socket.on('timeout', () => { socket.destroy(); process.exit(1); });
                socket.connect($DB_PORT, '$DB_HOST');
            " 2>/dev/null; then
                log_info "PostgreSQL is ready!"
                return 0
            fi
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_warn "Connection attempt $attempt failed. Retrying in ${delay}s..."
            sleep $delay
            # Exponential backoff: double the delay for next attempt
            delay=$((delay * 2))
            # Cap at 16 seconds
            if [ $delay -gt 16 ]; then
                delay=16
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Failed to connect to PostgreSQL after $MAX_RETRIES attempts"
    log_error "Database URL (redacted): postgresql://[user]:[REDACTED]@$DB_HOST:$DB_PORT/[database]"
    exit 1
}

# -----------------------------------------------------------------------------
# Database Migrations
# -----------------------------------------------------------------------------
# Runs Drizzle database migrations
# Exits with code 1 if migrations fail
# -----------------------------------------------------------------------------
run_migrations() {
    log_info "Running database migrations..."
    
    if ! npm run db:migrate; then
        log_error "Database migration failed"
        exit 1
    fi
    
    log_info "Database migrations completed successfully"
}

# -----------------------------------------------------------------------------
# Main Entrypoint
# -----------------------------------------------------------------------------
main() {
    log_info "Starting MMC application entrypoint..."
    log_info "Node.js version: $(node --version)"
    log_info "Environment: ${NODE_ENV:-development}"
    
    # Step 1: Validate environment variables
    validate_environment
    
    # Step 2: Wait for PostgreSQL (only if DATABASE_URL looks like PostgreSQL)
    case "$DATABASE_URL" in
        postgres://*|postgresql://*)
            wait_for_postgres
            ;;
        *)
            log_info "Non-PostgreSQL database detected, skipping wait"
            ;;
    esac
    
    # Step 3: Run database migrations
    run_migrations
    
    # Step 4: Start the application
    log_info "Starting application server..."
    exec "$@"
}

# Run main with all arguments passed to the script
main "$@"
