-- ============================================================
-- Migration 004: Fix Infinite Recursion in Projects & Project Members RLS
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Helper function: check if user is a project owner (SECURITY DEFINER bypasses RLS loop)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND owner_id = auth.uid()
  );
$$;

-- 2. Helper function: check if user is a project member (SECURITY DEFINER bypasses RLS loop)
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated, service_role;

-- 3. Drop existing recursive policies
DROP POLICY IF EXISTS "projects_owner" ON projects;
DROP POLICY IF EXISTS "projects_member_read" ON projects;
DROP POLICY IF EXISTS "pm_read" ON project_members;
DROP POLICY IF EXISTS "pm_manage" ON project_members;

-- 4. Re-create clean non-recursive policies on `projects`
CREATE POLICY "projects_owner" ON projects FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "projects_member_read" ON projects FOR SELECT
  USING (public.is_project_member(id));

-- 5. Re-create clean non-recursive policies on `project_members`
CREATE POLICY "pm_read" ON project_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_project_owner(project_id));

CREATE POLICY "pm_manage" ON project_members FOR ALL
  USING (public.is_project_owner(project_id));
