-- ============================================================
-- Create Settings Table
-- ============================================================

-- Ensure the shared updated_at trigger function exists before this migration uses it.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to public settings for all authenticated users
CREATE POLICY "Enable read access for all authenticated users to public settings"
ON public.settings FOR SELECT
TO authenticated
USING (is_public = true);

-- Allow full access to users with settings:manage permission
CREATE POLICY "Enable read access for all users with settings:manage"
ON public.settings FOR SELECT
TO authenticated
USING (public.has_permission('settings:manage'));

CREATE POLICY "Enable insert for users with settings:manage"
ON public.settings FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('settings:manage'));

CREATE POLICY "Enable update for users with settings:manage"
ON public.settings FOR UPDATE
TO authenticated
USING (public.has_permission('settings:manage'))
WITH CHECK (public.has_permission('settings:manage'));

CREATE POLICY "Enable delete for users with settings:manage"
ON public.settings FOR DELETE
TO authenticated
USING (public.has_permission('settings:manage'));

-- Add triggers for updated_at
CREATE OR REPLACE TRIGGER trigger_set_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Add default settings
INSERT INTO public.settings (key, value, description, is_public) VALUES
('platform_name', '"LAND-IQ"', 'Name of the platform', true),
('maintenance_mode', 'false', 'Whether the platform is in maintenance mode', true),
('default_language', '"en"', 'Default language for the platform', true),
('max_upload_size_mb', '50', 'Maximum file upload size in MB', true)
ON CONFLICT (key) DO NOTHING;
