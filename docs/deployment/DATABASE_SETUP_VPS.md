# Database Setup para sa VPS (Test Database)

> **Guide:** Paano mag-setup ng ibang database at i-update ang Prisma sa VPS

---

## Overview

Puwede mong gamitin ang ibang database para sa testing sa VPS. Prisma supports multiple database connections through environment variables.

---

## Step 1: Setup Environment Variables

### Option A: Separate .env files (Recommended)

**Local Development (.env):**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/aegira_dev
DIRECT_URL=postgresql://postgres:password@localhost:5432/aegira_dev
```

**VPS Test Database (.env.test o .env.production):**
```env
DATABASE_URL=postgresql://postgres:password@your-vps-ip:5432/aegira_test
DIRECT_URL=postgresql://postgres:password@your-vps-ip:5432/aegira_test
```

### Option B: Use DATABASE_URL directly sa command

Puwede mong override ang DATABASE_URL sa command mismo:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://user:pass@vps-ip:5432/test_db"; npm run db:push

# Linux/Mac
DATABASE_URL="postgresql://user:pass@vps-ip:5432/test_db" npm run db:push
```

---

## Step 2: Update Prisma Schema sa VPS

### Method 1: Using db:push (Recommended for Test Database)

**Sa VPS:**

```bash
# 1. Navigate to backend directory
cd /path/to/aegira/backend

# 2. Pull latest code (kung may binago sa schema)
git pull origin main

# 3. Install dependencies (if not yet installed)
npm install

# 4. Set test database URL
export DATABASE_URL="postgresql://user:password@vps-ip:5432/test_db"

# 5. Generate Prisma Client (IMPORTANTE pag may changes!)
npm run db:generate

# 6. Push schema changes to database (creates/updates tables)
npm run db:push
```

**What each command does:**
- `db:generate` - Generates Prisma Client based on schema (kailangan pag may changes)
- `db:push` - Pushes schema changes directly (good for dev/test, walang migration files)
- `db:migrate` - Creates migration files (better for production)

**⚠️ Important:** Kapag may binago ka sa `schema.prisma`, kailangan mo i-run ang `db:generate` at `db:push` para ma-update ang database.

**See:** `docs/UPDATE_SCHEMA_VPS.md` for detailed guide on updating schema changes.

### Method 2: Manual Migration

Kung may existing migrations ka na:

```bash
# 1. Copy migrations folder to VPS
# 2. Run migrations
npx prisma migrate deploy
```

---

## Step 3: Verify Database Connection

### Test Connection

```bash
# Test connection
npx prisma db pull

# Open Prisma Studio (visual database browser)
npm run db:studio
```

---

## Step 4: Seed Test Data (Optional)

```bash
# Seed database with test data
npm run seed

# Or clean and reset
npm run seed:reset
```

---

## Complete VPS Setup Script

Gumawa ka ng script para sa VPS:

**`backend/scripts/setup-vps-db.sh`**
```bash
#!/bin/bash

# VPS Database Setup Script
echo "🚀 Setting up Aegira database on VPS..."

# Set your VPS database URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/aegira_test"
export DIRECT_URL="postgresql://postgres:password@localhost:5432/aegira_test"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run db:generate

# Push schema to database
echo "📤 Pushing schema to database..."
npm run db:push

# Seed database (optional)
read -p "Do you want to seed the database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🌱 Seeding database..."
    npm run seed
fi

echo "✅ Database setup complete!"
```

**Make it executable:**
```bash
chmod +x backend/scripts/setup-vps-db.sh
```

**Run it:**
```bash
./backend/scripts/setup-vps-db.sh
```

---

## Windows PowerShell Script

**`backend/scripts/setup-vps-db.ps1`**
```powershell
# VPS Database Setup Script (PowerShell)
Write-Host "🚀 Setting up Aegira database on VPS..." -ForegroundColor Green

# Set your VPS database URL
$env:DATABASE_URL = "postgresql://postgres:password@your-vps-ip:5432/aegira_test"
$env:DIRECT_URL = "postgresql://postgres:password@your-vps-ip:5432/aegira_test"

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Generate Prisma Client
Write-Host "🔧 Generating Prisma Client..." -ForegroundColor Yellow
npm run db:generate

# Push schema to database
Write-Host "📤 Pushing schema to database..." -ForegroundColor Yellow
npm run db:push

# Seed database (optional)
$seed = Read-Host "Do you want to seed the database? (y/n)"
if ($seed -eq "y" -or $seed -eq "Y") {
    Write-Host "🌱 Seeding database..." -ForegroundColor Yellow
    npm run seed
}

Write-Host "✅ Database setup complete!" -ForegroundColor Green
```

**Run it:**
```powershell
.\backend\scripts\setup-vps-db.ps1
```

---

## Quick Commands Reference

### Local Development
```bash
# Use local database
npm run db:push
npm run db:generate
npm run db:studio
```

### VPS Test Database
```bash
# Set VPS database URL
export DATABASE_URL="postgresql://user:pass@vps-ip:5432/test_db"

# Update database
npm run db:push
npm run db:generate
```

### Production Database
```bash
# Use migrations (safer)
npm run db:migrate

# Deploy migrations
npx prisma migrate deploy
```

---

## Troubleshooting

### Error: "Can't reach database server"

**Check:**
1. Database server is running
2. Firewall allows connection (port 5432)
3. Database credentials are correct
4. Network connectivity

**Test connection:**
```bash
# Test PostgreSQL connection
psql -h your-vps-ip -U postgres -d postgres
```

### Error: "Migration failed"

**Solution:**
```bash
# Reset migrations (⚠️ DANGER: Deletes all data)
npx prisma migrate reset

# Or push schema directly (ignores migrations)
npm run db:push
```

### Error: "Schema is out of sync"

**Solution:**
```bash
# Pull current database schema
npx prisma db pull

# Compare with schema.prisma
# Then push changes
npm run db:push
```

---

## Multiple Database Setup (Dev/Test/Prod)

### Using .env files

**`.env.development`**
```env
DATABASE_URL=postgresql://localhost:5432/aegira_dev
```

**`.env.test`**
```env
DATABASE_URL=postgresql://vps-ip:5432/aegira_test
```

**`.env.production`**
```env
DATABASE_URL=postgresql://prod-server:5432/aegira_prod
```

**Load specific env:**
```bash
# Linux/Mac
cp .env.test .env
npm run db:push

# Windows PowerShell
Copy-Item .env.test .env
npm run db:push
```

---

## Best Practices

1. ✅ **Use migrations for production** - `db:migrate` creates versioned migrations
2. ✅ **Use db:push for dev/test** - Faster, but no version control
3. ✅ **Never commit .env files** - Use .env.example as template
4. ✅ **Backup before migrations** - Especially in production
5. ✅ **Test migrations locally first** - Before applying to VPS

---

## Example: Complete VPS Workflow

```bash
# 1. SSH to VPS
ssh user@your-vps-ip

# 2. Navigate to project
cd /var/www/aegira/backend

# 3. Pull latest code
git pull origin main

# 4. Set database URL
export DATABASE_URL="postgresql://postgres:pass@localhost:5432/aegira_test"

# 5. Install/update dependencies
npm install

# 6. Generate Prisma Client
npm run db:generate

# 7. Update database schema
npm run db:push

# 8. (Optional) Seed test data
npm run seed

# 9. Restart application
pm2 restart aegira-backend
# OR
npm run start
```

---

*Last Updated: 2024*

