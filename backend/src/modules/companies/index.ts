import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import { requireRole } from '../../middlewares/role.middleware.js';

const companiesRoutes = new Hono<AppContext>();

// GET /companies/my - Get current user's company
companiesRoutes.get('/my', async (c) => {
  const user = c.get('user');

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      industry: true,
      size: true,
      address: true,
      phone: true,
      website: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          users: true,
          teams: true,
        },
      },
    },
  });

  if (!company) {
    return c.json({ error: 'Company not found' }, 404);
  }

  return c.json(company);
});

// PATCH /companies/my - Update current user's company (EXECUTIVE only)
companiesRoutes.patch('/my', requireRole('EXECUTIVE'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  // Allowed fields to update (timezone can be changed by executive)
  const { name, logo, industry, size, address, phone, website, timezone } = body;

  const company = await prisma.company.update({
    where: { id: user.companyId },
    data: {
      ...(name && { name }),
      ...(logo !== undefined && { logo }),
      ...(industry !== undefined && { industry }),
      ...(size !== undefined && { size }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(website !== undefined && { website }),
      ...(timezone && { timezone }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      industry: true,
      size: true,
      address: true,
      phone: true,
      website: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json(company);
});

export { companiesRoutes };
