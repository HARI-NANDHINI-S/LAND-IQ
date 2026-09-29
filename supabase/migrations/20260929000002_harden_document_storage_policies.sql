-- Keep document objects private and make object access follow document RLS.
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
    FALSE,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users read Bhoomi documents" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users upload Bhoomi documents" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users update Bhoomi documents" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users delete Bhoomi documents" ON storage.objects;

CREATE POLICY "Users read accessible Bhoomi documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
    AND (
        public.user_role() = 'SUPER_ADMIN'
        OR EXISTS (
            SELECT 1
            FROM public.documents d
            WHERE d.storage_path = storage.objects.name
        )
    )
);

CREATE POLICY "Scoped staff upload Bhoomi documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND (
        public.user_role() = 'SUPER_ADMIN'
        OR (
            split_part(name, '/', 1) = 'documents'
            AND EXISTS (
                SELECT 1
                FROM public.districts d
                WHERE d.id::TEXT = split_part(name, '/', 2)
                  AND d.is_active = TRUE
                  AND (
                      (
                          public.user_role() = 'STATE_ADMIN'
                          AND d.state_id = public.user_state_id()
                      )
                      OR (
                          public.user_role() IN ('DISTRICT_OFFICER', 'DATA_ENTRY_OFFICER')
                          AND d.id = public.user_district_id()
                      )
                  )
            )
        )
    )
);

CREATE POLICY "Authorized staff update accessible Bhoomi documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
    AND (
        public.user_role() = 'SUPER_ADMIN'
        OR (
            public.user_role() IN ('STATE_ADMIN', 'DISTRICT_OFFICER')
            AND EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE d.storage_path = storage.objects.name
            )
        )
    )
)
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND (
        public.user_role() = 'SUPER_ADMIN'
        OR (
            public.user_role() IN ('STATE_ADMIN', 'DISTRICT_OFFICER')
            AND EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE d.storage_path = storage.objects.name
            )
        )
    )
);

CREATE POLICY "Authorized users delete accessible Bhoomi documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'bhoomi-documents'
    AND (
        public.user_role() = 'SUPER_ADMIN'
        OR (
            owner_id = auth.uid()::TEXT
            AND split_part(name, '/', 1) = 'documents'
            AND NOT EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE d.storage_path = storage.objects.name
            )
            AND EXISTS (
                SELECT 1
                FROM public.districts d
                WHERE d.id::TEXT = split_part(name, '/', 2)
                  AND d.is_active = TRUE
                  AND (
                      (
                          public.user_role() = 'STATE_ADMIN'
                          AND d.state_id = public.user_state_id()
                      )
                      OR (
                          public.user_role() IN ('DISTRICT_OFFICER', 'DATA_ENTRY_OFFICER')
                          AND d.id = public.user_district_id()
                      )
                  )
            )
        )
    )
);