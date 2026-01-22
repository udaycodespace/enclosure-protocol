-- ENCLOSURE Database Schema (HARDENED)
-- Authoritative Source: docs/state-machine.md + Critical Constraints
-- Security Level: CRITICAL

-- 1. ENUMS
CREATE TYPE room_state AS ENUM (
  'ROOM_CREATED', 'INVITE_SENT', 'JOINED', 'LOCKED', 'IN_PROGRESS',
  'UNDER_VALIDATION', 'SWAP_READY', 'SWAPPED', 'CANCELLED', 'FAILED', 'EXPIRED'
);

CREATE TYPE container_state AS ENUM (
  'EMPTY', 'ARTIFACT_PLACED', 'SEALED', 'UNDER_VALIDATION',
  'VALIDATED', 'VALIDATION_FAILED', 'TRANSFERRED'
);

CREATE TYPE container_side AS ENUM ('A', 'B');
CREATE TYPE payment_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');
CREATE TYPE payment_type AS ENUM ('PLACEMENT_FEE', 'VALIDATION_FEE', 'ESCROW');
CREATE TYPE actor_role AS ENUM ('CLIENT', 'FREELANCER', 'ADMIN', 'SYSTEM_AI');

-- NEW: Room Role Disambiguation
CREATE TYPE room_type AS ENUM ('MUTUAL_TRANSFER', 'ESCROW_VALIDATION');

-- 2. TABLES

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role actor_role NOT NULL DEFAULT 'CLIENT', -- Added for Admin identification
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  
  room_type room_type NOT NULL, -- MANDATORY
  
  client_id UUID REFERENCES public.profiles(id),
  freelancer_id UUID REFERENCES public.profiles(id),
  
  state room_state NOT NULL DEFAULT 'ROOM_CREATED',
  
  title TEXT NOT NULL,
  requirements TEXT,
  
  -- MANDATORY: Requirements Immutability
  requirements_hash VARCHAR(64), 
  requirements_version INTEGER DEFAULT 1,
  
  amount_total NUMERIC(12, 2) CHECK (amount_total >= 0),
  currency VARCHAR(3) DEFAULT 'INR',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT distinct_parties CHECK (client_id IS DISTINCT FROM freelancer_id)
);

-- Containers
CREATE TABLE public.containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.profiles(id),
  side container_side NOT NULL,
  
  state container_state NOT NULL DEFAULT 'EMPTY',
  
  content_hash VARCHAR(64),
  validation_summary TEXT,
  validation_details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(room_id, side)
);

-- Artifacts
CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id),
  
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  
  file_hash VARCHAR(64) NOT NULL,
  is_scanned BOOLEAN NOT NULL DEFAULT FALSE,
  is_infected BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  payer_id UUID NOT NULL REFERENCES public.profiles(id),
  
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_type payment_type NOT NULL,
  
  provider_order_id TEXT NOT NULL,
  provider_payment_id TEXT,
  status payment_status NOT NULL DEFAULT 'PENDING',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- MANDATORY: Payment Safety
  UNIQUE(room_id, payment_type, payer_id)
);

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  actor_id UUID REFERENCES public.profiles(id),
  actor_role actor_role NOT NULL,
  
  action TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  metadata JSONB,
  
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX idx_rooms_state ON public.rooms(state);
CREATE INDEX idx_containers_room ON public.containers(room_id);
CREATE INDEX idx_payments_room ON public.payments(room_id);

-- 4. HARDENED CONSTRAINTS (Triggers where Check is insufficient)

-- Function to enforce Container Ownership Logic
CREATE OR REPLACE FUNCTION enforce_container_ownership()
RETURNS TRIGGER AS $$
DECLARE
    r_client UUID;
    r_freelancer UUID;
BEGIN
    SELECT client_id, freelancer_id INTO r_client, r_freelancer
    FROM public.rooms WHERE id = NEW.room_id;

    IF NEW.side = 'A' AND NEW.owner_id IS DISTINCT FROM r_client THEN
        RAISE EXCEPTION 'Container Side A must belong to Client';
    END IF;

    IF NEW.side = 'B' AND NEW.owner_id IS DISTINCT FROM r_freelancer THEN
        RAISE EXCEPTION 'Container Side B must belong to Freelancer';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_container_ownership
BEFORE INSERT OR UPDATE ON public.containers
FOR EACH ROW EXECUTE FUNCTION enforce_container_ownership();

-- FINAL HARDENING: Append-Only Enforcement for audit_logs
-- Audit logs are eternal facts. No deletion. No modification. Ever.
CREATE OR REPLACE FUNCTION prevent_audit_logs_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is APPEND-ONLY. Deletion is forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_delete
BEFORE DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_logs_deletion();

-- FINAL HARDENING: Append-Only Enforcement for payments
-- Payments are permanent financial facts. No deletion. No modification. Ever.
CREATE OR REPLACE FUNCTION prevent_payments_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'payments is APPEND-ONLY. Deletion is forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_no_delete
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION prevent_payments_deletion();
