-- ============================================================
-- Migration 008: Restrict ONLY "Bio-sentry" Project to Aryan & Nishant
-- All other users can access and use the site normally for their own data.
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Helper function to check if the current user is Aryan or Nishant
CREATE OR REPLACE FUNCTION public.is_biosentry_team()
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

GRANT EXECUTE ON FUNCTION public.is_biosentry_team() TO authenticated, service_role;

-- 2. Projects Policy:
-- - Regular projects are visible to their owner (owner_id = auth.uid()) or members.
-- - "Bio-sentry" project is ONLY visible to aryansatpute97@gmail.com and nishantpawade77@gmail.com.
DROP POLICY IF EXISTS "projects_owner" ON projects;
DROP POLICY IF EXISTS "projects_member_read" ON projects;
DROP POLICY IF EXISTS "projects_team_all" ON projects;
DROP POLICY IF EXISTS "projects_access_policy" ON projects;

CREATE POLICY "projects_access_policy" ON projects FOR ALL TO authenticated
  USING (
    CASE 
      -- Special case: Bio-sentry project is restricted exclusively to Aryan and Nishant
      WHEN LOWER(name) LIKE '%bio%sentry%' THEN public.is_biosentry_team()
      -- All other projects are normal: users own and see their own projects
      ELSE (owner_id = auth.uid() OR public.is_project_member(id))
    END
  );

-- 3. Purchases Policy:
-- - Regular purchases are visible to their owner (user_id = auth.uid()).
-- - Purchases linked to Bio-sentry are shared between Aryan and Nishant.
DROP POLICY IF EXISTS "purchases_own" ON purchases;
DROP POLICY IF EXISTS "purchases_team_all" ON purchases;
DROP POLICY IF EXISTS "purchases_access_policy" ON purchases;

CREATE POLICY "purchases_access_policy" ON purchases FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.is_biosentry_team() 
      AND project_id IN (SELECT id FROM projects WHERE LOWER(name) LIKE '%bio%sentry%')
    )
  );

-- 4. Sellers Policy:
-- - Users manage their own sellers.
-- - Bio-sentry sellers are shared between Aryan and Nishant.
DROP POLICY IF EXISTS "sellers_own" ON sellers;
DROP POLICY IF EXISTS "sellers_team_all" ON sellers;
DROP POLICY IF EXISTS "sellers_access_policy" ON sellers;

CREATE POLICY "sellers_access_policy" ON sellers FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      public.is_biosentry_team() 
      AND id IN (
        SELECT seller_id FROM purchases p 
        JOIN projects pr ON pr.id = p.project_id 
        WHERE LOWER(pr.name) LIKE '%bio%sentry%'
      )
    )
  );

-- 5. Documents Policy:
-- - Users see documents for purchases they have access to.
DROP POLICY IF EXISTS "documents_own" ON documents;
DROP POLICY IF EXISTS "documents_team_all" ON documents;
DROP POLICY IF EXISTS "documents_access_policy" ON documents;

CREATE POLICY "documents_access_policy" ON documents FOR ALL TO authenticated
  USING (
    purchase_id IN (SELECT id FROM purchases WHERE user_id = auth.uid())
    OR (
      public.is_biosentry_team() 
      AND purchase_id IN (
        SELECT p.id FROM purchases p 
        JOIN projects pr ON pr.id = p.project_id 
        WHERE LOWER(pr.name) LIKE '%bio%sentry%'
      )
    )
  );

-- 6. Inventory Policy:
DROP POLICY IF EXISTS "inventory_own" ON inventory;
DROP POLICY IF EXISTS "inventory_team_all" ON inventory;
DROP POLICY IF EXISTS "inventory_access_policy" ON inventory;

CREATE POLICY "inventory_access_policy" ON inventory FOR ALL TO authenticated
  USING (
    purchase_id IN (SELECT id FROM purchases WHERE user_id = auth.uid())
    OR (
      public.is_biosentry_team() 
      AND purchase_id IN (
        SELECT p.id FROM purchases p 
        JOIN projects pr ON pr.id = p.project_id 
        WHERE LOWER(pr.name) LIKE '%bio%sentry%'
      )
    )
  );

-- 7. Time Entries Policy:
DROP POLICY IF EXISTS "time_entries_own" ON time_entries;
DROP POLICY IF EXISTS "time_entries_team_all" ON time_entries;
DROP POLICY IF EXISTS "time_entries_access_policy" ON time_entries;

CREATE POLICY "time_entries_access_policy" ON time_entries FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.is_biosentry_team() 
      AND project_id IN (SELECT id FROM projects WHERE LOWER(name) LIKE '%bio%sentry%')
    )
  );

-- 8. Storage bucket purchase-docs:
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Team view documents" ON storage.objects;
DROP POLICY IF EXISTS "Team upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Team update documents" ON storage.objects;
DROP POLICY IF EXISTS "Team delete documents" ON storage.objects;

CREATE POLICY "storage_select_policy" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'purchase-docs' 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text 
      OR public.is_biosentry_team()
    )
  );

CREATE POLICY "storage_insert_policy" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'purchase-docs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_update_policy" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'purchase-docs' 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text 
      OR public.is_biosentry_team()
    )
  );

CREATE POLICY "storage_delete_policy" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'purchase-docs' 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text 
      OR public.is_biosentry_team()
    )
  );

-- 9. Recreate project_summary & vendor_summary views WITH (security_invoker = true)
-- This ensures the views strictly obey the above RLS rules:
-- Other users will NEVER see Bio-sentry spending, but will see their own projects.
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
