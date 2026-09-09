-- ============================================================
-- Migration 002: Item Lifecycle Status & History Tracking
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create lifecycle_status enum if not exists
DO $$ BEGIN
  CREATE TYPE lifecycle_status AS ENUM (
    'received', 'tested', 'in_use', 'repaired', 'retired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add lifecycle_status column to purchases table
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS lifecycle_status lifecycle_status DEFAULT NULL;

-- 3. Create lifecycle_events table for transition history
CREATE TABLE IF NOT EXISTS lifecycle_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  status      lifecycle_status NOT NULL,
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index for fast event lookup
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_purchase_id ON lifecycle_events(purchase_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_changed_at ON lifecycle_events(changed_at DESC);

-- 5. Row Level Security for lifecycle_events (inherit ownership from purchases)
ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lifecycle_events_own" ON lifecycle_events;
CREATE POLICY "lifecycle_events_own" ON lifecycle_events FOR ALL
  USING (purchase_id IN (SELECT id FROM purchases WHERE user_id = auth.uid()));

