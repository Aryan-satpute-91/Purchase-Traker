-- ============================================================
-- Migration 007: Restrict Access to Aryan & Nishant
-- Allows only aryansatpute97@gmail.com and nishantpawade77@gmail.com
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Helper function to check if the current user is part of the authorized team
CREATE OR REPLACE FUNCTION public.is_authorized_team()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN (
    'aryansatpute97@gmail.com',
    'nishantpawade77@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_authorized_team() TO authenticated, service_role;

-- 2. Projects: Only authorized team can access
DROP POLICY IF EXISTS "projects_owner" ON projects;
DROP POLICY IF EXISTS "projects_member_read" ON projects;
DROP POLICY IF EXISTS "projects_team_all" ON projects;

CREATE POLICY "projects_team_all" ON projects FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 3. Purchases: Only authorized team can access
DROP POLICY IF EXISTS "purchases_own" ON purchases;
DROP POLICY IF EXISTS "purchases_team_all" ON purchases;

CREATE POLICY "purchases_team_all" ON purchases FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 4. Sellers: Only authorized team can access
DROP POLICY IF EXISTS "sellers_own" ON sellers;
DROP POLICY IF EXISTS "sellers_team_all" ON sellers;

CREATE POLICY "sellers_team_all" ON sellers FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 5. Documents: Only authorized team can access
DROP POLICY IF EXISTS "documents_own" ON documents;
DROP POLICY IF EXISTS "documents_team_all" ON documents;

CREATE POLICY "documents_team_all" ON documents FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 6. Inventory: Only authorized team can access
DROP POLICY IF EXISTS "inventory_own" ON inventory;
DROP POLICY IF EXISTS "inventory_team_all" ON inventory;

CREATE POLICY "inventory_team_all" ON inventory FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 7. Time entries: Only authorized team can access
DROP POLICY IF EXISTS "time_entries_own" ON time_entries;
DROP POLICY IF EXISTS "time_entries_team_all" ON time_entries;

CREATE POLICY "time_entries_team_all" ON time_entries FOR ALL TO authenticated
  USING (public.is_authorized_team());

-- 8. Storage bucket purchase-docs: Only authorized team can access & download
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Team view documents" ON storage.objects;
DROP POLICY IF EXISTS "Team upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Team update documents" ON storage.objects;
DROP POLICY IF EXISTS "Team delete documents" ON storage.objects;

CREATE POLICY "Team view documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-docs' AND public.is_authorized_team());

CREATE POLICY "Team upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-docs' AND public.is_authorized_team());

CREATE POLICY "Team update documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-docs' AND public.is_authorized_team());

CREATE POLICY "Team delete documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-docs' AND public.is_authorized_team());

-- 9. Recreate summary views with security_invoker = true so they strictly obey team policies
DROP VIEW IF EXISTS public.project_summary CASCADE;
CREATE VIEW public.project_summary
WITH (security_invoker = true) AS
SELECT
  pr.id AS project_id,
  pr.name AS project_name,
  pr.owner_id,
  COUNT(DISTINCT p.id) AS item_count,
  COALESCE(SUM(p.total_amount), 0) AS total_spent,
  COALESCE(SUM(te.duration_minutes), 0) AS total_time_minutes
FROM public.projects pr
LEFT JOIN public.purchases p ON p.project_id = pr.id
LEFT JOIN public.time_entries te ON te.project_id = pr.id
GROUP BY pr.id, pr.name, pr.owner_id;

DROP VIEW IF EXISTS public.vendor_summary CASCADE;
CREATE VIEW public.vendor_summary
WITH (security_invoker = true) AS
SELECT
  s.id AS seller_id,
  s.name AS seller_name,
  s.owner_id,
  COUNT(p.id) AS order_count,
  COALESCE(SUM(p.total_amount), 0) AS total_spent
FROM public.sellers s
LEFT JOIN public.purchases p ON p.seller_id = s.id
GROUP BY s.id, s.name, s.owner_id;

GRANT SELECT ON public.project_summary TO authenticated, service_role;
GRANT SELECT ON public.vendor_summary TO authenticated, service_role;
