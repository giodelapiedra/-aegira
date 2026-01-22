create table public.daily_team_summaries (
  id text not null,
  "teamId" text not null,
  "companyId" text not null,
  date date not null,
  "isWorkDay" boolean not null,
  "isHoliday" boolean not null,
  "totalMembers" integer not null,
  "onLeaveCount" integer not null,
  "expectedToCheckIn" integer not null,
  "checkedInCount" integer not null default 0,
  "notCheckedInCount" integer not null default 0,
  "greenCount" integer not null default 0,
  "yellowCount" integer not null default 0,
  "redCount" integer not null default 0,
  "absentCount" integer not null default 0,
  "excusedCount" integer not null default 0,
  "avgReadinessScore" double precision null,
  "complianceRate" double precision null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone not null,
  "avgMood" double precision null,
  "avgPhysical" double precision null,
  "avgSleep" double precision null,
  "avgStress" double precision null,
  constraint daily_team_summaries_pkey primary key (id),
  constraint daily_team_summaries_companyId_fkey foreign KEY ("companyId") references companies (id) on update CASCADE on delete CASCADE,
  constraint daily_team_summaries_teamId_fkey foreign KEY ("teamId") references teams (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "daily_team_summaries_companyId_date_idx" on public.daily_team_summaries using btree ("companyId", date) TABLESPACE pg_default;

create index IF not exists daily_team_summaries_date_idx on public.daily_team_summaries using btree (date) TABLESPACE pg_default;

create index IF not exists "daily_team_summaries_companyId_date_isWorkDay_isHoliday_idx" on public.daily_team_summaries using btree ("companyId", date, "isWorkDay", "isHoliday") TABLESPACE pg_default;

create unique INDEX IF not exists "daily_team_summaries_teamId_date_key" on public.daily_team_summaries using btree ("teamId", date) TABLESPACE pg_default;



 DAILY ATTENDANCE 

 create table public.daily_attendance (
  id text not null,
  "userId" text not null,
  "companyId" text not null,
  "teamId" text not null,
  date date not null,
  "scheduledStart" text not null,
  "checkInTime" timestamp without time zone null,
  status public.AttendanceStatus not null,
  score integer null,
  "isCounted" boolean not null default true,
  "exceptionId" text null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone not null,
  constraint daily_attendance_pkey primary key (id),
  constraint daily_attendance_companyId_fkey foreign KEY ("companyId") references companies (id) on update CASCADE on delete CASCADE,
  constraint daily_attendance_exceptionId_fkey foreign KEY ("exceptionId") references exceptions (id) on update CASCADE on delete set null,
  constraint daily_attendance_teamId_fkey foreign KEY ("teamId") references teams (id) on update CASCADE on delete CASCADE,
  constraint daily_attendance_userId_fkey foreign KEY ("userId") references users (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "daily_attendance_companyId_idx" on public.daily_attendance using btree ("companyId") TABLESPACE pg_default;

create index IF not exists "daily_attendance_teamId_idx" on public.daily_attendance using btree ("teamId") TABLESPACE pg_default;

create index IF not exists "daily_attendance_userId_idx" on public.daily_attendance using btree ("userId") TABLESPACE pg_default;

create index IF not exists daily_attendance_date_idx on public.daily_attendance using btree (date) TABLESPACE pg_default;

create index IF not exists daily_attendance_status_idx on public.daily_attendance using btree (status) TABLESPACE pg_default;

create unique INDEX IF not exists "daily_attendance_userId_date_key" on public.daily_attendance using btree ("userId", date) TABLESPACE pg_default;



CHECKIN IN

create table public.checkins (
  id text not null,
  "userId" text not null,
  "companyId" text not null,
  mood smallint not null,
  stress smallint not null,
  sleep smallint not null,
  "physicalHealth" smallint not null,
  notes text null,
  "readinessStatus" public.ReadinessStatus not null,
  "readinessScore" double precision not null,
  "aiAnalysis" jsonb null,
  "createdAt" timestamp without time zone not null default CURRENT_TIMESTAMP,
  "lowScoreReason" public.LowScoreReason null,
  "lowScoreDetails" text null,
  constraint checkins_pkey primary key (id),
  constraint checkins_companyId_fkey foreign KEY ("companyId") references companies (id) on update CASCADE on delete CASCADE,
  constraint checkins_userId_fkey foreign KEY ("userId") references users (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists "checkins_companyId_idx" on public.checkins using btree ("companyId") TABLESPACE pg_default;

create index IF not exists "checkins_userId_idx" on public.checkins using btree ("userId") TABLESPACE pg_default;

create index IF not exists "checkins_createdAt_idx" on public.checkins using btree ("createdAt") TABLESPACE pg_default;

create index IF not exists "checkins_userId_createdAt_idx" on public.checkins using btree ("userId", "createdAt") TABLESPACE pg_default;

create index IF not exists "checkins_companyId_createdAt_idx" on public.checkins using btree ("companyId", "createdAt") TABLESPACE pg_default;