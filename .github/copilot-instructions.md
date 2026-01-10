# Aegira Copilot Instructions

## Project: Aegira Attendance Management System

### Tech Stack
- Backend: Hono + Prisma + TypeScript
- Frontend: React + Zustand + React Query + Tailwind CSS
- Database: PostgreSQL (Supabase)
- Auth: Supabase Auth + JWT

### File Naming
- Backend modules: `backend/src/modules/{feature}/index.ts`
- Frontend pages: `frontend/src/pages/{role}/{feature}.page.tsx`
- Services: `frontend/src/services/{feature}.service.ts`
- Types: `{backend|frontend}/src/types/{name}.ts`

### API Response Format
```typescript
// Success with pagination
{ data: T[], pagination: { page, limit, total, totalPages } }

// Success single
{ data: T }

// Error
{ error: string, details?: object }
```

### Key Patterns
1. Always scope queries by `companyId` for non-admin users
2. Use Zod for validation before database operations
3. Use React Query for data fetching
4. Use Zustand for global state
5. Always validate UUID format with `isValidUUID()`

### Role Hierarchy
ADMIN > EXECUTIVE > SUPERVISOR > TEAM_LEAD > WORKER

### Important Imports
```typescript
// Backend
import { prisma } from '../config/prisma.js';
import { parsePagination } from '../utils/validator.js';
import type { AppContext } from '../types/context.js';

// Frontend
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
```

### Security Rules
- Never expose password hashes
- Always check user.role before sensitive operations
- Log sensitive actions to SystemLog
- Validate all user input
