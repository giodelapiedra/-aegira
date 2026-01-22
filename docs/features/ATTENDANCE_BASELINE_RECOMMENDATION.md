# Attendance Baseline Recommendation

## Current Implementation
Currently uses `teamJoinedAt` (or `createdAt` as fallback) to determine when attendance tracking starts.

**Problem**: If a worker joins a team but doesn't check in immediately, days between `teamJoinedAt` and first check-in are counted as ABSENT, which is unfair.

## Options Analysis

### Option 1: Team Creation Date ❌
- **Pros**: Consistent baseline for all team members
- **Cons**: Very unfair - workers who join later will have many "absent" days before they even started

### Option 2: First Check-in Date ✅ **RECOMMENDED**
- **Pros**: 
  - Most fair - only counts from when worker actually starts working
  - Accurate representation of actual work start
  - Prevents false "absent" marks
- **Cons**: 
  - Requires one additional query to get first check-in date
  - Slight performance overhead (but minimal with proper indexing)

### Option 3: teamJoinedAt (Current) ⚠️
- **Pros**: Already implemented, represents when worker was assigned
- **Cons**: If worker doesn't check in immediately, days are marked absent unfairly

## Recommended Implementation

Use **First Check-in Date** as the baseline. Here's the suggested code change:

```typescript
// In calculatePerformanceScore function
export async function calculatePerformanceScore(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceScore> {
  // ... existing code ...

  // Get first check-in date (most fair baseline)
  const firstCheckin = await prisma.checkin.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  // Determine effective start date using priority:
  // 1. First check-in date (most accurate)
  // 2. teamJoinedAt (fallback if no check-ins yet)
  // 3. createdAt (last resort)
  let effectiveStartDate: Date;
  
  if (firstCheckin) {
    const firstCheckinDate = new Date(firstCheckin.createdAt);
    firstCheckinDate.setHours(0, 0, 0, 0);
    effectiveStartDate = startDate < firstCheckinDate ? firstCheckinDate : startDate;
  } else if (user.teamJoinedAt) {
    const teamJoinedDate = new Date(user.teamJoinedAt);
    teamJoinedDate.setHours(0, 0, 0, 0);
    effectiveStartDate = startDate < teamJoinedDate ? teamJoinedDate : startDate;
  } else {
    const createdDate = new Date(user.createdAt);
    createdDate.setHours(0, 0, 0, 0);
    effectiveStartDate = startDate < createdDate ? createdDate : startDate;
  }

  // ... rest of the function ...
}
```

## Benefits of First Check-in Approach

1. **Fairness**: Workers only get attendance scores from when they actually start working
2. **Accuracy**: No false "absent" marks for days before first check-in
3. **User Experience**: Workers see accurate attendance scores from day 1
4. **Compliance**: Better reflects actual work performance

## Performance Consideration

The additional query for first check-in is minimal:
- Only runs once per calculation
- Can be cached if needed
- Indexed on `userId` and `createdAt` (already exists)

## Migration Notes

For existing users:
- First check-in date will be calculated on-the-fly
- Historical data remains accurate
- No data migration needed

## Alternative: Hybrid Approach

If performance is a concern, you could use a hybrid:
- **New workers**: Use first check-in date
- **Existing workers**: Use teamJoinedAt (already have history)

But the pure "first check-in" approach is recommended for consistency and fairness.




