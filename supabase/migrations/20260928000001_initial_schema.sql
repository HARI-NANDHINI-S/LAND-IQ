-- ============================================================
-- BhoomiAI / LAND-IQ — Initial Schema Migration
-- ============================================================
-- Production-oriented Supabase schema
--
-- IMPORTANT:
-- 1. Supabase managed functions such as auth.uid() remain in auth.
-- 2. Application helper functions are created in public, NOT auth.
-- 3. RLS is the authorization boundary.
-- 4. State/district scoped data must not use USING (true).
-- 5. Audit and verification action tables are append-only.
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Shared trigger function for automatically maintaining updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- ROLES AND PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL
        REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL
        REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);


-- ============================================================
-- GEOGRAPHIC HIERARCHY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.states (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    state_id UUID NOT NULL
        REFERENCES public.states(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(state_id, code)
);

CREATE TABLE IF NOT EXISTS public.taluks (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    district_id UUID NOT NULL
        REFERENCES public.districts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(district_id, code)
);

CREATE TABLE IF NOT EXISTS public.villages (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    taluk_id UUID NOT NULL
        REFERENCES public.taluks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(taluk_id, code)
);


-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role_id UUID REFERENCES public.roles(id),
    state_id UUID REFERENCES public.states(id),
    district_id UUID REFERENCES public.districts(id),
    village_id UUID REFERENCES public.villages(id),
    employee_code TEXT,
    designation TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- AUTO-CREATE PROFILE AFTER AUTH USER CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        email
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            'New User'
        ),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
-- IMPORTANT:
-- DO NOT CREATE THESE FUNCTIONS UNDER auth.*
--
-- auth.uid() is Supabase's built-in function.
-- Our custom application functions belong under public.*.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT r.code
    FROM public.profiles p
    JOIN public.roles r
        ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
    LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.user_district_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT district_id
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.user_state_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT state_id
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.has_permission(
    required_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.role_permissions rp
            ON p.role_id = rp.role_id
        JOIN public.permissions perm
            ON rp.permission_id = perm.id
        WHERE p.id = auth.uid()
          AND p.is_active = TRUE
          AND perm.code = required_permission
    );
$$;


GRANT EXECUTE ON FUNCTION public.user_role()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_district_id()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_state_id()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT)
TO authenticated;


