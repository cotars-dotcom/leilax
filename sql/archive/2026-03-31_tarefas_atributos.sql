-- ================================================================
-- AXIS Platform — Migration 2026-03-31
-- Executar em: Supabase → SQL Editor → Run
-- Todas as colunas usam IF NOT EXISTS (idempotente)
-- ================================================================

-- 1. Tarefas: associação com imóvel
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS imovel_id UUID REFERENCES imoveis(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_imovel_id ON tarefas(imovel_id) WHERE imovel_id IS NOT NULL;

-- 2. Imoveis: atributos do prédio
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS portaria_24h BOOLEAN;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS mobiliado TEXT;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS padrao_acabamento TEXT;

-- 3. Imoveis: campos Gemini Vision
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _correcoes_vision JSONB;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _vision_observacoes TEXT;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _vision_estado TEXT;

-- 4. Imoveis: dados AXIS calibrados
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _dados_bairro_axis JSONB;
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _score_axis_patrimonial NUMERIC(5,2);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _gap_asking_closing_pct NUMERIC(5,1);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _preco_asking_m2 NUMERIC(10,2);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _preco_closing_m2 NUMERIC(10,2);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _axis_yield NUMERIC(5,2);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _axis_tendencia NUMERIC(6,2);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _axis_demanda TEXT;

-- 5. Imoveis: mercado direto
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS desconto_sobre_mercado_pct_calculado NUMERIC(5,1);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS _modelo_usado TEXT;

-- 6. Verificação
SELECT 'tarefas.imovel_id' as campo, data_type FROM information_schema.columns WHERE table_name='tarefas' AND column_name='imovel_id'
UNION ALL
SELECT 'imoveis.portaria_24h', data_type FROM information_schema.columns WHERE table_name='imoveis' AND column_name='portaria_24h'
UNION ALL
SELECT 'imoveis.mobiliado', data_type FROM information_schema.columns WHERE table_name='imoveis' AND column_name='mobiliado'
UNION ALL
SELECT 'imoveis._dados_bairro_axis', data_type FROM information_schema.columns WHERE table_name='imoveis' AND column_name='_dados_bairro_axis'
UNION ALL
SELECT 'imoveis._correcoes_vision', data_type FROM information_schema.columns WHERE table_name='imoveis' AND column_name='_correcoes_vision';
