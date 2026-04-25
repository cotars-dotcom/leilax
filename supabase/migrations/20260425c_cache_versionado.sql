-- Sprint 41d-Bx: adicionar schema_version no cache_mercado
-- Antes deste commit, entries antigas eram servidas como válidas mesmo após
-- mudanças incompatíveis no formato do objeto `dados`. Agora cada gravação
-- carimba a versão; leituras que não batem com SCHEMA_VERSION atual são
-- ignoradas e limpas pelo job manual.

ALTER TABLE cache_mercado
  ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Atualizar entries antigas (sem schema_version) para 1
UPDATE cache_mercado SET schema_version = 1 WHERE schema_version IS NULL;

-- Índice para limpeza eficiente por versão
CREATE INDEX IF NOT EXISTS idx_cache_mercado_schema ON cache_mercado (schema_version);
CREATE INDEX IF NOT EXISTS idx_cache_mercado_expira ON cache_mercado (expira_em);

COMMENT ON COLUMN cache_mercado.schema_version IS
  'Versão do schema de dados — bump em mudanças incompatíveis. Definido em src/lib/cacheVersionado.js';