-- ============================================================
-- LAND RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.land_records (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    record_number TEXT UNIQUE NOT NULL,
    survey_number TEXT NOT NULL,
    subdivision_number TEXT,
    patta_number TEXT,

    state_id UUID REFERENCES public.states(id),
    district_id UUID REFERENCES public.districts(id),
    taluk_id UUID REFERENCES public.taluks(id),
    village_id UUID REFERENCES public.villages(id),

    land_area NUMERIC(12,4),
    land_area_unit TEXT DEFAULT 'acres',

    land_classification TEXT,
    land_type TEXT,

    record_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            record_status IN (
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        ),

    registration_number TEXT,
    registration_date DATE,

    remarks TEXT,

    verification_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (
            verification_status IN (
                'PENDING',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'CORRECTION_REQUIRED'
            )
        ),

    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAND OWNERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.land_owners (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    full_name TEXT NOT NULL,
    identification_reference TEXT,
    contact_reference TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.land_record_owners (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    owner_id UUID NOT NULL
        REFERENCES public.land_owners(id)
        ON DELETE CASCADE,

    ownership_percentage NUMERIC(5,2)
        CHECK (
            ownership_percentage > 0
            AND ownership_percentage <= 100
        ),

    ownership_type TEXT,
    is_primary BOOLEAN DEFAULT FALSE,

    effective_from DATE,
    effective_to DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID
        REFERENCES public.land_records(id),

    document_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,

    mime_type TEXT,
    file_size BIGINT,
    sha256 TEXT,
    document_year INTEGER,

    state_id UUID REFERENCES public.states(id),
    district_id UUID REFERENCES public.districts(id),
    village_id UUID REFERENCES public.villages(id),

    processing_status TEXT NOT NULL DEFAULT 'PENDING',
    verification_status TEXT NOT NULL DEFAULT 'PENDING',

    uploaded_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    document_id UUID NOT NULL
        REFERENCES public.documents(id)
        ON DELETE CASCADE,

    page_number INTEGER NOT NULL,

    storage_path TEXT,

    width INTEGER,
    height INTEGER,

    ocr_status TEXT DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.extracted_fields (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    document_id UUID NOT NULL
        REFERENCES public.documents(id)
        ON DELETE CASCADE,

    land_record_id UUID
        REFERENCES public.land_records(id),

    field_name TEXT NOT NULL,
    field_value TEXT,
    normalized_value TEXT,

    confidence_score NUMERIC(5,2),

    source_page_id UUID
        REFERENCES public.document_pages(id),

    extraction_method TEXT DEFAULT 'SEEDED',
    validation_status TEXT DEFAULT 'PENDING',

    verified_value TEXT,

    verified_by UUID
        REFERENCES public.profiles(id),

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- VERIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.verification_tasks (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    document_id UUID NOT NULL
        REFERENCES public.documents(id)
        ON DELETE CASCADE,

    land_record_id UUID
        REFERENCES public.land_records(id),

    assigned_to UUID
        REFERENCES public.profiles(id),

    status TEXT NOT NULL DEFAULT 'QUEUED'
        CHECK (
            status IN (
                'QUEUED',
                'ASSIGNED',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'CORRECTION_REQUIRED'
            )
        ),

    priority TEXT DEFAULT 'MEDIUM'
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.verification_actions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    verification_task_id UUID NOT NULL
        REFERENCES public.verification_tasks(id)
        ON DELETE CASCADE,

    actor_id UUID
        REFERENCES public.profiles(id),

    action TEXT NOT NULL,

    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- DUPLICATE DETECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.duplicate_candidates (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    record_a_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    record_b_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    similarity_score NUMERIC(5,2),

    match_signals JSONB,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'UNDER_REVIEW',
                'CONFIRMED',
                'FALSE_POSITIVE',
                'LEGITIMATE_SUBDIVISION',
                'DISPUTED'
            )
        ),

    reviewed_by UUID
        REFERENCES public.profiles(id),

    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (record_a_id <> record_b_id)
);


-- ============================================================
-- RISK INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    risk_score NUMERIC(5,2)
        CHECK (
            risk_score >= 0
            AND risk_score <= 100
        ),

    risk_level TEXT
        CHECK (
            risk_level IN (
                'LOW',
                'MODERATE',
                'HIGH',
                'CRITICAL'
            )
        ),

    status TEXT DEFAULT 'ACTIVE',

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    calculation_version TEXT
        DEFAULT 'v1.0-rules-engine',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.risk_signals (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    risk_assessment_id UUID NOT NULL
        REFERENCES public.risk_assessments(id)
        ON DELETE CASCADE,

    signal_type TEXT NOT NULL,
    description TEXT,

    contribution NUMERIC(5,2),

    evidence JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- MONITORING / BHOOMIWATCH
-- ============================================================

CREATE TABLE IF NOT EXISTS public.record_changes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,

    field_name TEXT NOT NULL,

    old_value TEXT,
    new_value TEXT,

    change_priority TEXT DEFAULT 'LOW'
        CHECK (
            change_priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    changed_by UUID
        REFERENCES public.profiles(id),

    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.watchlists (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID NOT NULL
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    reason TEXT,

    status TEXT DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'RESOLVED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    land_record_id UUID
        REFERENCES public.land_records(id)
        ON DELETE CASCADE,

    alert_type TEXT NOT NULL,

    priority TEXT DEFAULT 'MEDIUM'
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    title TEXT NOT NULL,
    description TEXT,

    status TEXT DEFAULT 'NEW'
        CHECK (
            status IN (
                'NEW',
                'ACKNOWLEDGED',
                'UNDER_REVIEW',
                'RESOLVED',
                'ESCALATED'
            )
        ),

    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),

    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    notification_type TEXT NOT NULL,

    title TEXT NOT NULL,
    message TEXT NOT NULL,

    entity_type TEXT,
    entity_id UUID,

    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

    actor_id UUID REFERENCES public.profiles(id),
    actor_role TEXT,

    action TEXT NOT NULL,

    entity_type TEXT NOT NULL,
    entity_id UUID,

    before_state JSONB,
    after_state JSONB,

    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_land_records_survey_num
ON public.land_records(survey_number);

CREATE INDEX IF NOT EXISTS idx_land_records_patta
ON public.land_records(patta_number);

CREATE INDEX IF NOT EXISTS idx_land_records_district
ON public.land_records(district_id);

CREATE INDEX IF NOT EXISTS idx_land_records_village
ON public.land_records(village_id);

CREATE INDEX IF NOT EXISTS idx_land_records_vstatus
ON public.land_records(verification_status);

CREATE INDEX IF NOT EXISTS idx_land_records_rstatus
ON public.land_records(record_status);

CREATE INDEX IF NOT EXISTS idx_land_records_created
ON public.land_records(created_at DESC);


CREATE INDEX IF NOT EXISTS idx_documents_land_record
ON public.documents(land_record_id);

CREATE INDEX IF NOT EXISTS idx_documents_district
ON public.documents(district_id);

CREATE INDEX IF NOT EXISTS idx_documents_proc_status
ON public.documents(processing_status);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by
ON public.documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_documents_created
ON public.documents(created_at DESC);


CREATE INDEX IF NOT EXISTS idx_vtasks_assigned_to
ON public.verification_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_vtasks_status
ON public.verification_tasks(status);

CREATE INDEX IF NOT EXISTS idx_vtasks_priority
ON public.verification_tasks(priority);


CREATE INDEX IF NOT EXISTS idx_risk_assessments_lr
ON public.risk_assessments(land_record_id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_level
ON public.risk_assessments(risk_level);


CREATE INDEX IF NOT EXISTS idx_record_changes_lr
ON public.record_changes(land_record_id);

CREATE INDEX IF NOT EXISTS idx_record_changes_priority
ON public.record_changes(change_priority);

CREATE INDEX IF NOT EXISTS idx_record_changes_at
ON public.record_changes(changed_at DESC);


CREATE INDEX IF NOT EXISTS idx_alerts_status
ON public.alerts(status);

CREATE INDEX IF NOT EXISTS idx_alerts_priority
ON public.alerts(priority);

CREATE INDEX IF NOT EXISTS idx_alerts_created
ON public.alerts(created_at DESC);


CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON public.notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created
ON public.notifications(created_at DESC);


CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
ON public.audit_logs(actor_id);


CREATE INDEX IF NOT EXISTS idx_districts_state
ON public.districts(state_id);

CREATE INDEX IF NOT EXISTS idx_taluks_district
ON public.taluks(district_id);

CREATE INDEX IF NOT EXISTS idx_villages_taluk
ON public.villages(taluk_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_record_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taluks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- REFERENCE DATA — READ
-- ============================================================

CREATE POLICY "Authenticated users can read roles"
ON public.roles
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Authenticated users can read permissions"
ON public.permissions
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Authenticated users can read role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Authenticated users can read active states"
ON public.states
FOR SELECT
TO authenticated
USING (is_active = true);


CREATE POLICY "Authenticated users can read active districts"
ON public.districts
FOR SELECT
TO authenticated
USING (is_active = true);


CREATE POLICY "Authenticated users can read active taluks"
ON public.taluks
FOR SELECT
TO authenticated
USING (is_active = true);


CREATE POLICY "Authenticated users can read active villages"
ON public.villages
FOR SELECT
TO authenticated
USING (is_active = true);


-- ============================================================
-- REFERENCE DATA — ADMINISTRATION
-- ============================================================

CREATE POLICY "Super admins manage states"
ON public.states
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "Super admins manage districts"
ON public.districts
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "Super admins manage taluks"
ON public.taluks
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "Super admins manage villages"
ON public.villages
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


-- ============================================================
-- PROFILES
-- ============================================================

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
);


CREATE POLICY "Super admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "State admins can read state profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "District staff can read district profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND district_id = public.user_district_id()
);


CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);


CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
);


-- ============================================================
-- LAND RECORDS
-- ============================================================

CREATE POLICY "Super admins manage all land records"
ON public.land_records
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "State admins read state land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "State admins insert state land records"
ON public.land_records
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "State admins update state land records"
ON public.land_records
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
)
WITH CHECK (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "District staff read district land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER',
        'VERIFICATION_OFFICER',
        'VIEWER'
    )
    AND district_id = public.user_district_id()
);


CREATE POLICY "District officers update district records"
ON public.land_records
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'DISTRICT_OFFICER'
    AND district_id = public.user_district_id()
)
WITH CHECK (
    public.user_role() = 'DISTRICT_OFFICER'
    AND district_id = public.user_district_id()
);


