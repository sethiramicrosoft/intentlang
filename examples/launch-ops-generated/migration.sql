PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 120),
  "email" TEXT NOT NULL CHECK(length("email") >= 3 AND length("email") <= 320)
);

CREATE TABLE "programs" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "summary" TEXT,
  "status" TEXT DEFAULT 'planning',
  "healthScore" INTEGER DEFAULT 100
);

CREATE TABLE "milestones" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 160),
  "targetDate" TEXT,
  "status" TEXT DEFAULT 'planned',
  "progress" INTEGER DEFAULT 0,
  "program_id" TEXT NOT NULL,
  FOREIGN KEY("program_id") REFERENCES "programs"("id") ON DELETE CASCADE
);

CREATE TABLE "workitems" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "details" TEXT,
  "status" TEXT DEFAULT 'open',
  "priority" TEXT DEFAULT 'medium',
  "estimate" INTEGER DEFAULT 1,
  "done" INTEGER DEFAULT 0 CHECK("done" IN (0, 1)),
  "program_id" TEXT NOT NULL,
  "milestone_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("program_id") REFERENCES "programs"("id") ON DELETE CASCADE,
  FOREIGN KEY("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "risks" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "impact" TEXT DEFAULT 'medium',
  "probability" TEXT DEFAULT 'medium',
  "mitigation" TEXT,
  "status" TEXT DEFAULT 'open',
  "escalated" INTEGER DEFAULT 0 CHECK("escalated" IN (0, 1)),
  "program_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("program_id") REFERENCES "programs"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "decisions" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "context" TEXT,
  "outcome" TEXT,
  "status" TEXT DEFAULT 'pending',
  "program_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("program_id") REFERENCES "programs"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "updates" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "headline" TEXT NOT NULL CHECK(length("headline") >= 2 AND length("headline") <= 200),
  "details" TEXT,
  "health" TEXT DEFAULT 'green',
  "status" TEXT DEFAULT 'draft',
  "program_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("program_id") REFERENCES "programs"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- UNIQUE: user-email (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "user-email_unique" ON "users"("email");
-- UNIQUE: program-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "program-code_unique" ON "programs"("code");