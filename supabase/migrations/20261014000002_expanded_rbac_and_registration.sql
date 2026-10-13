-- ============================================================
-- MIGRATION: 20261014000002_expanded_rbac_and_registration.sql
-- Expanded Roles, Fine-Grained Permissions, and Self-Registration
-- ============================================================

-- 1. SEED EXPANDED ROLES
INSERT INTO public.roles (id, code, name, description) VALUES
    ('00000000-0000-0000-0000-000000000007', 'CUSTOMER', 'Customer / Landowner', 'Self-service customer portal, document submission, and tracking'),
    ('00000000-0000-0000-0000-000000000008', 'GIS_ANALYST', 'GIS Analyst', 'GIS mapping, spatial analysis, boundary and parcel verification'),
    ('00000000-0000-0000-0000-000000000009', 'RISK_ANALYST', 'Risk Analyst', 'Risk intelligence, duplicate analysis, anomaly investigation'),
    ('00000000-0000-0000-0000-000000000010', 'AUDITOR', 'Read-Only Auditor', 'Auditing, compliance monitoring, and historical logs')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. SEED PERMISSIONS
INSERT INTO public.permissions (code, description) VALUES
    ('gis:read', 'View GIS maps and spatial records'),
    ('gis:export', 'Export GIS geospatial datasets'),
    ('customer:portal', 'Access customer self-service portal')
ON CONFLICT (code) DO NOTHING;

-- 3. ENSURE SUPER_ADMIN HAS ALL PERMISSIONS (Strict security contract requirement)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM public.permissions
ON CONFLICT DO NOTHING;

-- 4. ASSIGN ROLE PERMISSIONS FOR NEW ROLES
-- CUSTOMER permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000007', id
FROM public.permissions
WHERE code IN (
    'document:create', 'document:read', 'document:download',
    'land_record:read', 'customer:portal', 'assistant:use'
)
ON CONFLICT DO NOTHING;

-- GIS_ANALYST permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000008', id
FROM public.permissions
WHERE code IN (
    'land_record:read', 'document:read', 'document:download',
    'gis:read', 'gis:export', 'analytics:read', 'assistant:use'
)
ON CONFLICT DO NOTHING;

-- RISK_ANALYST permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000009', id
FROM public.permissions
WHERE code IN (
    'risk:read', 'risk:manage', 'risk:investigate',
    'duplicate:read', 'duplicate:review', 'duplicate:resolve',
    'land_record:read', 'document:read', 'document:download',
    'monitoring:read', 'watchlist:read', 'analytics:read', 'assistant:use'
)
ON CONFLICT DO NOTHING;

-- AUDITOR permissions (strictly read-only)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.permissions
WHERE code IN (
    'audit:read', 'land_record:read', 'document:read',
    'verification:read', 'risk:read', 'monitoring:read', 'analytics:read'
)
ON CONFLICT DO NOTHING;