CREATE POLICY "Data entry officers create district records"
ON public.land_records
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
    AND district_id = public.user_district_id()
);


-- ============================================================
-- LAND OWNERS
-- ============================================================

CREATE POLICY "Authorized users read land owners"
ON public.land_owners
FOR SELECT
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER',
        'VERIFICATION_OFFICER',
        'VIEWER'
    )
);


CREATE POLICY "Authorized users create land owners"
ON public.land_owners
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
);


CREATE POLICY "Authorized users update land owners"
ON public.land_owners
FOR UPDATE
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
);


-- ============================================================
-- LAND RECORD OWNERS
-- ============================================================

CREATE POLICY "Users can read owners of accessible records"
ON public.land_record_owners
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.state_id = public.user_state_id()
        )
    )
    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'DATA_ENTRY_OFFICER',
            'VERIFICATION_OFFICER',
            'VIEWER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.district_id = public.user_district_id()
        )
    )
);


CREATE POLICY "Authorized users create record owners"
ON public.land_record_owners
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.state_id = public.user_state_id()
        )
    )
    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'DATA_ENTRY_OFFICER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.district_id = public.user_district_id()
        )
    )
);


CREATE POLICY "Authorized users update record owners"
ON public.land_record_owners
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.state_id = public.user_state_id()
        )
    )
    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'DATA_ENTRY_OFFICER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.district_id = public.user_district_id()
        )
    )
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.state_id = public.user_state_id()
        )
    )
    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'DATA_ENTRY_OFFICER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = land_record_owners.land_record_id
              AND lr.district_id = public.user_district_id()
        )
    )
);


