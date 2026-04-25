# NeuroAttention — Data Safety & Migration Rules

## Core Principle
**No deployment should ever destroy or silently lose user data.**

## Rules

### 1. localStorage Changes
- **Never rename a localStorage key** without writing a migration that reads the old key, writes to the new key, and deletes the old key.
- All localStorage keys used by the app must be documented here.
- If the JSON format of a stored value changes, include a versioning field (`_v: 2`) and write a migration function that converts old format to new on page load.

**Current localStorage keys:**
| Key | Purpose |
|-----|---------|
| `na_token` | JWT auth token |
| `na_user` | Cached user object (JSON) |
| `na_neuromap_data` | NeuroMap entries cache (JSON, mirrors DB) |
| `na_diary_data` | Neuro-resource diary entries cache (JSON, mirrors DB) |
| `na_calendar_events` | Calendar events cache (JSON, mirrors DB) |
| `na_course_progress` | Course progress array cache (JSON, mirrors DB) |

### 2. Database Schema Changes (Neon)
- Always use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (nullable or with default) for backward compatibility.
- **Never** use `DROP TABLE` or `DROP COLUMN` on tables with user data. If a column is deprecated, leave it and stop writing to it.
- Every schema change must be a numbered migration: `migrations/NNN_description.sql`.
- Run migrations via the `/api/run-migrations` endpoint or Neon SQL Editor.
- Test migrations against a copy of production data when possible.

**Migration log:**
| # | Description | Date |
|---|-------------|------|
| 001 | Create `users` table | 2025-03-xx |
| 002 | Add `role`, `last_login_at` columns | 2025-03-xx |
| 003 | Add `role` column (if missing), index | 2025-04-xx |
| 004 | Create `password_resets` table | 2025-04-xx |
| 005 | Create `neuro_map_entries` table | 2026-04-25 |
| 006 | Create `neuro_resource_diary`, `calendar_events`, `course_progress` tables | 2026-04-25 |
| 007 | Create `nm_nodes` + `nm_links` tables for NeuroMap graph | 2026-04-25 |

### 3. Pre-Deploy Checklist
Before every deploy that touches data storage:
- [ ] Does the update change any localStorage key names or value formats?
- [ ] Does the update change any DB table structure?
- [ ] If yes to either: is there a migration script that preserves existing data?
- [ ] Have you tested with existing user accounts (not just fresh ones)?

### 4. Neon Backups
Neon has built-in point-in-time recovery (PITR). Ensure the project has branching enabled for safe testing. Before destructive migrations, create a Neon branch as a backup.

### 5. Frontend Data Flow
- NeuroMap data: saved to Neon DB via API on every entry, cached in localStorage for fast load.
- Diary data: saved to Neon DB via API on every entry, cached in localStorage for fast load.
- Calendar events: saved to Neon DB via API on add/toggle/delete, cached in localStorage for fast load.
- Course progress: saved to Neon DB via API on status change (upsert), cached in localStorage for fast load.
- Point A→B data: saved to Neon DB via API.
- Auth tokens: localStorage only (not persisted server-side beyond JWT validation).

---

*This document is a binding agreement for all contributors. Violating these rules risks permanent user data loss.*
