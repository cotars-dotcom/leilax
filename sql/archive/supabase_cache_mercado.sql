-- Tabela de cache de mercado (pesquisas ChatGPT)
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cache_mercado (
  chave         TEXT PRIMARY KEY,
  dados         JSONB,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: permitir acesso autenticado
ALTER TABLE public.cache_mercado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache_mercado_auth" ON public.cache_mercado
  FOR ALL USING (auth.role() = 'authenticated');
