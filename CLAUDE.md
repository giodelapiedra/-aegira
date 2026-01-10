# Aegira Coding Rules & Patterns

## Quick Reference

```
Backend: Hono + Prisma + TypeScript
Frontend: React + Zustand + React Query + Tailwind
Database: PostgreSQL (via Supabase)
Auth: Supabase Auth + JWT
AI: OpenAI GPT-4
```

---

## 1. File Naming Conventions

### Backend
```
src/modules/{feature}/index.ts     # Module routes & logic
src/utils/{name}.ts                # Utility functions
src/middlewares/{name}.middleware.ts
src/types/{name}.ts
src/config/{name}.ts
```

### Frontend
```
src/pages/{role}/{feature}.page.tsx       # Page components
src/components/{category}/{Name}.tsx      # Reusable components
src/components/ui/{Name}.tsx              # Base UI components
src/services/{feature}.service.ts         # API services
src/store/{name}.store.ts                 # Zustand stores
src/types/{name}.ts                       # Type definitions
src/hooks/use{Name}.ts                    # Custom hooks
src/lib/{name}.ts                         # Utilities
```

### Naming Style
- Files: `kebab-case` (e.g., `date-helpers.ts`, `checkin.page.tsx`)
- Components: `PascalCase` (e.g., `Button.tsx`, `DataTable.tsx`)
- Functions/Variables: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

---

## 2. Backend API Patterns

### Module Structure
```typescript
// backend/src/modules/{feature}/index.ts
import { Hono } from 'hono';
import type { AppContext } from '../../types/context.js';
import { prisma } from '../../config/prisma.js';
import { parsePagination, isValidUUID } from '../../utils/validator.js';

const featureRoutes = new Hono<AppContext>();

// GET list with pagination
featureRoutes.get('/', async (c) => {
  const { page, limit, skip } = parsePagination(c);
  const companyId = c.get('companyId');
  const user = c.get('user');

  // Company scoping (non-admin)
  const where: any = {};
  if (user.role !== 'ADMIN') {
    where.companyId = companyId;
  }

  const [data, total] = await Promise.all([
    prisma.model.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        // ... specify fields explicitly
      }
    }),
    prisma.model.count({ where })
  ]);

  return c.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

// GET single by ID
featureRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();

  if (!isValidUUID(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const item = await prisma.model.findUnique({
    where: { id },
    include: { /* relations */ }
  });

  if (!item) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(item);
});

// POST create
featureRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Validate with Zod
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const item = await prisma.model.create({
    data: {
      ...parsed.data,
      companyId,
      createdBy: userId,
    }
  });

  return c.json(item, 201);
});

// PUT/PATCH update
featureRoutes.put('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const item = await prisma.model.update({
    where: { id },
    data: body
  });

  return c.json(item);
});

// DELETE
featureRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  await prisma.model.delete({ where: { id } });

  return c.json({ success: true });
});

export { featureRoutes };
```

### Route Registration
```typescript
// backend/src/routes.ts
import { featureRoutes } from './modules/{feature}/index.js';

// Add route
api.route('/{feature}', featureRoutes);
```

### Response Patterns
```typescript
// Success
return c.json(data, 200);                    // OK
return c.json(data, 201);                    // Created
return c.json({ success: true }, 200);       // Action success

// Errors
return c.json({ error: 'message' }, 400);    // Bad request
return c.json({ error: 'Unauthorized' }, 401);
return c.json({ error: 'Forbidden' }, 403);
return c.json({ error: 'Not found' }, 404);
return c.json({ error: 'Internal error' }, 500);

// Paginated
return c.json({
  data: items,
  pagination: { page, limit, total, totalPages }
});
```

### Role-Based Access
```typescript
// Check role in route
const user = c.get('user');
const allowedRoles = ['ADMIN', 'EXECUTIVE', 'SUPERVISOR'];

if (!allowedRoles.includes(user.role)) {
  return c.json({ error: 'Insufficient permissions' }, 403);
}

// Role hierarchy (highest to lowest)
// ADMIN > EXECUTIVE > SUPERVISOR > TEAM_LEAD > WORKER
```

---

## 3. Database Patterns (Prisma)

### Model Template
```prisma
model FeatureName {
  id          String   @id @default(uuid())

  // Core fields
  name        String
  status      Status   @default(PENDING)

  // Multi-tenancy
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Audit fields
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  user        User     @relation(fields: [createdBy], references: [id])

  // Indexes for common queries
  @@index([companyId])
  @@index([status])
  @@index([createdAt])
}
```

