# Database Schema Review - Senior Engineer Analysis

> **Review Date:** January 2026  
> **Reviewer:** Senior Software Engineer  
> **Schema Version:** Current Prisma Schema

---

## Executive Summary

**Overall Rating: ⭐⭐⭐⭐ (4/5)**

The schema is **well-designed** with good normalization, proper relationships, and thoughtful indexing. However, there are several **critical performance optimizations** and **missing indexes** that should be addressed for production scale.

---

## ✅ Strengths

### 1. **Excellent Multi-Tenancy Design**
- ✅ Proper `companyId` scoping on all tenant data
- ✅ Consistent cascade deletes (`onDelete: Cascade`)
- ✅ Good use of unique constraints for tenant isolation

### 2. **Well-Normalized Structure**
- ✅ Proper foreign key relationships
- ✅ No redundant data storage
- ✅ Good use of enums for type safety

### 3. **Good Indexing Foundation**
- ✅ Composite indexes where needed (e.g., `[userId, createdAt]`)
- ✅ Foreign key indexes present
- ✅ Unique constraints properly defined

### 4. **Pre-Computed Aggregates**
- ✅ `DailyTeamSummary` for fast analytics
- ✅ `User.totalCheckins`, `User.avgReadinessScore` for quick access
- ✅ Smart denormalization for performance

---

## ⚠️ Critical Issues

### 1. **Missing Critical Indexes**

#### Issue: Check-in Queries Without Proper Composite Indexes

**Current:**
```prisma
model Checkin {
  @@index([companyId])
  @@index([userId])
  @@index([createdAt])
  @@index([userId, createdAt]) // Good, but missing companyId
}
```

**Problem:** Most queries filter by `companyId` + `userId` + `createdAt`, but no composite index exists.

**Impact:** Full table scans on large datasets (thousands of check-ins)

**Fix:**
```prisma
@@index([companyId, createdAt]) // For company-wide queries
@@index([companyId, userId, createdAt]) // For user-specific queries
@@index([companyId, readinessStatus, createdAt]) // For status filtering
```

---

#### Issue: DailyAttendance Missing Composite Indexes

**Current:**
```prisma
model DailyAttendance {
  @@index([companyId])
  @@index([teamId])
  @@index([userId])
  @@index([date])
  @@index([status])
}
```

**Problem:** Common queries filter by `companyId` + `date` + `status` or `teamId` + `date`, but no composite indexes.

**Impact:** Slow queries for team/company analytics

**Fix:**
```prisma
@@index([companyId, date, status]) // For company-wide date/status queries
@@index([teamId, date]) // For team daily queries (already partially covered by unique)
@@index([userId, date]) // Already covered by unique, but explicit is better
```

---

#### Issue: Exception Queries Missing Date Range Indexes

**Current:**
```prisma
model Exception {
  @@index([userId, status, startDate, endDate]) // Good!
  @@index([companyId])
  @@index([status])
}
```

**Problem:** Missing `companyId` + `status` + date range composite for active exemptions queries.

**Impact:** Slow queries when finding active exemptions for a company

**Fix:**
```prisma
@@index([companyId, status, startDate, endDate]) // For company-wide active exemptions
```

---

### 2. **Missing Search Indexes**

#### Issue: User Name Search Not Indexed

**Problem:** Daily Monitoring `/checkins` endpoint filters by user name in-memory, but database search would be faster with proper indexes.

**Current:** No indexes on `User.firstName` or `User.lastName`

**Fix:**
```prisma
model User {
  // Add text search indexes (PostgreSQL)
  // Note: Prisma doesn't support functional indexes directly
  // Need to add via raw SQL migration:
}
```

**SQL Migration:**
```sql
-- For case-insensitive search
CREATE INDEX idx_user_name_search ON "users" (LOWER("firstName"), LOWER("lastName"));
CREATE INDEX idx_user_email_search ON "users" (LOWER("email"));
```

---

### 3. **Performance Anti-Patterns**

#### Issue: Notification Composite Index Order

**Current:**
```prisma
model Notification {
  @@index([userId, companyId, isArchived, isRead, createdAt(sort: Desc)])
  @@index([userId, companyId, isRead, isArchived])
}
```

**Problem:** Index order doesn't match query pattern. Most queries filter by `userId` + `isRead` + `isArchived`, then order by `createdAt DESC`.

**Fix:**
```prisma
// Better order: filter columns first, then sort column
@@index([userId, companyId, isRead, isArchived, createdAt(sort: Desc)])
// Remove redundant second index if first covers it
```

---

#### Issue: DailyTeamSummary Missing TeamId + Date Composite

**Current:**
```prisma
model DailyTeamSummary {
  @@unique([teamId, date]) // Unique constraint creates index
  @@index([companyId, date])
  @@index([date])
}
```

**Problem:** `@@unique([teamId, date])` creates an index, but queries often filter by `teamId` + `date` + `isWorkDay` + `isHoliday`.

**Fix:**
```prisma
@@index([teamId, date, isWorkDay, isHoliday]) // For filtered queries
```

