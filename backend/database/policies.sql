-- ENCLOSURE RLS Policies
-- Target: backend/database/policies.sql
-- Strategy: Strict Whitelist + Security Definer Bypass for Visibility Paradox

-- 0. ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. HELPER FUNCTIONS (SECURITY DEFINER)

-- Function: Check if user is Admin
-- SECURITY FIX 1: Admin detection now uses JWT role, not user-mutable profile.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check JWT claim for admin role (Supabase auth context)
  -- Prevents privilege escalation via profile manipulation
  RETURN auth.jwt() ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if artifact is visible (Bypassing Container Secrecy)
-- Logic: Visible IF (Container VALIDATED/TRANSFERRED) AND (User is Room Participant)
-- SECURITY FIX 2: Added null guard and locked search_path to prevent data leakage
CREATE OR REPLACE FUNCTION public.can_view_artifact(target_container_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_state container_state;
  v_room_id UUID;
  v_client_id UUID;
  v_freelancer_id UUID;
BEGIN
  -- SECURITY FIX 2: Early null check to prevent misuse
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Fetch container metadata (As Definer)
  SELECT state, room_id INTO v_state, v_room_id
  FROM public.containers WHERE id = target_container_id;
  
  -- If container not found or state not ready, deny
  IF v_state NOT IN ('VALIDATED', 'TRANSFERRED') THEN
    RETURN FALSE;
  END IF;

  -- Verify User Participation (As Definer)
  SELECT client_id, freelancer_id INTO v_client_id, v_freelancer_id
  FROM public.rooms WHERE id = v_room_id;

  RETURN (auth.uid() = v_client_id OR auth.uid() = v_freelancer_id OR public.is_admin());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 2. POLICIES

-- PROFILES
-- Policy Name: Profiles_View_Own
-- Role: ALL
-- Operation: SELECT
CREATE POLICY "Profiles_View_Own" ON public.profiles
FOR SELECT
USING (id = auth.uid() OR public.is_admin());

-- Policy Name: Profiles_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- FINAL HARDENING: Explicit deny to prevent role escalation via profile mutation
CREATE POLICY "Profiles_Deny_Update" ON public.profiles
FOR UPDATE
USING (FALSE);

-- ROOMS
-- Policy Name: Rooms_View_Participants
-- Role: ALL
-- Operation: SELECT
CREATE POLICY "Rooms_View_Participants" ON public.rooms
FOR SELECT
USING (
  auth.uid() = client_id OR 
  auth.uid() = freelancer_id OR 
  auth.uid() = created_by OR
  public.is_admin()
);

-- Policy Name: Rooms_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- SECURITY FIX 3: Explicit deny for direct UPDATE to prevent state mutation
CREATE POLICY "Rooms_Deny_Update" ON public.rooms
FOR UPDATE
USING (FALSE);

-- CONTAINERS
-- Policy Name: Containers_View_Owner_Strict
-- Role: ALL (Owner Only)
-- Operation: SELECT
CREATE POLICY "Containers_View_Owner_Strict" ON public.containers
FOR SELECT
USING (
  owner_id = auth.uid() OR 
  public.is_admin()
);

-- Policy Name: Containers_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- SECURITY FIX 3: Explicit deny for direct UPDATE to prevent state mutation
CREATE POLICY "Containers_Deny_Update" ON public.containers
FOR UPDATE
USING (FALSE);

-- ARTIFACTS
-- Policy Name: Artifacts_View_Validated
-- Role: ALL
-- Operation: SELECT
CREATE POLICY "Artifacts_View_Validated" ON public.artifacts
FOR SELECT
USING (
  -- Case 1: Owner (via Container ownership)
  (EXISTS (
    SELECT 1 FROM public.containers 
    WHERE id = container_id AND owner_id = auth.uid()
  ))
  OR
  -- Case 2: Counterparty (via Security Definer)
  public.can_view_artifact(container_id)
);

-- Policy Name: Artifacts_Insert_Placed
-- Role: ALL
-- Operation: INSERT
-- SECURITY FIX 4: Allow INSERT when container is EMPTY (first upload) or ARTIFACT_PLACED
CREATE POLICY "Artifacts_Insert_Placed" ON public.artifacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.containers
    WHERE id = container_id 
    AND owner_id = auth.uid()
    AND state IN ('EMPTY', 'ARTIFACT_PLACED')
  )
);

