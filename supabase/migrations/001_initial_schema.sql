-- ============================================================
-- Purchase Tracker — Initial Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────
CREATE TYPE order_status AS ENUM (
  'ordered', 'confirmed', 'packed', 'shipped',
  'in_transit', 'delivered', 'cancelled', 'returned'
);

CREATE TYPE payment_method AS ENUM (
  'upi', 'credit_card', 'debit_card', 'netbanking', 'cash', 'wallet'
);

CREATE TYPE doc_type AS ENUM (
  'invoice', 'receipt', 'order_confirmation', 'warranty', 'delivery_proof', 'other'
);

CREATE TYPE activity_type AS ENUM (
  'research', 'price_comparison', 'ordering', 'testing',
  'integration', 'debugging', 'documentation', 'other'
);

CREATE TYPE project_role AS ENUM ('owner', 'editor', 'viewer');

-- ────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────

-- profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  currency    TEXT DEFAULT 'INR',
  default_gst_rate    NUMERIC DEFAULT 18,
  default_return_days INT DEFAULT 7,
  default_warranty_months INT DEFAULT 12,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- project_members
CREATE TABLE IF NOT EXISTS project_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        project_role NOT NULL DEFAULT 'viewer',
  UNIQUE(project_id, user_id)
);

-- sellers
CREATE TABLE IF NOT EXISTS sellers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  website     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- purchases (core table)
CREATE TABLE IF NOT EXISTS purchases (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  seller_id             UUID REFERENCES sellers(id) ON DELETE SET NULL,
  item_name             TEXT NOT NULL,
  category              TEXT,
  purpose               TEXT,
  quantity              INT NOT NULL DEFAULT 1,
  base_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2) GENERATED ALWAYS AS (base_price + gst_amount + shipping_cost - discount_amount) STORED,
  currency              TEXT NOT NULL DEFAULT 'INR',
  order_status          order_status NOT NULL DEFAULT 'ordered',
  order_date            TIMESTAMPTZ,
  expected_delivery_date TIMESTAMPTZ,
  delivered_date        TIMESTAMPTZ,
  payment_method        payment_method,
  transaction_id        TEXT,
  warranty_months       INT,
  return_window_days    INT,
  storage_location      TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id   UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  doc_type      doc_type NOT NULL DEFAULT 'invoice',
  file_path     TEXT NOT NULL,
  extracted_data JSONB,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- inventory
CREATE TABLE IF NOT EXISTS inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id         UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_name           TEXT NOT NULL,
  quantity_purchased  INT NOT NULL DEFAULT 0,
  quantity_used       INT NOT NULL DEFAULT 0,
  quantity_available  INT GENERATED ALWAYS AS (quantity_purchased - quantity_used) STORED,
  location            TEXT
);

-- time_entries
CREATE TABLE IF NOT EXISTS time_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_id     UUID REFERENCES purchases(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  activity_type   activity_type NOT NULL DEFAULT 'other',
  duration_minutes INT NOT NULL DEFAULT 0,
  notes           TEXT,
  logged_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- VIEWS
-- ────────────────────────────────────────────

CREATE OR REPLACE VIEW vendor_summary AS
SELECT
  s.id AS seller_id,
  s.name AS seller_name,
  s.owner_id,
  COUNT(p.id) AS order_count,
  COALESCE(SUM(p.total_amount), 0) AS total_spent
FROM sellers s
LEFT JOIN purchases p ON p.seller_id = s.id
GROUP BY s.id, s.name, s.owner_id;

CREATE OR REPLACE VIEW project_summary AS
SELECT
  pr.id AS project_id,
  pr.name AS project_name,
  pr.owner_id,
  COUNT(DISTINCT p.id) AS item_count,
  COALESCE(SUM(p.total_amount), 0) AS total_spent,
  COALESCE(SUM(te.duration_minutes), 0) AS total_time_minutes
FROM projects pr
LEFT JOIN purchases p ON p.project_id = pr.id
LEFT JOIN time_entries te ON te.project_id = pr.id
GROUP BY pr.id, pr.name, pr.owner_id;

-- ────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (id = auth.uid());

-- projects: owner or member
CREATE POLICY "projects_owner" ON projects FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "projects_member_read" ON projects FOR SELECT
  USING (id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- project_members: project owner manages, members can read
CREATE POLICY "pm_read" ON project_members FOR SELECT
  USING (user_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "pm_manage" ON project_members FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- sellers: owner only
CREATE POLICY "sellers_own" ON sellers FOR ALL USING (owner_id = auth.uid());

-- purchases: own only
CREATE POLICY "purchases_own" ON purchases FOR ALL USING (user_id = auth.uid());

-- documents: via purchase ownership
CREATE POLICY "documents_own" ON documents FOR ALL
  USING (purchase_id IN (SELECT id FROM purchases WHERE user_id = auth.uid()));

-- inventory: via purchase ownership
CREATE POLICY "inventory_own" ON inventory FOR ALL
  USING (purchase_id IN (SELECT id FROM purchases WHERE user_id = auth.uid()));

-- time_entries: own only
CREATE POLICY "time_entries_own" ON time_entries FOR ALL USING (user_id = auth.uid());

-- ────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGN UP
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────
-- STORAGE BUCKET (run in SQL or Supabase Dashboard)
-- ────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('purchase-docs', 'purchase-docs', false);

-- Storage RLS: users can only access their own files
-- CREATE POLICY "storage_own" ON storage.objects FOR ALL
--   USING (bucket_id = 'purchase-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