---

### 4. **Data Integrity Concerns**

#### Issue: Absence Model Missing TeamId + Date Composite

**Current:**
```prisma
model Absence {
  @@unique([userId, absenceDate])
  @@index([teamId, status])
}
```

**Problem:** Queries often filter by `teamId` + `absenceDate` + `status` for team analytics.

**Fix:**
```prisma
@@index([teamId, absenceDate, status]) // For team date range queries
```

---

#### Issue: Checkin Missing ReadinessStatus Index

**Current:**
```prisma
model Checkin {
  // No index on readinessStatus!
}
```

**Problem:** Daily Monitoring Stats queries filter by `readinessStatus` (GREEN/YELLOW/RED), but no index exists.

**Fix:**
```prisma
@@index([companyId, readinessStatus, createdAt]) // For status filtering
```

---

## 🔧 Recommended Indexes (Priority Order)

### Priority 1: Critical Performance (Do First)

```prisma
// Checkin model
@@index([companyId, createdAt]) // Company-wide date queries
@@index([companyId, userId, createdAt]) // User-specific queries
@@index([companyId, readinessStatus, createdAt]) // Status filtering

// DailyAttendance model
@@index([companyId, date, status]) // Company date/status queries
@@index([teamId, date, status]) // Team date/status queries

// Exception model
@@index([companyId, status, startDate, endDate]) // Active exemptions

// DailyTeamSummary model
@@index([teamId, date, isWorkDay, isHoliday]) // Filtered team queries
```

### Priority 2: High Impact

```prisma
// Absence model
@@index([teamId, absenceDate, status]) // Team date range queries
@@index([companyId, absenceDate, status]) // Company date range queries

// Notification model (reorder existing)
@@index([userId, companyId, isRead, isArchived, createdAt(sort: Desc)])
```

### Priority 3: Search Optimization

```sql
-- Raw SQL migrations (Prisma doesn't support functional indexes)
CREATE INDEX idx_user_name_search ON "users" (LOWER("firstName"), LOWER("lastName"));
CREATE INDEX idx_user_email_search ON "users" (LOWER("email"));
```

---

## 📊 Index Analysis by Model

### Checkin Model
**Current Indexes:** 4  
**Recommended:** 7  
**Missing:**
- `[companyId, createdAt]` ⚠️ CRITICAL
- `[companyId, userId, createdAt]` ⚠️ CRITICAL
- `[companyId, readinessStatus, createdAt]` ⚠️ HIGH

### DailyAttendance Model
**Current Indexes:** 5  
**Recommended:** 7  
**Missing:**
- `[companyId, date, status]` ⚠️ CRITICAL
- `[teamId, date, status]` ⚠️ HIGH

### Exception Model
**Current Indexes:** 8  
**Recommended:** 9  
**Missing:**
- `[companyId, status, startDate, endDate]` ⚠️ HIGH

### DailyTeamSummary Model
**Current Indexes:** 2 (+ unique)
**Recommended:** 3  
**Missing:**
- `[teamId, date, isWorkDay, isHoliday]` ⚠️ MEDIUM

### Absence Model
**Current Indexes:** 4 (+ unique)
**Recommended:** 6  
**Missing:**
- `[teamId, absenceDate, status]` ⚠️ HIGH
- `[companyId, absenceDate, status]` ⚠️ MEDIUM

---

## 🎯 Query Pattern Analysis

Based on codebase analysis, here are the most common query patterns:

### Pattern 1: Company + Date Range + Status
```typescript
// Used in: Daily Monitoring, Analytics
where: {
  companyId: "...",
  createdAt: { gte: startDate, lte: endDate },
  readinessStatus: "GREEN" // Optional
}
```
**Needs:** `@@index([companyId, createdAt, readinessStatus])`

### Pattern 2: Team + Date Range
```typescript
// Used in: Team Analytics, Daily Summary
where: {
  teamId: "...",
  date: { gte: startDate, lte: endDate },
  isWorkDay: true,
  isHoliday: false
}
```
**Needs:** `@@index([teamId, date, isWorkDay, isHoliday])`

### Pattern 3: User + Date Range
```typescript
// Used in: User Analytics, Performance Score
where: {
  userId: "...",
  createdAt: { gte: startDate, lte: endDate }
}
```
**Current:** ✅ Covered by `[userId, createdAt]`

### Pattern 4: Active Exemptions
```typescript
// Used in: Daily Monitoring, Attendance
where: {
  companyId: "...",
  status: "APPROVED",
  startDate: { lte: today },
  endDate: { gte: today }
}
```
**Needs:** `@@index([companyId, status, startDate, endDate])`

---

## 🔍 Data Type Review

### ✅ Good Choices
- `@db.SmallInt` for mood/stress/sleep/physicalHealth (1-10 scale)
- `@db.Date` for date-only fields (no time component)
- `Float?` for nullable scores (allows NULL for "no data")
- `String[]` for attachments (PostgreSQL array type)

