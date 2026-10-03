-- ============================================================
-- BHOOMIVOICE SESSIONS & HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bhoomivoice_sessions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ta')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bhoomivoice_messages (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.bhoomivoice_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    response_type TEXT DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.bhoomivoice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bhoomivoice_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON public.bhoomivoice_sessions
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own messages" ON public.bhoomivoice_messages
    FOR ALL TO authenticated USING (
        session_id IN (SELECT id FROM public.bhoomivoice_sessions WHERE user_id = auth.uid())
    ) WITH CHECK (
        session_id IN (SELECT id FROM public.bhoomivoice_sessions WHERE user_id = auth.uid())
    );