-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE POLICY "Super admins manage all documents"
ON public.documents
FOR ALL
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
)
WITH CHECK (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "State admins read state documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "District staff read district documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER',
        'VERIFICATION_OFFICER',
        'VIEWER'
    )
    AND district_id = public.user_district_id()
);


CREATE POLICY "State admins create state documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "District staff create district documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
    AND district_id = public.user_district_id()
);


CREATE POLICY "State admins update state documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
)
WITH CHECK (
    public.user_role() = 'STATE_ADMIN'
    AND state_id = public.user_state_id()
);


CREATE POLICY "District officers update district documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
    public.user_role() = 'DISTRICT_OFFICER'
    AND district_id = public.user_district_id()
)
WITH CHECK (
    public.user_role() = 'DISTRICT_OFFICER'
    AND district_id = public.user_district_id()
);


-- ============================================================
-- DOCUMENT PAGES
-- ============================================================

CREATE POLICY "Users can read accessible document pages"
ON public.document_pages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = document_pages.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'DATA_ENTRY_OFFICER',
                      'VERIFICATION_OFFICER',
                      'VIEWER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Authorized staff create document pages"
ON public.document_pages
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = document_pages.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'DATA_ENTRY_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


-- ============================================================
-- EXTRACTED FIELDS
-- ============================================================

CREATE POLICY "Users can read accessible extracted fields"
ON public.extracted_fields
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = extracted_fields.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'DATA_ENTRY_OFFICER',
                      'VERIFICATION_OFFICER',
                      'VIEWER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Authorized staff create extracted fields"
