-- WorkOS Auth Migration
-- Run this in Supabase SQL Editor

-- 1. Drop ALL RLS policies on all app tables (including related tables
--    whose policies reference user_id via subqueries)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 2. Drop all foreign key constraints referencing auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE customer_request_forms DROP CONSTRAINT IF EXISTS customer_request_forms_user_id_fkey;
ALTER TABLE public_views DROP CONSTRAINT IF EXISTS public_views_user_id_fkey;
ALTER TABLE branding_settings DROP CONSTRAINT IF EXISTS branding_settings_user_id_fkey;
ALTER TABLE custom_domains DROP CONSTRAINT IF EXISTS custom_domains_user_id_fkey;
ALTER TABLE roadmaps DROP CONSTRAINT IF EXISTS roadmaps_user_id_fkey;

-- 3. Truncate all user-owned data (fresh start)
TRUNCATE profiles, customer_request_forms, public_views, branding_settings, custom_domains, roadmaps CASCADE;

-- 4. Change column types from uuid to text
ALTER TABLE profiles ALTER COLUMN id TYPE text;
ALTER TABLE customer_request_forms ALTER COLUMN user_id TYPE text;
ALTER TABLE public_views ALTER COLUMN user_id TYPE text;
ALTER TABLE branding_settings ALTER COLUMN user_id TYPE text;
ALTER TABLE custom_domains ALTER COLUMN user_id TYPE text;
ALTER TABLE roadmaps ALTER COLUMN user_id TYPE text;

-- 5. Disable RLS on all public tables
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END $$;
