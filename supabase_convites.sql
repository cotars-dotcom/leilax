-- AXIS Platform — Tabela de Convites
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.convites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  criado_por  UUID REFERENCES public.profiles(id),
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  expira_em   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  usado       BOOLEAN DEFAULT false,
  usado_por   UUID REFERENCES public.profiles(id),
  usado_em    TIMESTAMPTZ,
  role        TEXT DEFAULT 'member' CHECK (role IN ('member','viewer')),
  nome        TEXT,
  nome_dest   TEXT,
  email       TEXT,
  email_dest  TEXT,
  observacoes TEXT
);

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY "convites_admin_all" ON public.convites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Qualquer autenticado pode ler convites pelo token (para validação)
CREATE POLICY "convites_read_by_token" ON public.convites
  FOR SELECT USING (auth.uid() IS NOT NULL);
