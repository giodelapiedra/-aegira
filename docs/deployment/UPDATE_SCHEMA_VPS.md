# Paano i-Update ang Prisma Schema sa Test Database (VPS)

> **Quick Guide:** Kapag may binago ka sa `schema.prisma`, paano i-apply sa test database sa VPS

---

## Quick Steps

### Method 1: db:push (Mabilis - Recommended para sa Test Database)

**Sa VPS:**

```bash
# 1. Navigate to backend directory
cd /path/to/aegira/backend

# 2. Set test database URL (kung hindi pa naka-set sa .env)
export DATABASE_URL="postgresql://user:password@vps-ip:5432/test_db"

# 3. Generate Prisma Client (kailangan pag may bagong fields)
npm run db:generate

# 4. Push schema changes to database
npm run db:push
```

**What happens:**
- ✅ Prisma compares your `schema.prisma` with the database
- ✅ Creates new tables/columns if wala pa
- ✅ Updates existing tables/columns
- ✅ Removes columns if tinanggal mo sa schema (⚠️ may warning)

---

### Method 2: Using Script (Easiest)

**Gamitin ang setup script:**

```bash
# Sa VPS
cd backend
./scripts/setup-vps-db.sh "postgresql://user:pass@localhost:5432/test_db"
```

**O kung may .env na:**
```bash
cd backend
npm run db:generate
npm run db:push
```

---

## Step-by-Step Process

### 1. Local Development (Gumawa ng Changes)

```bash
# 1. Edit schema.prisma
# Example: Nagdagdag ka ng bagong field
# model User {
#   id        String   @id @default(uuid())
#   email     String
#   newField  String?  // ← Bagong field
# }

# 2. Test locally first (optional pero recommended)
npm run db:generate
npm run db:push
```

### 2. Commit Changes

```bash
git add prisma/schema.prisma
git commit -m "feat: Add newField to User model"
git push origin main
```

### 3. Sa VPS - Pull at Update

```bash
# 1. SSH to VPS
ssh user@your-vps-ip

# 2. Navigate to project
cd /var/www/aegira/backend

# 3. Pull latest code (kasama na ang bagong schema)
git pull origin main

# 4. Install dependencies (kung may bagong packages)
npm install

# 5. Set test database URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/aegira_test"

# 6. Generate Prisma Client (IMPORTANTE!)
npm run db:generate

# 7. Push schema changes to test database
npm run db:push
```

---

## Common Scenarios

### Scenario 1: Nagdagdag ng Bagong Model

**Example:**
```prisma
model NewTable {
  id   String @id @default(uuid())
  name String
}
```

**Commands:**
```bash
npm run db:generate  # Generate client
npm run db:push      # Create table sa database
```

**Result:** ✅ New table created

---

### Scenario 2: Nagdagdag ng Bagong Field sa Existing Model

**Example:**
```prisma
model User {
  id        String   @id @default(uuid())
  email     String
  phone     String?  // ← Bagong field
}
```

**Commands:**
```bash
npm run db:generate
npm run db:push
```

**Result:** ✅ New column `phone` added to `User` table

---

### Scenario 3: Nagbago ng Field Type

**Example:**
```prisma
model User {
  id    String   @id @default(uuid())
  age   Int      // Changed from String to Int
}
```

**Commands:**
```bash
npm run db:generate
npm run db:push
```

**⚠️ Warning:** Prisma will warn you if may data loss (e.g., String to Int conversion)
- Review the warning carefully
- May need to migrate data manually

---

### Scenario 4: Nagtanggal ng Field

**Example:**
```prisma
model User {
  id    String   @id @default(uuid())
  // oldField String  ← Tinanggal mo
}
```

**Commands:**
```bash
npm run db:generate
npm run db:push
```

**⚠️ Warning:** Prisma will ask for confirmation
- Type `y` to confirm
- ⚠️ Data in that column will be lost!

---

## db:push vs db:migrate

### db:push (Recommended for Test Database)

**Pros:**
- ✅ Mabilis - Direct push to database
- ✅ Walang migration files needed
- ✅ Good for development/testing
- ✅ Auto-detects changes

