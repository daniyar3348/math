-- Matematika+ — Supabase schema (production target).
-- The MVP currently runs on seed content (lib/content.ts) + localStorage state
-- (lib/store.tsx). This schema is the migration target for the chosen stack
-- (Next.js + Supabase). Apply via the Supabase SQL editor or `supabase db push`.

-- ————— Enums —————
create type school_id as enum ('bil', 'nish', 'ktl');
create type user_role as enum ('student', 'admin');

-- ————— Profiles (extends auth.users) —————
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  region text,
  grade int,
  role user_role not null default 'student',
  xp int not null default 0,
  created_at timestamptz not null default now()
);

-- ————— Content —————
create table courses (
  id text primary key,
  school school_id not null,
  title_kk text not null,
  title_ru text not null,
  description_kk text,
  description_ru text,
  level_kk text,
  level_ru text,
  price_kzt int not null default 0,   -- 0 = free
  cover text,
  sort int not null default 0
);

create table lessons (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  title_kk text not null,
  title_ru text not null,
  body_kk text,
  body_ru text,
  sort int not null default 0
);

create table challenges (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  title_kk text not null,
  title_ru text not null,
  description_kk text,
  description_ru text,
  xp int not null default 50,
  time_limit_sec int not null default 300
);

create table questions (
  id text primary key,
  challenge_id text not null references challenges(id) on delete cascade,
  prompt_kk text not null,
  prompt_ru text not null,
  correct_option_id text not null,
  explanation_kk text,
  explanation_ru text,
  sort int not null default 0
);

create table options (
  id text primary key,
  question_id text not null references questions(id) on delete cascade,
  text_kk text not null,
  text_ru text not null
);

-- ————— User activity —————
create table enrollments (          -- unlocked courses (free grant OR purchase)
  user_id uuid not null references profiles(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  source text not null default 'purchase',   -- 'free' | 'purchase'
  granted_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_id text not null references challenges(id) on delete cascade,
  score_pct int not null,
  xp_earned int not null,
  finished_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  amount_kzt int not null,
  status text not null default 'pending',   -- pending | paid | failed
  provider text not null default 'kaspi',
  provider_txn_id text,                      -- Kaspi transaction id
  created_at timestamptz not null default now()
);

-- ————— Row Level Security —————
alter table profiles enable row level security;
alter table enrollments enable row level security;
alter table attempts enable row level security;
alter table payments enable row level security;

-- Content tables are world-readable (catalog is public); writes via admin/service role.
alter table courses enable row level security;
alter table lessons enable row level security;
alter table challenges enable row level security;
alter table questions enable row level security;
alter table options enable row level security;

create policy "content is public" on courses for select using (true);
create policy "content is public" on lessons for select using (true);
create policy "content is public" on challenges for select using (true);
-- NOTE: hide questions/options behind enrollment for paid courses in a view/RPC.
create policy "content is public" on questions for select using (true);
create policy "content is public" on options for select using (true);

create policy "own profile" on profiles
  for select using (auth.uid() = id);
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

create policy "own enrollments" on enrollments
  for select using (auth.uid() = user_id);
create policy "own attempts" on attempts
  for all using (auth.uid() = user_id);
create policy "own payments" on payments
  for select using (auth.uid() = user_id);

-- Payments are written by the server (service role) on the Kaspi webhook, so no
-- client insert policy — the webhook route uses the service key and creates the
-- enrollment when status becomes 'paid'.