ON public.extracted_fields
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = extracted_fields.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Verification staff update extracted fields"
ON public.extracted_fields
FOR UPDATE
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = extracted_fields.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
);


-- ============================================================
-- VERIFICATION TASKS
-- ============================================================

CREATE POLICY "Users can read scoped verification tasks"
ON public.verification_tasks
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = verification_tasks.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'DATA_ENTRY_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Authorized staff create verification tasks"
ON public.verification_tasks
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
    AND EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = verification_tasks.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'DATA_ENTRY_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Verification staff update tasks"
ON public.verification_tasks
FOR UPDATE
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
);


-- ============================================================
-- VERIFICATION ACTIONS
-- ============================================================

CREATE POLICY "Users can read scoped verification actions"
ON public.verification_actions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.verification_tasks vt
        JOIN public.documents d
            ON d.id = vt.document_id
        WHERE vt.id = verification_actions.verification_task_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER',
                      'DATA_ENTRY_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Verification staff create actions"
ON public.verification_actions
FOR INSERT
TO authenticated
WITH CHECK (
    actor_id = auth.uid()
    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND EXISTS (
        SELECT 1
        FROM public.verification_tasks vt
        JOIN public.documents d
            ON d.id = vt.document_id
        WHERE vt.id = verification_actions.verification_task_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND d.state_id = public.user_state_id()
              )
              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND d.district_id = public.user_district_id()
              )
          )
    )
);


-- ============================================================
-- DUPLICATE CANDIDATES
-- ============================================================

CREATE POLICY "Users can read scoped duplicate candidates"
ON public.duplicate_candidates
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'

    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records a
            JOIN public.land_records b
                ON b.id = duplicate_candidates.record_b_id
            WHERE a.id = duplicate_candidates.record_a_id
              AND a.state_id = public.user_state_id()
              AND b.state_id = public.user_state_id()
        )
    )

    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'VERIFICATION_OFFICER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records a
            JOIN public.land_records b
                ON b.id = duplicate_candidates.record_b_id
            WHERE a.id = duplicate_candidates.record_a_id
              AND a.district_id = public.user_district_id()
              AND b.district_id = public.user_district_id()
        )
    )
);


CREATE POLICY "Authorized staff manage duplicates"
ON public.duplicate_candidates
FOR ALL
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
);


-- ============================================================
-- RISK ASSESSMENTS
-- ============================================================

CREATE POLICY "Users can read scoped risk assessments"
ON public.risk_assessments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.land_records lr
        WHERE lr.id = risk_assessments.land_record_id
          AND (
              public.user_role() = 'SUPER_ADMIN'

              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND lr.state_id = public.user_state_id()
              )

              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER',
                      'VIEWER'
                  )
                  AND lr.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Authorized staff manage risk assessments"
ON public.risk_assessments
FOR ALL
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER'
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER'
    )
);


CREATE POLICY "Users can read scoped risk signals"
ON public.risk_signals
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.risk_assessments ra
        JOIN public.land_records lr
            ON lr.id = ra.land_record_id
        WHERE ra.id = risk_signals.risk_assessment_id
          AND (
              public.user_role() = 'SUPER_ADMIN'

              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND lr.state_id = public.user_state_id()
              )

              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER',
                      'VIEWER'
                  )
                  AND lr.district_id = public.user_district_id()
              )
          )
    )
);


-- ============================================================
-- RECORD CHANGES
-- ============================================================

CREATE POLICY "Users can read scoped record changes"
ON public.record_changes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.land_records lr
        WHERE lr.id = record_changes.land_record_id
          AND (
              public.user_role() = 'SUPER_ADMIN'

              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND lr.state_id = public.user_state_id()
              )

              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER',
                      'VIEWER'
                  )
                  AND lr.district_id = public.user_district_id()
              )
          )
    )
);