**Cons:**
- ❌ Walang version control
- ❌ Hindi recommended sa production

**When to use:**
- ✅ Test database
- ✅ Development database
- ✅ Quick schema changes

---

### db:migrate (Recommended for Production)

**Pros:**
- ✅ May version control (migration files)
- ✅ Can rollback changes
- ✅ Better for team collaboration
- ✅ Production-ready

**Cons:**
- ❌ Mas mabagal (need to create migration files)
- ❌ More steps

**When to use:**
- ✅ Production database
- ✅ Team projects
- ✅ Need version control

---

## Complete Workflow Example

### Local → VPS Test Database

**1. Local (Gumawa ng changes):**
```bash
# Edit prisma/schema.prisma
# Add new field, model, etc.

# Test locally
npm run db:generate
npm run db:push

# Commit
git add prisma/schema.prisma
git commit -m "feat: Add newField to User"
git push
```

**2. Sa VPS (Apply changes):**
```bash
# Pull latest code
git pull origin main

# Update test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
npm run db:generate
npm run db:push

# Verify
npm run db:studio  # Open Prisma Studio to check
```

---

## Troubleshooting

### Error: "Schema is out of sync"

**Solution:**
```bash
# Pull current database schema
npx prisma db pull

# Compare with schema.prisma
# Fix differences
# Then push again
npm run db:push
```

---

### Error: "Migration failed"

**Solution:**
```bash
# Option 1: Reset database (⚠️ DELETES ALL DATA)
npx prisma migrate reset

# Option 2: Use db:push instead (ignores migrations)
npm run db:push
```

---

### Error: "Can't reach database server"

**Check:**
1. Database server is running
2. DATABASE_URL is correct
3. Firewall allows connection
4. Network connectivity

**Test:**
```bash
# Test connection
psql -h vps-ip -U postgres -d test_db

# Or check DATABASE_URL
echo $DATABASE_URL
```

---

### Warning: "Data loss detected"

**Example:**
```
⚠️  Warnings:
  • You are about to change the column `age` on the `User` table. 
    There will be data loss if the column is not nullable.
```

**Options:**
1. **Type `y`** - Continue (data will be lost)
2. **Type `n`** - Cancel and fix schema first
3. **Migrate data manually** - Export data, update schema, import data

---

## Quick Reference Commands

```bash
# Generate Prisma Client (kailangan pag may changes)
npm run db:generate

# Push schema to database (test/dev)
npm run db:push

# Create migration (production)
npm run db:migrate

# Deploy migrations (production)
npx prisma migrate deploy

# Open database browser
npm run db:studio

# Pull database schema (reverse)
npx prisma db pull

# Reset database (⚠️ DELETES ALL DATA)
npx prisma migrate reset
```

---

## Best Practices

1. ✅ **Always test locally first** - Before applying to VPS
2. ✅ **Use db:push for test database** - Faster, simpler
3. ✅ **Use db:migrate for production** - Better version control
4. ✅ **Backup before major changes** - Especially in production
5. ✅ **Review warnings carefully** - Data loss warnings are important
6. ✅ **Commit schema changes** - So team can sync

---

## Example: Complete Update Process

```bash
# ============================================
# LOCAL: Make changes
# ============================================

# 1. Edit schema.prisma
# Added: newField String? to User model

# 2. Test locally
npm run db:generate
npm run db:push

# 3. Commit
git add prisma/schema.prisma
git commit -m "feat: Add newField to User"
git push

# ============================================
# VPS: Apply changes to test database
# ============================================

# 1. SSH to VPS
ssh user@vps-ip

# 2. Navigate
cd /var/www/aegira/backend

# 3. Pull latest code
git pull origin main

# 4. Set test database
export DATABASE_URL="postgresql://postgres:pass@localhost:5432/test_db"

# 5. Generate client
npm run db:generate

# 6. Push schema
npm run db:push

# 7. Verify (optional)
npm run db:studio
# Check if newField exists in User table

# Done! ✅
```

---

*Last Updated: 2024*

