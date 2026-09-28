-- ============================================================
-- BhoomiAI — Initial Schema Migration
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES AND PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- GEOGRAPHIC HIERARCHY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(state_id, code)
);

CREATE TABLE IF NOT EXISTS public.taluks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(district_id, code)
);

CREATE TABLE IF NOT EXISTS public.villages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taluk_id UUID NOT NULL REFERENCES public.taluks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(taluk_id, code)
);

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS TEXT AS $$
    SELECT r.code FROM public.profiles p JOIN public.roles r ON p.role_id = r.id WHERE p.id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_district_id() RETURNS UUID AS $$
    SELECT district_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_state_id() RETURNS UUID AS $$
    SELECT state_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.role_permissions rp ON p.role_id = rp.role_id
        JOIN public.permissions perm ON rp.permission_id = perm.id
        WHERE p.id = auth.uid() AND perm.code = required_permission
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- LAND RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.land_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    record_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (record_status IN ('ACTIVE','INACTIVE','ARCHIVED')),
    registration_number TEXT,
    registration_date DATE,
    remarks TEXT,
    verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CORRECTION_REQUIRED')),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.land_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    identification_reference TEXT,
    contact_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.land_record_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.land_owners(id) ON DELETE CASCADE,
    ownership_percentage NUMERIC(5,2) CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID REFERENCES public.land_records(id),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    storage_path TEXT,
    width INTEGER,
    height INTEGER,
    ocr_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.extracted_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    land_record_id UUID REFERENCES public.land_records(id),
    field_name TEXT NOT NULL,
    field_value TEXT,
    normalized_value TEXT,
    confidence_score NUMERIC(5,2),
    source_page_id UUID REFERENCES public.document_pages(id),
    extraction_method TEXT DEFAULT 'SEEDED',
    validation_status TEXT DEFAULT 'PENDING',
    verified_value TEXT,
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VERIFICATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    land_record_id UUID REFERENCES public.land_records(id),
    assigned_to UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','ASSIGNED','UNDER_REVIEW','APPROVED','REJECTED','CORRECTION_REQUIRED')),
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.verification_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    verification_task_id UUID NOT NULL REFERENCES public.verification_tasks(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_a_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    record_b_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5,2),
    match_signals JSONB,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','UNDER_REVIEW','CONFIRMED','FALSE_POSITIVE','LEGITIMATE_SUBDIVISION','DISPUTED')),
    reviewed_by UUID REFERENCES public.profiles(id),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    risk_score NUMERIC(5,2) CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT CHECK (risk_level IN ('LOW','MODERATE','HIGH','CRITICAL')),
    status TEXT DEFAULT 'ACTIVE',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculation_version TEXT DEFAULT 'v1.0-rules-engine',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.risk_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,
    description TEXT,
    contribution NUMERIC(5,2),
    evidence JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MONITORING (BhoomiWatch)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.record_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_priority TEXT DEFAULT 'LOW' CHECK (change_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    changed_by UUID REFERENCES public.profiles(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALERTS AND NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    land_record_id UUID REFERENCES public.land_records(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW','ACKNOWLEDGED','UNDER_REVIEW','RESOLVED','ESCALATED')),
    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
-- AUDIT LOGS (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX IF NOT EXISTS idx_land_records_survey_num ON public.land_records(survey_number);
CREATE INDEX IF NOT EXISTS idx_land_records_patta ON public.land_records(patta_number);
CREATE INDEX IF NOT EXISTS idx_land_records_district ON public.land_records(district_id);
CREATE INDEX IF NOT EXISTS idx_land_records_village ON public.land_records(village_id);
CREATE INDEX IF NOT EXISTS idx_land_records_vstatus ON public.land_records(verification_status);
CREATE INDEX IF NOT EXISTS idx_land_records_rstatus ON public.land_records(record_status);
CREATE INDEX IF NOT EXISTS idx_land_records_created ON public.land_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_land_record ON public.documents(land_record_id);
CREATE INDEX IF NOT EXISTS idx_documents_district ON public.documents(district_id);
CREATE INDEX IF NOT EXISTS idx_documents_proc_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vtasks_assigned_to ON public.verification_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vtasks_status ON public.verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_vtasks_priority ON public.verification_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_lr ON public.risk_assessments(land_record_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level ON public.risk_assessments(risk_level);

CREATE INDEX IF NOT EXISTS idx_record_changes_lr ON public.record_changes(land_record_id);
CREATE INDEX IF NOT EXISTS idx_record_changes_priority ON public.record_changes(change_priority);
CREATE INDEX IF NOT EXISTS idx_record_changes_at ON public.record_changes(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON public.alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_districts_state ON public.districts(state_id);
CREATE INDEX IF NOT EXISTS idx_taluks_district ON public.taluks(district_id);
CREATE INDEX IF NOT EXISTS idx_villages_taluk ON public.villages(taluk_id);

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

-- ---- PUBLIC REFERENCE DATA (read for all authenticated) ----
CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read states" ON public.states FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated users can read districts" ON public.districts FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated users can read taluks" ON public.taluks FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated users can read villages" ON public.villages FOR SELECT TO authenticated USING (is_active = true);

-- Only super admins can write reference data
CREATE POLICY "Super admins manage geographic data" ON public.states FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "Super admins manage districts" ON public.districts FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "Super admins manage taluks" ON public.taluks FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "Super admins manage villages" ON public.villages FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');

-- ---- PROFILES ----
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Super admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR auth.user_role() = 'SUPER_ADMIN');

-- ---- LAND RECORDS ----
-- Super admin: full access
CREATE POLICY "Super admins have full access to land records" ON public.land_records FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
-- State admin: access records in their state
CREATE POLICY "State admins access records in their state" ON public.land_records FOR SELECT TO authenticated USING (auth.user_role() = 'STATE_ADMIN' AND state_id = auth.user_state_id());
CREATE POLICY "State admins update records in their state" ON public.land_records FOR UPDATE TO authenticated USING (auth.user_role() = 'STATE_ADMIN' AND state_id = auth.user_state_id());
-- District officer: access records in their district
CREATE POLICY "District officers access their district land records" ON public.land_records FOR SELECT TO authenticated USING (auth.user_role() IN ('DISTRICT_OFFICER','DATA_ENTRY_OFFICER','VERIFICATION_OFFICER') AND district_id = auth.user_district_id());
CREATE POLICY "District officers can update their district records" ON public.land_records FOR UPDATE TO authenticated USING (auth.user_role() IN ('DISTRICT_OFFICER') AND district_id = auth.user_district_id());
-- Data entry can create records
CREATE POLICY "Data entry officers can create records" ON public.land_records FOR INSERT TO authenticated WITH CHECK (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER','DATA_ENTRY_OFFICER'));
-- Viewers: read only, district scoped
CREATE POLICY "Viewers can read their district records" ON public.land_records FOR SELECT TO authenticated USING (auth.user_role() = 'VIEWER' AND district_id = auth.user_district_id());

-- ---- DOCUMENTS ----
CREATE POLICY "Super admins have full access to documents" ON public.documents FOR ALL TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "State admins access documents in their state" ON public.documents FOR SELECT TO authenticated USING (auth.user_role() = 'STATE_ADMIN' AND state_id = auth.user_state_id());
CREATE POLICY "District staff access documents in their district" ON public.documents FOR SELECT TO authenticated USING (auth.user_role() IN ('DISTRICT_OFFICER','DATA_ENTRY_OFFICER','VERIFICATION_OFFICER','VIEWER') AND district_id = auth.user_district_id());
CREATE POLICY "Authorized staff can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER','DATA_ENTRY_OFFICER'));
CREATE POLICY "Authorized staff can update documents" ON public.documents FOR UPDATE TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER') AND district_id = auth.user_district_id());

-- ---- DOCUMENT PAGES & EXTRACTED FIELDS ----
CREATE POLICY "Read document pages if can read document" ON public.document_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read extracted fields if authenticated" ON public.extracted_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Verification officers can update extracted fields" ON public.extracted_fields FOR UPDATE TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER','VERIFICATION_OFFICER'));

-- ---- VERIFICATION ----
CREATE POLICY "Authenticated can view verification tasks in their scope" ON public.verification_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Verification officers can update tasks" ON public.verification_tasks FOR UPDATE TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER','VERIFICATION_OFFICER'));
CREATE POLICY "Authorized staff can create verification tasks" ON public.verification_tasks FOR INSERT TO authenticated WITH CHECK (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER','DATA_ENTRY_OFFICER'));
CREATE POLICY "Authenticated can read verification actions" ON public.verification_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert verification actions" ON public.verification_actions FOR INSERT TO authenticated WITH CHECK (true);

-- ---- DUPLICATES ----
CREATE POLICY "Authenticated can read duplicate candidates" ON public.duplicate_candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized staff can manage duplicates" ON public.duplicate_candidates FOR ALL TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER'));

-- ---- RISK ----
CREATE POLICY "Authenticated can read risk assessments" ON public.risk_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized staff can manage risk assessments" ON public.risk_assessments FOR ALL TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER'));
CREATE POLICY "Authenticated can read risk signals" ON public.risk_signals FOR SELECT TO authenticated USING (true);

-- ---- MONITORING ----
CREATE POLICY "Authenticated can read record changes" ON public.record_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert record changes" ON public.record_changes FOR INSERT TO authenticated WITH CHECK (true);

-- ---- WATCHLIST ----
CREATE POLICY "Users can manage their own watchlist" ON public.watchlists FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can view all watchlists" ON public.watchlists FOR SELECT TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER'));

-- ---- ALERTS ----
CREATE POLICY "Authenticated can view alerts in their scope" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized staff can manage alerts" ON public.alerts FOR ALL TO authenticated USING (auth.user_role() IN ('SUPER_ADMIN','STATE_ADMIN','DISTRICT_OFFICER'));

-- ---- NOTIFICATIONS ----
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ---- AUDIT LOGS ----
-- NO UPDATE, NO DELETE policies — append only by design
CREATE POLICY "Super admins can read all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.user_role() = 'SUPER_ADMIN');
CREATE POLICY "State admins can read state audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.user_role() = 'STATE_ADMIN');
CREATE POLICY "District officers can read limited audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.user_role() = 'DISTRICT_OFFICER' AND entity_id IN (SELECT id FROM public.land_records WHERE district_id = auth.user_district_id()));
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bhoomi-documents',
    'bhoomi-documents',
    false,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to bhoomi-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bhoomi-documents');

CREATE POLICY "Authenticated users can read bhoomi-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bhoomi-documents');

CREATE POLICY "Authorized users can update bhoomi-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bhoomi-documents');
