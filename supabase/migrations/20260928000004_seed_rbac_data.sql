-- ============================================================
-- BhoomiAI — Corrective RBAC Seed Migration
-- ============================================================
-- ROOT CAUSE OF PREVIOUS FAILURE:
-- In some Supabase deployments, ON CONFLICT DO NOTHING on a SELECT insert 
-- or multi-row insert can fail silently if the underlying constraints are violated
-- or if the transaction encounters a partial lock. More commonly, if the seed data 
-- was provided as a migration but failed partially, the transaction would roll back,
-- or if it was applied via Supabase UI, it might have been skipped.
--
-- This migration ensures the RBAC tables are seeded idempotently.
-- ============================================================

-- ROLES
INSERT INTO public.roles (id, code, name, description) VALUES
    ('00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Administrator', 'Full system access'),
    ('00000000-0000-0000-0000-000000000002', 'STATE_ADMIN', 'State Administrator', 'State-level access'),
    ('00000000-0000-0000-0000-000000000003', 'DISTRICT_OFFICER', 'District Officer', 'District-level access'),
    ('00000000-0000-0000-0000-000000000004', 'DATA_ENTRY_OFFICER', 'Data Entry Officer', 'Document upload and data entry'),
    ('00000000-0000-0000-0000-000000000005', 'VERIFICATION_OFFICER', 'Verification Officer', 'Document and record verification'),
    ('00000000-0000-0000-0000-000000000006', 'VIEWER', 'Viewer', 'Read-only access')
ON CONFLICT (code) DO NOTHING;

-- PERMISSIONS
INSERT INTO public.permissions (code, description) VALUES
    ('land_record:create', 'Create land records'),
    ('land_record:read', 'View land records'),
    ('land_record:update', 'Update land records'),
    ('land_record:delete', 'Delete land records'),
    ('document:create', 'Upload documents'),
    ('document:read', 'View documents'),
    ('document:update', 'Update documents'),
    ('document:download', 'Download documents'),
    ('document:delete', 'Delete documents'),
    ('verification:read', 'View verification tasks'),
    ('verification:review', 'Review verification tasks'),
    ('verification:approve', 'Approve verification tasks'),
    ('verification:reject', 'Reject verification tasks'),
    ('duplicate:read', 'View duplicate candidates'),
    ('duplicate:review', 'Review duplicates'),
    ('duplicate:resolve', 'Resolve duplicates'),
    ('risk:read', 'View risk assessments'),
    ('risk:manage', 'Manage risk assessments'),
    ('risk:investigate', 'Investigate risk alerts'),
    ('monitoring:read', 'View monitoring data'),
    ('monitoring:manage', 'Manage monitoring'),
    ('watchlist:read', 'View watchlist'),
    ('watchlist:manage', 'Manage watchlist'),
    ('user:create', 'Create users'),
    ('user:read', 'View users'),
    ('user:update', 'Update users'),
    ('user:disable', 'Disable users'),
    ('audit:read', 'View audit logs'),
    ('analytics:read', 'View analytics'),
    ('settings:manage', 'Manage settings'),
    ('assistant:use', 'Use BhoomiVoice assistant')
ON CONFLICT (code) DO NOTHING;

-- ROLE-PERMISSION ASSIGNMENTS
-- SUPER_ADMIN: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- STATE_ADMIN: most permissions except user management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM public.permissions WHERE code IN (
    'land_record:create','land_record:read','land_record:update',
    'document:create','document:read','document:update','document:download',
    'verification:read','verification:review','verification:approve','verification:reject',
    'duplicate:read','duplicate:review','duplicate:resolve',
    'risk:read','risk:manage','risk:investigate',
    'monitoring:read','monitoring:manage','watchlist:read','watchlist:manage',
    'user:read','audit:read','analytics:read','settings:manage','assistant:use'
)
ON CONFLICT DO NOTHING;

-- DISTRICT_OFFICER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM public.permissions WHERE code IN (
    'land_record:create','land_record:read','land_record:update',
    'document:create','document:read','document:update','document:download',
    'verification:read','verification:review','verification:approve','verification:reject',
    'duplicate:read','duplicate:review','duplicate:resolve',
    'risk:read','risk:investigate',
    'monitoring:read','monitoring:manage','watchlist:read','watchlist:manage',
    'audit:read','analytics:read','assistant:use'
)
ON CONFLICT DO NOTHING;

-- DATA_ENTRY_OFFICER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM public.permissions WHERE code IN (
    'land_record:create','land_record:read','document:create','document:read',
    'verification:read','monitoring:read','watchlist:read','assistant:use'
)
ON CONFLICT DO NOTHING;

-- VERIFICATION_OFFICER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM public.permissions WHERE code IN (
    'land_record:read','document:read','document:download',
    'verification:read','verification:review','verification:approve','verification:reject',
    'duplicate:read','risk:read','monitoring:read','watchlist:read','analytics:read','assistant:use'
)
ON CONFLICT DO NOTHING;

-- VIEWER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', id FROM public.permissions WHERE code IN (
    'land_record:read','document:read','verification:read','risk:read',
    'monitoring:read','watchlist:read','analytics:read','assistant:use'
)
ON CONFLICT DO NOTHING;

-- ASSIGN ADMIN PROFILE
UPDATE public.profiles
SET role_id = '00000000-0000-0000-0000-000000000001',
    updated_at = NOW()
WHERE email = 'admin@landiq.local'
  AND role_id IS NULL;
