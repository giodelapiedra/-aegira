npm install hono @hono/node-server
npm install prisma @prisma/client
npm install dotenv
npm install @supabase/supabase-js jose
npm install zod
npm install busboy
npm install @aws-sdk/client-s3
npm install openai
npm install uuid dayjs
npm install pino pino-pretty



backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── server.ts              # entry (listen)
│   ├── app.ts                 # hono app
│
│   ├── config/
│   │   ├── env.ts             # dotenv init
│   │   ├── prisma.ts          # prisma client
│   │   ├── supabase.ts        # supabase client
│   │   └── r2.ts              # cloudflare r2 config
│
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   └── error.middleware.ts
│
│   ├── modules/               # FEATURE-BASED
│   │   ├── auth/
│   │   ├── users/
│   │   ├── teams/
│   │   ├── checkins/
│   │   ├── incidents/
│   │   ├── exceptions/
│   │   ├── schedules/
│   │   ├── rehabilitation/
│   │   ├── certificates/
│   │   ├── analytics/
│   │   └── notifications/
│
│   ├── utils/
│   │   ├── upload.ts          # R2 upload logic
│   │   ├── readiness.ts       # green/yellow/red logic
│   │   ├── validator.ts
│   │   └── ai.ts
│
│   ├── types/
│   │   ├── roles.ts
│   │   └── context.ts
│
│   └── routes.ts              # combine all module routes
│
├── package.json
├── tsconfig.json
└── .env


