-- ============================================================
-- Migration 006: Enable security_invoker on Views to enforce RLS
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Recreate project_summary with security_invoker = true so RLS is enforced
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

-- 2. Recreate vendor_summary with security_invoker = true so RLS is enforced
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

-- 3. Grant access to authenticated users
GRANT SELECT ON public.project_summary TO authenticated, service_role;
GRANT SELECT ON public.vendor_summary TO authenticated, service_role;