-- 5. HARDENED GEOGRAPHIC SCOPE FUNCTION (SECURITY DEFINER, search_path = public, pg_temp)
CREATE OR REPLACE FUNCTION public.can_access_geographic_scope(
    p_state_id UUID,
    p_district_id UUID,
    p_village_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE public.user_role()
        WHEN 'SUPER_ADMIN' THEN TRUE
        WHEN 'STATE_ADMIN' THEN p_state_id = public.user_state_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DISTRICT_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DATA_ENTRY_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VERIFICATION_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VIEWER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'AUDITOR' THEN (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'GIS_ANALYST' THEN (public.user_state_id() IS NULL OR p_state_id = public.user_state_id())
            AND (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'RISK_ANALYST' THEN (public.user_state_id() IS NULL OR p_state_id = public.user_state_id())
            AND (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'CUSTOMER' THEN TRUE -- Access restricted by ownership / uploader / status policies
        ELSE FALSE
    END;
$$;

REVOKE ALL ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) TO authenticated;


-- 6. REAL REGISTRATION TRIGGER: IDEMPOTENT PROFILE INITIALIZATION WITH LEAST-PRIVILEGE ROLE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_role_id UUID;
    v_full_name TEXT;
    v_state_id UUID := NULL;
    v_district_id UUID := NULL;
BEGIN
    -- Least-privileged default role: CUSTOMER
    SELECT id INTO v_customer_role_id
    FROM public.roles
    WHERE code = 'CUSTOMER'
    LIMIT 1;

    -- Extract full name
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        'User'
    );

    -- Parse state_id if valid UUID provided in signup metadata
    IF NEW.raw_user_meta_data->>'state_id' IS NOT NULL AND NEW.raw_user_meta_data->>'state_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_state_id FROM public.states WHERE id = (NEW.raw_user_meta_data->>'state_id')::UUID AND is_active = TRUE;
    END IF;

    -- Parse district_id if valid UUID provided in signup metadata
    IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_district_id FROM public.districts WHERE id = (NEW.raw_user_meta_data->>'district_id')::UUID AND is_active = TRUE;
    END IF;

    -- Idempotent profile creation
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role_id,
        state_id,
        district_id,
        is_active
    )
    VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        v_customer_role_id,
        v_state_id,
        v_district_id,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN profiles.full_name = 'New User' OR profiles.full_name = '' 
            THEN EXCLUDED.full_name 
            ELSE profiles.full_name 
        END,
        role_id = COALESCE(profiles.role_id, EXCLUDED.role_id),
        state_id = COALESCE(profiles.state_id, EXCLUDED.state_id),
        district_id = COALESCE(profiles.district_id, EXCLUDED.district_id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- 7. DOCUMENTS RLS POLICIES FOR CUSTOMERS AND SPECIALIZED ROLES
DROP POLICY IF EXISTS "Customers read own documents" ON public.documents;
CREATE POLICY "Customers read own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'CUSTOMER'
    AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS "Customers create own documents" ON public.documents;
CREATE POLICY "Customers create own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() = 'CUSTOMER'
    AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS "GIS analysts read documents" ON public.documents;
CREATE POLICY "GIS analysts read documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'GIS_ANALYST'
);

DROP POLICY IF EXISTS "Risk analysts read documents" ON public.documents;
CREATE POLICY "Risk analysts read documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'RISK_ANALYST'
);

DROP POLICY IF EXISTS "Auditors read documents" ON public.documents;
CREATE POLICY "Auditors read documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'AUDITOR'
);


-- 8. DOCUMENT PAGES & EXTRACTED FIELDS ACCESS FOR CUSTOMERS
DROP POLICY IF EXISTS "Customers read own document pages" ON public.document_pages;
CREATE POLICY "Customers read own document pages"
ON public.document_pages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_pages.document_id
          AND d.uploaded_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Customers read own extracted fields" ON public.extracted_fields;
CREATE POLICY "Customers read own extracted fields"
ON public.extracted_fields
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = extracted_fields.document_id
          AND d.uploaded_by = auth.uid()
    )
);


-- 9. VERIFICATION TASKS ACCESS FOR CUSTOMERS
DROP POLICY IF EXISTS "Customers read own verification tasks" ON public.verification_tasks;
CREATE POLICY "Customers read own verification tasks"
ON public.verification_tasks
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = verification_tasks.document_id
          AND d.uploaded_by = auth.uid()
    )
);


-- 10. LAND RECORDS POLICIES FOR NEW ROLES & CUSTOMERS
DROP POLICY IF EXISTS "Customers read verified land records" ON public.land_records;
CREATE POLICY "Customers read verified land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'CUSTOMER'
    AND record_status = 'ACTIVE'
    AND verification_status = 'APPROVED'
);

DROP POLICY IF EXISTS "GIS analysts read land records" ON public.land_records;
CREATE POLICY "GIS analysts read land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'GIS_ANALYST'
);

DROP POLICY IF EXISTS "Risk analysts read land records" ON public.land_records;
CREATE POLICY "Risk analysts read land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'RISK_ANALYST'
);

DROP POLICY IF EXISTS "Auditors read land records" ON public.land_records;
CREATE POLICY "Auditors read land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() = 'AUDITOR'
);


-- 11. STORAGE BUCKET UPLOAD POLICY FOR CUSTOMER DOCUMENTS
DROP POLICY IF EXISTS "Customers upload Bhoomi documents" ON storage.objects;
CREATE POLICY "Customers upload Bhoomi documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() = 'CUSTOMER'
    AND split_part(name, '/', 1) = 'documents'
);