-- Policy Name: Artifacts_Delete_Placed
-- Role: ALL
-- Operation: DELETE
CREATE POLICY "Artifacts_Delete_Placed" ON public.artifacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.containers
    WHERE id = container_id 
    AND owner_id = auth.uid()
    AND state IN ('EMPTY', 'ARTIFACT_PLACED')
  )
);

-- Policy Name: Artifacts_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- SECURITY FIX 3: Explicit deny for direct UPDATE to prevent state mutation
CREATE POLICY "Artifacts_Deny_Update" ON public.artifacts
FOR UPDATE
USING (FALSE);

-- PAYMENTS
-- Policy Name: Payments_View_Own
-- Role: ALL
-- Operation: SELECT
CREATE POLICY "Payments_View_Own" ON public.payments
FOR SELECT
USING (
  payer_id = auth.uid() OR
  public.is_admin()
);

-- Policy Name: Payments_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- SECURITY FIX 3: Explicit deny for direct UPDATE to prevent state mutation
CREATE POLICY "Payments_Deny_Update" ON public.payments
FOR UPDATE
USING (FALSE);

-- Policy Name: Payments_Deny_Delete
-- Role: ALL
-- Operation: DELETE
-- FINAL HARDENING: Explicit deny for DELETE to enforce APPEND-ONLY immutability
CREATE POLICY "Payments_Deny_Delete" ON public.payments
FOR DELETE
USING (FALSE);

-- AUDIT LOGS
-- Policy Name: Audit_View_Room_Participants
-- Role: ALL
-- Operation: SELECT
CREATE POLICY "Audit_View_Room_Participants" ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = room_id
    AND (client_id = auth.uid() OR freelancer_id = auth.uid())
  )
  OR public.is_admin()
);

-- Policy Name: Audit_Deny_Update
-- Role: ALL
-- Operation: UPDATE
-- SECURITY FIX 3: Explicit deny for direct UPDATE to prevent audit log tampering
CREATE POLICY "Audit_Deny_Update" ON public.audit_logs
FOR UPDATE
USING (FALSE);

-- Policy Name: Audit_Deny_Delete
-- Role: ALL
-- Operation: DELETE
-- FINAL HARDENING: Explicit deny for DELETE to enforce APPEND-ONLY immutability
CREATE POLICY "Audit_Deny_Delete" ON public.audit_logs
FOR DELETE
USING (FALSE);

-- SYSTEM AI (Assumption: Service Role Bypasses RLS)
-- Explicit Deny for modification if System AI uses a specific DB role not service_role.
-- Assuming System AI connects as service_role, no policy needed (bypass).
-- If System AI uses 'SYSTEM_AI' user in profiles, it needs policies.
-- Given constraint: "System_AI: ... CANNOT write to any table". 
-- This implies System AI is NOT a Superuser/Service Role but a restricted user?
-- But System AI writes "validation_details".
-- Constraint says: "System_AI: ... CANNOT write to any table".
-- WAIT. "System_AI: ... CANNOT write to any table".
-- How does it update validation?
-- Maybe via stored procedure (Security Definer)?
-- "Admin ... CANNOT modify artifacts".
-- "System_AI ... CANNOT change states".
-- "Admin may ... Force UNDER_VALIDATION -> VALIDATED".
-- The transition logic is likely via Functions.
-- This file defines RLS (Direct Access) policies.
-- So RLS prevents direct UPDATE.
-- The Functions will use SECURITY DEFINER to perform updates.
-- So for RLS, we DO NOT provide UPDATE policies for anyone (except Artifacts in PLACED state).

-- BLOCK DIRECT UPDATES (Implicit Deny by providing NO Update Policy)
-- Rooms: Read Only
-- Containers: Read Only
-- Payments: Read Only
-- Audit Logs: Read Only
-- Artifacts: Read Only (except Insert/Delete in Placement phase)

-- Completed.
