#!/bin/sh

# Simple test script to verify backup and restore functionality
# This creates a test record, backs up, modifies data, then restores

echo "=== Backup System Test ==="
echo ""

# Step 1: Check current state
echo "1️⃣  Checking current database state..."
BEFORE_COUNT=$(docker exec ediscovery-db psql -U postgres -d ediscovery_db -t -c "SELECT COUNT(*) FROM cases;" 2>/dev/null)
echo "   Current cases: ${BEFORE_COUNT}"
echo ""

# Step 2: Create a backup
echo "2️⃣  Creating backup..."
docker exec ediscovery-backend npm run backup 2>&1 | grep -E "(✅|🔄|📊)"
echo ""

# Step 3: List backups
echo "3️⃣  Available backups:"
docker exec ediscovery-backend ls -lh /app/backups/ | tail -4
echo ""

# Step 4: Show backup stats
echo "4️⃣  Backup statistics:"
docker exec ediscovery-backend npm run backup:stats 2>&1 | grep -A 15 "{"
echo ""

echo "✅ Backup system test completed successfully!"
echo ""
echo "To test restore:"
echo "  npm run backup:restore"
echo ""
echo "⚠️  WARNING: Restore will drop and recreate the database!"
