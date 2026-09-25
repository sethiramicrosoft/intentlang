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

CREATE TABLE "gridregions" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "weatherState" TEXT DEFAULT 'clear',
  "status" TEXT DEFAULT 'normal',
  "restorationPercent" INTEGER DEFAULT 100
);

CREATE TABLE "substations" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "municipality" TEXT,
  "customersServed" INTEGER DEFAULT 0,
  "loadPercent" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'operational',
  "region_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("region_id") REFERENCES "gridregions"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "outages" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "incidentCode" TEXT NOT NULL CHECK(length("incidentCode") >= 2 AND length("incidentCode") <= 30),
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "cause" TEXT,
  "affectedCustomers" INTEGER DEFAULT 0,
  "priority" TEXT DEFAULT 'medium',
  "status" TEXT DEFAULT 'detected',
  "escalated" INTEGER DEFAULT 0 CHECK("escalated" IN (0, 1)),
  "region_id" TEXT NOT NULL,
  "substation_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("region_id") REFERENCES "gridregions"("id") ON DELETE CASCADE,
  FOREIGN KEY("substation_id") REFERENCES "substations"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "crews" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "callSign" TEXT NOT NULL CHECK(length("callSign") >= 2 AND length("callSign") <= 30),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "specialty" TEXT,
  "members" INTEGER DEFAULT 1,
  "status" TEXT DEFAULT 'available',
  "region_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("region_id") REFERENCES "gridregions"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "workorders" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "orderCode" TEXT NOT NULL CHECK(length("orderCode") >= 2 AND length("orderCode") <= 30),
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "location" TEXT,
  "priority" TEXT DEFAULT 'medium',
  "estimatedMinutes" INTEGER DEFAULT 60,
  "status" TEXT DEFAULT 'queued',
  "outage_id" TEXT NOT NULL,
  "crew_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("outage_id") REFERENCES "outages"("id") ON DELETE CASCADE,
  FOREIGN KEY("crew_id") REFERENCES "crews"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "safetypermits" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "permitCode" TEXT NOT NULL CHECK(length("permitCode") >= 2 AND length("permitCode") <= 30),
  "scope" TEXT NOT NULL CHECK(length("scope") >= 2 AND length("scope") <= 300),
  "hazardClass" TEXT DEFAULT 'electrical',
  "isolationPoint" TEXT,
  "status" TEXT DEFAULT 'draft',
  "workOrder_id" TEXT NOT NULL,
  "substation_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("workOrder_id") REFERENCES "workorders"("id") ON DELETE CASCADE,
  FOREIGN KEY("substation_id") REFERENCES "substations"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "customerimpacts" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "area" TEXT NOT NULL CHECK(length("area") >= 2 AND length("area") <= 160),
  "affectedCustomers" INTEGER DEFAULT 0,
  "criticalSites" INTEGER DEFAULT 0,
  "estimatedRestoreTime" TEXT,
  "status" TEXT DEFAULT 'open',
  "outage_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("outage_id") REFERENCES "outages"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "restorationplans" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "sequence" TEXT,
  "targetTime" TEXT,
  "progress" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'draft',
  "outage_id" TEXT NOT NULL,
  "crew_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("outage_id") REFERENCES "outages"("id") ON DELETE CASCADE,
  FOREIGN KEY("crew_id") REFERENCES "crews"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "decisions" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "context" TEXT,
  "recommendation" TEXT,
  "status" TEXT DEFAULT 'pending',
  "outage_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("outage_id") REFERENCES "outages"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "updates" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "headline" TEXT NOT NULL CHECK(length("headline") >= 2 AND length("headline") <= 200),
  "details" TEXT,
  "audience" TEXT DEFAULT 'operations',
  "severity" TEXT DEFAULT 'green',
  "status" TEXT DEFAULT 'draft',
  "region_id" TEXT NOT NULL,
  "outage_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("region_id") REFERENCES "gridregions"("id") ON DELETE CASCADE,
  FOREIGN KEY("outage_id") REFERENCES "outages"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- UNIQUE: user-email (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "user-email_unique" ON "users"("email");
-- UNIQUE: gridregion-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "gridregion-code_unique" ON "gridregions"("code");
-- UNIQUE: substation-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "substation-code_unique" ON "substations"("code");
-- UNIQUE: outage-incidentcode (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "outage-incidentcode_unique" ON "outages"("incidentCode");
-- UNIQUE: crew-callsign (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "crew-callsign_unique" ON "crews"("callSign");
-- UNIQUE: workorder-ordercode (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "workorder-ordercode_unique" ON "workorders"("orderCode");
-- UNIQUE: safetypermit-permitcode (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "safetypermit-permitcode_unique" ON "safetypermits"("permitCode");