CREATE POLICY "Authorized users insert record changes"
ON public.record_changes
FOR INSERT
TO authenticated
WITH CHECK (
    changed_by = auth.uid()

    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )

    AND EXISTS (
        SELECT 1
        FROM public.land_records lr
        WHERE lr.id = record_changes.land_record_id
          AND (
              public.user_role() = 'SUPER_ADMIN'

              OR (
                  public.user_role() = 'STATE_ADMIN'
                  AND lr.state_id = public.user_state_id()
              )

              OR (
                  public.user_role() IN (
                      'DISTRICT_OFFICER',
                      'VERIFICATION_OFFICER'
                  )
                  AND lr.district_id = public.user_district_id()
              )
          )
    )
);


-- ============================================================
-- WATCHLISTS
-- ============================================================

CREATE POLICY "Users can read own watchlist"
ON public.watchlists
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);


CREATE POLICY "Users can create own watchlist"
ON public.watchlists
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()

    AND (
        public.user_role() = 'SUPER_ADMIN'

        OR (
            public.user_role() = 'STATE_ADMIN'
            AND EXISTS (
                SELECT 1
                FROM public.land_records lr
                WHERE lr.id = watchlists.land_record_id
                  AND lr.state_id = public.user_state_id()
            )
        )

        OR (
            public.user_role() IN (
                'DISTRICT_OFFICER',
                'DATA_ENTRY_OFFICER',
                'VERIFICATION_OFFICER',
                'VIEWER'
            )
            AND EXISTS (
                SELECT 1
                FROM public.land_records lr
                WHERE lr.id = watchlists.land_record_id
                  AND lr.district_id = public.user_district_id()
            )
        )
    )
);


CREATE POLICY "Users can update own watchlist"
ON public.watchlists
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);


CREATE POLICY "Users can delete own watchlist"
ON public.watchlists
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);


-- ============================================================
-- ALERTS
-- ============================================================

CREATE POLICY "Users can read scoped alerts"
ON public.alerts
FOR SELECT
TO authenticated
USING (
    land_record_id IS NULL

    OR public.user_role() = 'SUPER_ADMIN'

    OR (
        public.user_role() = 'STATE_ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = alerts.land_record_id
              AND lr.state_id = public.user_state_id()
        )
    )

    OR (
        public.user_role() IN (
            'DISTRICT_OFFICER',
            'DATA_ENTRY_OFFICER',
            'VERIFICATION_OFFICER',
            'VIEWER'
        )
        AND EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = alerts.land_record_id
              AND lr.district_id = public.user_district_id()
        )
    )
);


CREATE POLICY "Authorized staff manage alerts"
ON public.alerts
FOR ALL
TO authenticated
USING (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER'
    )
)
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER'
    )
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);


CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);


CREATE POLICY "Authorized users insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
);


-- ============================================================
-- AUDIT LOGS
-- ============================================================
-- Append-only:
-- There are intentionally NO UPDATE or DELETE policies.
-- ============================================================

CREATE POLICY "Super admins read all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
);


CREATE POLICY "State admins read state audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'STATE_ADMIN'
    AND (
        entity_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = audit_logs.entity_id
              AND lr.state_id = public.user_state_id()
        )
    )
);


CREATE POLICY "District officers read district audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    public.user_role() IN (
        'DISTRICT_OFFICER',
        'VERIFICATION_OFFICER'
    )
    AND (
        entity_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.land_records lr
            WHERE lr.id = audit_logs.entity_id
              AND lr.district_id = public.user_district_id()
        )
    )
);


CREATE POLICY "Authenticated users insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    actor_id = auth.uid()
    AND actor_role = public.user_role()
);


-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'bhoomi-documents',
    'bhoomi-documents',
    false,
    26214400,
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg'
    ]
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- STORAGE OBJECT POLICIES
-- ============================================================

CREATE POLICY "Authorized users upload Bhoomi documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
);


CREATE POLICY "Authenticated users read Bhoomi documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
);


CREATE POLICY "Authorized users update Bhoomi documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
)
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
);


CREATE POLICY "Authorized users delete Bhoomi documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() IN (
        'SUPER_ADMIN',
        'STATE_ADMIN',
        'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER'
    )
);


-- ============================================================
-- END OF INITIAL SCHEMA MIGRATION
-- ============================================================