-- ══════════════════════════════════════════════════════════════════════
-- AXIS IP — Sprint 10 Migration
-- Tabela shared_links + coluna fallback _shared_link
-- ══════════════════════════════════════════════════════════════════════

-- 1. Tabela shared_links para links públicos de compartilhamento
CREATE TABLE IF NOT EXISTS shared_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  criado_por UUID REFERENCES auth.users(id),
  expira_em TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT shared_links_imovel_unique UNIQUE (imovel_id)
);

-- 2. Coluna fallback no imoveis (caso shared_links não exista/falhe)
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _shared_link TEXT;

-- 3. RLS para shared_links
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Leitura pública por token (sem auth necessário)
CREATE POLICY "shared_links_public_read" ON shared_links
  FOR SELECT USING (ativo = true AND expira_em > now());

-- Admin pode criar/editar
CREATE POLICY "shared_links_auth_write" ON shared_links
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. Índice para busca por token
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_imovel ON shared_links(imovel_id);

-- 5. Índice para busca de leilões pendentes (Sprint 10 — PainelPosLeilao)
CREATE INDEX IF NOT EXISTS idx_imoveis_data_leilao ON imoveis(data_leilao)
  WHERE status_operacional = 'ativo' OR status_operacional IS NULL;
