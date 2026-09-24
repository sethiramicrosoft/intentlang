PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE "tasks" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL CHECK(length("title") >= 1 AND length("title") <= 200),
  "status" TEXT DEFAULT 'open'
);