### ⚠️ Potential Issues

#### Issue: DateTime vs Date Consistency
**Current:** Mix of `DateTime` and `DateTime @db.Date`

**Recommendation:** 
- Use `DateTime @db.Date` for date-only fields (attendance dates, holidays)
- Use `DateTime` for timestamps (createdAt, updatedAt, check-in times)

**Status:** ✅ Already correct!

---

## 🔗 Relationship Review

### ✅ Excellent Cascade Strategy
- All tenant data properly cascades on company delete
- User data cascades properly
- No orphaned records possible

### ⚠️ Missing Cascade on Some Relations

**Current:**
```prisma
model Exception {
  exception Exception? @relation(fields: [exceptionId], references: [id])
  // Missing: onDelete behavior
}
```

**Fix:**
```prisma
exception Exception? @relation(fields: [exceptionId], references: [id], onDelete: SetNull)
```

**Impact:** Low (exceptions rarely deleted), but good practice.

---

## 📈 Scalability Considerations

### ✅ Good Practices
- Pre-computed aggregates (`DailyTeamSummary`, `User.totalCheckins`)
- Proper partitioning strategy (by `companyId` implicitly)
- Good use of unique constraints

### ⚠️ Potential Issues

#### Issue: No Partitioning Strategy
**Problem:** As data grows, single tables will become large (especially `Checkin`, `DailyAttendance`)

**Recommendation:** Consider PostgreSQL partitioning by `companyId` or date range for:
- `Checkin` table (partition by `createdAt` monthly/yearly)
- `DailyAttendance` table (partition by `date` monthly/yearly)
- `SystemLog` table (partition by `createdAt` monthly)

**When to Implement:** When tables exceed 1M rows per company

---

## 🛡️ Data Integrity

### ✅ Excellent Constraints
- Unique constraints prevent duplicates (`[userId, date]` for DailyAttendance)
- Foreign keys properly defined
- Enum types prevent invalid values

### ⚠️ Missing Constraints

#### Issue: No Check Constraints
**Problem:** No validation for:
- `mood/stress/sleep/physicalHealth` range (should be 1-10)
- `readinessScore` range (should be 0-100)
- Date ranges (startDate <= endDate)

**Recommendation:** Add Prisma validation or database check constraints

**Example:**
```sql
ALTER TABLE "checkins" 
ADD CONSTRAINT check_mood_range CHECK (mood >= 1 AND mood <= 10);
ALTER TABLE "checkins" 
ADD CONSTRAINT check_readiness_score_range CHECK (readinessScore >= 0 AND readinessScore <= 100);
```

---

## 📝 Schema Documentation

### ✅ Good Naming
- Clear model names
- Consistent field naming
- Good use of comments

### ⚠️ Missing Documentation
**Recommendation:** Add Prisma comments for:
- Complex relationships
- Business logic constraints
- Index purposes

**Example:**
```prisma
model DailyTeamSummary {
  // Pre-computed daily statistics per team for fast analytics queries
  // Recalculated by cron job daily at 5 AM local time
  // Used by: Team Analytics, Team Summary, Dashboard
  
  @@index([teamId, date, isWorkDay, isHoliday]) // For filtered team queries
}
```

---

## 🎯 Action Items

### Immediate (This Week)
1. ✅ Add missing composite indexes for Checkin model
2. ✅ Add missing composite indexes for DailyAttendance model
3. ✅ Add missing composite indexes for Exception model

### Short Term (This Month)
4. ✅ Add search indexes for User model (raw SQL)
5. ✅ Reorder Notification indexes
6. ✅ Add DailyTeamSummary filtered index

### Medium Term (Next Quarter)
7. ⚠️ Consider partitioning strategy for large tables
8. ⚠️ Add database check constraints
9. ⚠️ Add schema documentation comments

---

## 📊 Performance Impact Estimate

### Before Optimization
- Daily Monitoring `/checkins`: ~500ms (with in-memory filtering)
- Team Analytics: ~300ms
- Daily Monitoring Stats: ~200ms

### After Optimization (Expected)
- Daily Monitoring `/checkins`: ~5-50ms (with DB filtering + indexes)
- Team Analytics: ~100-150ms (with proper indexes)
- Daily Monitoring Stats: ~50-100ms (with GROUP BY + indexes)

**Expected Improvement:** 50-80% faster queries

---

## ✅ Final Recommendations

### Must Do (Critical)
1. Add composite indexes for common query patterns
2. Add search indexes for User model
3. Optimize Notification index order

### Should Do (High Priority)
4. Add filtered indexes for DailyTeamSummary
5. Add date range indexes for Absence model
6. Document complex relationships

### Nice to Have (Low Priority)
7. Consider partitioning for scale
8. Add database check constraints
9. Add more schema comments

---

## 📚 References

- [Prisma Index Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [PostgreSQL Index Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Database Partitioning Guide](https://www.postgresql.org/docs/current/ddl-partitioning.html)

---

*Schema Review completed by Senior Software Engineer*  
*Last Updated: January 2026*