### Enum Pattern
```prisma
enum FeatureStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

### Query Patterns
```typescript
// Always select specific fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    // DON'T include sensitive fields like passwordHash
  }
});

// Use transactions for multiple operations
const result = await prisma.$transaction(async (tx) => {
  const item = await tx.model.create({ data });
  await tx.log.create({ data: { action: 'CREATE', modelId: item.id } });
  return item;
});

// Soft delete pattern (if needed)
await prisma.model.update({
  where: { id },
  data: { deletedAt: new Date(), isActive: false }
});
```

---

## 4. Frontend Patterns

### Page Component Template
```tsx
// src/pages/{role}/{feature}.page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { featureService } from '@/services/feature.service';
import type { Feature } from '@/types/feature';

export function FeaturePage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['features'],
    queryFn: () => featureService.getAll(),
  });

  // Mutation
  const createMutation = useMutation({
    mutationFn: featureService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading data</div>;
  if (!data?.length) return <EmptyState message="No items found" />;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Feature Title</h1>
        <Button onClick={() => setSelectedId('new')}>Add New</Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Content here */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Service Template
```typescript
// src/services/{feature}.service.ts
import api from './api';
import type { Feature, CreateFeatureData } from '@/types/feature';

export const featureService = {
  async getAll(params?: { page?: number; limit?: number }) {
    const response = await api.get('/features', { params });
    return response.data;
  },

  async getById(id: string): Promise<Feature> {
    const response = await api.get(`/features/${id}`);
    return response.data;
  },

  async create(data: CreateFeatureData): Promise<Feature> {
    const response = await api.post('/features', data);
    return response.data;
  },

  async update(id: string, data: Partial<Feature>): Promise<Feature> {
    const response = await api.put(`/features/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/features/${id}`);
  },
};
```

### Type Definitions Template
```typescript
// src/types/{feature}.ts
export interface Feature {
  id: string;
  name: string;
  status: FeatureStatus;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type FeatureStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateFeatureData {
  name: string;
  // ... required fields only
}

export interface UpdateFeatureData extends Partial<CreateFeatureData> {
  status?: FeatureStatus;
}
```

### React Query Keys Convention
```typescript
// Consistent query key patterns
['features']                      // List all
['features', id]                  // Single item
['features', 'my']                // User's items
['features', { status: 'active' }] // Filtered list
['features', 'stats']             // Aggregated data
```

---

## 5. UI Component Patterns

### Button Variants
```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
<Button variant="success">Approve</Button>
<Button variant="ghost">View Details</Button>

<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

<Button isLoading>Processing...</Button>
<Button disabled>Disabled</Button>
```

### Card Composition
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Status Badge Colors
```tsx
// Use Badge component with appropriate variant
<Badge variant="success">Approved</Badge>   // Green
<Badge variant="warning">Pending</Badge>    // Yellow
<Badge variant="danger">Rejected</Badge>    // Red
<Badge variant="default">Draft</Badge>      // Gray
```

### Tailwind Class Patterns
```tsx
// Container
className="container mx-auto py-8"

// Flex layouts
className="flex items-center justify-between"
className="flex flex-col gap-4"

// Grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"

// Spacing
className="space-y-4"  // Vertical spacing
className="space-x-2"  // Horizontal spacing

// Text
className="text-sm text-gray-500"
className="text-lg font-semibold"
className="text-2xl font-bold"

// Interactive states
className="hover:bg-gray-100 transition-colors"
className="focus:ring-2 focus:ring-primary-500"
```

---

## 6. Date & Timezone Patterns

### Always Use Company Timezone
```typescript
// Backend - import helpers
import { getTodayRange, formatLocalDate, DEFAULT_TIMEZONE } from '../utils/date-helpers.js';

// Get company timezone (default: Asia/Manila)
const timezone = company?.timezone || DEFAULT_TIMEZONE;

// Get today's date range in company timezone
const { start, end } = getTodayRange(timezone);

// Query by date
const records = await prisma.checkin.findMany({
  where: {
    createdAt: { gte: start, lt: end }
  }
});
```

### Frontend Date Display
```typescript
import { formatDisplayDate, formatDisplayTime } from '@/lib/date-utils';

// Display: "Jan 15, 2024"
formatDisplayDate(record.createdAt);

// Display: "2:30 PM"
formatDisplayTime(record.createdAt);
```

---

## 7. Validation Patterns

### Backend Zod Schemas
```typescript
// backend/src/utils/validator.ts
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

// Usage in route
const parsed = createFeatureSchema.safeParse(body);
if (!parsed.success) {
  return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
}
```

### Common Validators
```typescript
// UUID validation
export function isValidUUID(value: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(value);
}

// Pagination parsing
export function parsePagination(c: Context) {
  let page = parseInt(c.req.query('page') || '1', 10);
  let limit = parseInt(c.req.query('limit') || '20', 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Security cap

  return { page, limit, skip: (page - 1) * limit };
}
```

---

## 8. Security Rules

### Authentication
- Always use JWT Bearer token in Authorization header
- Refresh tokens stored in httpOnly cookies
- Token blacklisting on logout
- Never expose password hashes

### Authorization
- Always check `user.role` before sensitive operations
- Always scope queries by `companyId` for non-admin users
- Team leads can only see their team's data
- Log sensitive actions to SystemLog

### Input Validation
- Always validate with Zod before database operations
- Sanitize user input (no raw SQL, escape HTML)
- Limit pagination to max 100 items
- Validate UUID format before database queries

### Data Exposure
- Use `select` to specify returned fields
- Never return sensitive fields (passwords, tokens)
- Check ownership before returning private data

---

## 9. Error Handling

### Backend
```typescript
try {
  // operation
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return c.json({ error: 'Record already exists' }, 409);
    }
    if (error.code === 'P2025') {
      return c.json({ error: 'Record not found' }, 404);
    }
  }
  console.error('Unexpected error:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
```

### Frontend
```typescript
// In React Query
const { error } = useQuery({
  queryKey: ['features'],
  queryFn: featureService.getAll,
  retry: 1, // Retry once on failure
});

// In mutation
const mutation = useMutation({
  mutationFn: featureService.create,
  onError: (error) => {
    const message = error.response?.data?.error || 'Something went wrong';
    toast.error(message);
  },
});
```

---

## 10. Logging & Audit

### System Log Pattern
```typescript
// Log important actions
await prisma.systemLog.create({
  data: {
    userId,
    companyId,
    action: 'CREATE_EXCEPTION',
    details: {
      exceptionId: exception.id,
      type: exception.type,
    },
    ipAddress: c.req.header('x-forwarded-for') || 'unknown',
  }
});
```

### Console Logging
```typescript
import { logger } from '../utils/logger.js';

logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ error, userId }, 'Failed to process request');
logger.warn({ userId }, 'Suspicious activity detected');
```

---

## 11. Router Configuration

### Add New Route (Frontend)
```typescript
// frontend/src/app/router.tsx

// 1. Import the page
import { FeaturePage } from '@/pages/{role}/feature.page';

// 2. Add to role's routes
{
  path: 'feature',
  element: <FeaturePage />,
},
```

### Add Navigation Item
```typescript
// frontend/src/config/navigation.ts
export const navigationItems = {
  worker: [
    { label: 'Feature', path: '/worker/feature', icon: IconComponent },
  ],
  // ... other roles
};
```

---

## 12. Testing Checklist

Before committing:
- [ ] API returns correct status codes
- [ ] Pagination works correctly
- [ ] Role-based access enforced
- [ ] Company scoping applied
- [ ] Zod validation in place
- [ ] Error handling complete
- [ ] No sensitive data exposed
- [ ] Frontend loading states handled
- [ ] Empty states handled
- [ ] TypeScript compiles without errors

---

## 13. Git Commit Messages

```
feat: Add {feature} for {role}
fix: Resolve {issue} in {component}
refactor: Improve {component} structure
chore: Update dependencies
docs: Add documentation for {feature}
style: Format {file}
```

---

## Quick Commands

```bash
# Backend
cd backend
npm run dev          # Start dev server
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio

# Frontend
cd frontend
npm run dev          # Start dev server
npm run build        # Build for production
```

---

## Common Import Paths

```typescript
// Backend
import { prisma } from '../config/prisma.js';
import { parsePagination, isValidUUID } from '../utils/validator.js';
import { getTodayRange } from '../utils/date-helpers.js';
import type { AppContext } from '../types/context.js';

// Frontend
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/store/auth.store';
import api from '@/services/api';
```
