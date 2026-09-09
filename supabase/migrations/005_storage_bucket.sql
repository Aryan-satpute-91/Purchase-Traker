-- ============================================================
-- Migration 005: Create Storage Bucket and Policies for purchase-docs
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Create the purchase-docs bucket (if not already existing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-docs',
  'purchase-docs',
  false,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Clean up any existing policies
DROP POLICY IF EXISTS "storage_own" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- 3. Policy: Authenticated users can view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-docs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Authenticated users can upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-docs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Policy: Authenticated users can update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'purchase-docs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Policy: Authenticated users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'purchase-docs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
