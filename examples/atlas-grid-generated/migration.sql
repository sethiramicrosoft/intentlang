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

CREATE TABLE "networks" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "region" TEXT,
  "status" TEXT DEFAULT 'monitoring',
  "resilienceScore" INTEGER DEFAULT 100
);

CREATE TABLE "facilitys" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "country" TEXT,
  "capacityPercent" INTEGER DEFAULT 100,
  "status" TEXT DEFAULT 'operational',
  "network_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "suppliers" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "code" TEXT NOT NULL CHECK(length("code") >= 2 AND length("code") <= 20),
  "name" TEXT NOT NULL CHECK(length("name") >= 2 AND length("name") <= 160),
  "category" TEXT,
  "riskTier" TEXT DEFAULT 'standard',
  "status" TEXT DEFAULT 'active',
  "network_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "shipments" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "trackingCode" TEXT NOT NULL CHECK(length("trackingCode") >= 2 AND length("trackingCode") <= 40),
  "description" TEXT NOT NULL CHECK(length("description") >= 2 AND length("description") <= 200),
  "origin" TEXT,
  "destination" TEXT,
  "expectedDate" TEXT,
  "status" TEXT DEFAULT 'planned',
  "priority" TEXT DEFAULT 'normal',
  "network_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "facility_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  FOREIGN KEY("facility_id") REFERENCES "facilitys"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "inventoryalerts" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "item" TEXT NOT NULL CHECK(length("item") >= 2 AND length("item") <= 160),
  "currentDays" INTEGER DEFAULT 0,
  "targetDays" INTEGER DEFAULT 14,
  "severity" TEXT DEFAULT 'medium',
  "status" TEXT DEFAULT 'open',
  "network_id" TEXT NOT NULL,
  "facility_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("facility_id") REFERENCES "facilitys"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "disruptions" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "summary" TEXT NOT NULL CHECK(length("summary") >= 2 AND length("summary") <= 500),
  "impact" TEXT DEFAULT 'medium',
  "probability" TEXT DEFAULT 'medium',
  "status" TEXT DEFAULT 'detected',
  "escalated" INTEGER DEFAULT 0 CHECK("escalated" IN (0, 1)),
  "network_id" TEXT NOT NULL,
  "facility_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("facility_id") REFERENCES "facilitys"("id") ON DELETE RESTRICT,
  FOREIGN KEY("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE "recoveryplans" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 2 AND length("title") <= 200),
  "strategy" TEXT,
  "targetDate" TEXT,
  "progress" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'draft',
  "disruption_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("disruption_id") REFERENCES "disruptions"("id") ON DELETE CASCADE,
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
  "disruption_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("disruption_id") REFERENCES "disruptions"("id") ON DELETE CASCADE,
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
  "health" TEXT DEFAULT 'green',
  "status" TEXT DEFAULT 'draft',
  "network_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  FOREIGN KEY("network_id") REFERENCES "networks"("id") ON DELETE CASCADE,
  FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- UNIQUE: user-email (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "user-email_unique" ON "users"("email");
-- UNIQUE: network-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "network-code_unique" ON "networks"("code");
-- UNIQUE: facility-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "facility-code_unique" ON "facilitys"("code");
-- UNIQUE: supplier-code (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "supplier-code_unique" ON "suppliers"("code");
-- UNIQUE: shipment-trackingcode (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)
CREATE UNIQUE INDEX "shipment-trackingcode_unique" ON "shipments"("trackingCode");