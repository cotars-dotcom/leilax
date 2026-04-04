-- ================================================================
-- AXIS — Patch de Dados RMBH Q1/2026
-- Fonte: Pesquisa complementar abr/2026
-- Fontes primárias: FipeZAP, QuintoAndar, Sinduscon-MG, SINAPI,
--   Secovi-MG, STJ, TJMG, Caixa, CBIC
-- ================================================================

-- ═══ 1. CUSTOS DE CONSTRUÇÃO (referência para custo de reposição) ═══

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS custos_construcao (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor_m2 NUMERIC(10,2) NOT NULL,
  variacao_12m_pct NUMERIC(6,2),
  fonte TEXT,
  referencia_mes TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO custos_construcao (id, descricao, valor_m2, variacao_12m_pct, fonte, referencia_mes)
VALUES
  ('cub_r8n_mg', 'CUB R8-N MG — Residencial multifamiliar normal', 2504.80, 7.85, 'Sinduscon-MG', '2026-01'),
  ('cub_r1n_mg', 'CUB R1-N MG — Residencial unifamiliar normal', 2838.67, NULL, 'Sinduscon-MG', '2026-01'),
  ('sinapi_mg', 'SINAPI MG — Custo médio construção', 1811.56, 7.50, 'IBGE/Caixa', '2025-12'),
  ('sinapi_sudeste', 'SINAPI Sudeste — Custo regional', 1942.83, NULL, 'IBGE/Caixa', '2026-01'),
  ('sinapi_nacional', 'SINAPI Nacional — Custo médio Brasil', 1920.74, 5.63, 'IBGE/Caixa', '2026-01'),
  ('sinapi_mao_obra', 'SINAPI — Componente mão de obra', 813.24, NULL, 'IBGE/Caixa', '2025-12'),
  ('sinapi_materiais', 'SINAPI — Componente materiais', 1078.39, NULL, 'IBGE/Caixa', '2025-12')
ON CONFLICT (id) DO UPDATE SET
  valor_m2 = EXCLUDED.valor_m2,
  variacao_12m_pct = EXCLUDED.variacao_12m_pct,
  fonte = EXCLUDED.fonte,
  referencia_mes = EXCLUDED.referencia_mes,
  atualizado_em = NOW();

-- ═══ 2. MERCADO REGIONAL — Atualizar BH com dados FipeZAP fev/2026 ═══

UPDATE mercado_regional SET
  preco_m2_venda_medio = 10595.00,
  preco_m2_locacao = 48.28,
  tendencia_pct_12m = 9.06,
  yield_bruto_pct = 5.96,
  fonte = 'FipeZAP fev/2026 + Secovi-MG 1T/2026',
  atualizado_em = NOW()
WHERE regiao_key = 'bh_geral' OR regiao_key = 'belo_horizonte';

-- Atualizar bairros específicos com dados de venda (Secovi-MG 1T/2026)
UPDATE mercado_regional SET preco_m2_venda_medio = 18053, atualizado_em = NOW(), fonte = 'FipeZAP fev/2026'
WHERE regiao_key = 'bh_savassi';

UPDATE mercado_regional SET preco_m2_venda_medio = 16253, atualizado_em = NOW(), fonte = 'FipeZAP fev/2026'
WHERE regiao_key = 'bh_santo_agostinho';

-- ═══ 3. MÉTRICAS DE ALUGUEL POR BAIRRO (QuintoAndar 2025) ═══

CREATE TABLE IF NOT EXISTS metricas_aluguel_bairro (
  bairro TEXT PRIMARY KEY,
  cidade TEXT DEFAULT 'Belo Horizonte',
  variacao_12m_pct NUMERIC(6,2),
  preco_m2_aluguel NUMERIC(8,2),
  fonte TEXT DEFAULT 'QuintoAndar 2025',
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO metricas_aluguel_bairro (bairro, variacao_12m_pct) VALUES
  ('Barro Preto', 47.7), ('São Pedro', 46.8), ('Santa Efigênia', 41.8),
  ('Centro', 39.9), ('Anchieta', 33.7), ('Serra', 33.1),
  ('Santo Agostinho', 31.7), ('Sagrada Família', 28.5),
  ('Santa Mônica', 27.3), ('Prado', 26.3),
  ('Funcionários', -6.9), ('Luxemburgo', -4.2), ('Camargos', -1.7)
ON CONFLICT (bairro) DO UPDATE SET
  variacao_12m_pct = EXCLUDED.variacao_12m_pct,
  atualizado_em = NOW();

-- Preço médio aluguel por tipologia (FipeZAP fev/2026)
CREATE TABLE IF NOT EXISTS metricas_aluguel_tipologia (
  tipologia TEXT PRIMARY KEY,
  cidade TEXT DEFAULT 'Belo Horizonte',
  preco_m2 NUMERIC(8,2),
  variacao_12m_pct NUMERIC(6,2),
  fonte TEXT DEFAULT 'FipeZAP fev/2026',
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO metricas_aluguel_tipologia (tipologia, preco_m2, variacao_12m_pct) VALUES
  ('1_quarto', 65.60, 15.15),
  ('2_quartos', 42.49, 13.62),
  ('3_quartos', 39.77, 13.61)
ON CONFLICT (tipologia) DO UPDATE SET
  preco_m2 = EXCLUDED.preco_m2,
  variacao_12m_pct = EXCLUDED.variacao_12m_pct,
  atualizado_em = NOW();

-- ═══ 4. EMOLUMENTOS CARTORIAIS MG 2026 ═══

CREATE TABLE IF NOT EXISTS emolumentos_mg (
  faixa_min NUMERIC(12,2),
  faixa_max NUMERIC(12,2),
  valor_escritura NUMERIC(10,2),
  valor_registro NUMERIC(10,2),
  desconto_sfh_pct NUMERIC(5,2) DEFAULT 80,
  desconto_promessa_pct NUMERIC(5,2) DEFAULT 50,
  fonte TEXT DEFAULT 'Portaria 8.664/CGJ/2025 + Lei 15.424/2004',
  PRIMARY KEY (faixa_min, faixa_max)
);

INSERT INTO emolumentos_mg (faixa_min, faixa_max, valor_escritura) VALUES
  (0, 1400, 220.55),
  (7000, 14000, 962.47),
  (28000, 42000, 1564.07),
  (70000, 105000, 2928.06),
  (140000, 175000, 3979.69),
  (210000, 280000, 4772.07),
  (350000, 420000, 5035.59),
  (560000, 700000, 5826.70),
  (840000, 1120000, 6866.53),
  (1400000, 1680000, 8009.72),
  (1680000, 3200000, 8582.97)
ON CONFLICT (faixa_min, faixa_max) DO UPDATE SET
  valor_escritura = EXCLUDED.valor_escritura;

-- ═══ 5. JURISPRUDÊNCIA RELEVANTE ═══

CREATE TABLE IF NOT EXISTS jurisprudencia_leilao (
  id TEXT PRIMARY KEY,
  tribunal TEXT NOT NULL,
  tema TEXT,
  numero_processo TEXT,
  data_julgamento DATE,
  ementa TEXT,
  impacto_score TEXT,
  impacto_descricao TEXT,
  modulacao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO jurisprudencia_leilao (id, tribunal, tema, numero_processo, data_julgamento, ementa, impacto_score, impacto_descricao, modulacao) VALUES
  ('stj_tema_1134', 'STJ', '1.134', 'REsp 1.914.902, 1.944.757 e 1.961.835', '2024-10-01',
   'Arrematante NÃO responde por tributos anteriores ao leilão. Sub-rogação ocorre sobre o preço.',
   'juridico +1.5', 'Reduz risco tributário em leilões judiciais',
   'Aplica-se apenas a editais publicados após a ata de julgamento'),
  ('stj_preco_vil', 'STJ', NULL, 'REsp 2.096.465/SP', '2024-05-14',
   'Vedação ao preço vil (< 50% avaliação) aplica-se também a leilões extrajudiciais.',
   'desconto -0.5', 'Limita descontos em extrajudicial a 50% mínimo',
   NULL),
  ('stj_condominial_edital', 'STJ', NULL, 'REsp 1.672.508/SP', NULL,
   'Arrematante responde por dívidas condominiais anteriores SOMENTE se constarem do edital.',
   'juridico variavel', 'Verificar edital para débitos condominiais',
   NULL),
  ('stj_tema_1266_pendente', 'STJ', '1.266', NULL, NULL,
   'Penhora de imóvel alienado fiduciariamente por dívida condominial — PENDENTE.',
   'juridico alerta', 'Monitorar julgamento',
   'Pendente de julgamento')
ON CONFLICT (id) DO UPDATE SET
  ementa = EXCLUDED.ementa,
  impacto_score = EXCLUDED.impacto_score,
  modulacao = EXCLUDED.modulacao,
  atualizado_em = NOW();

-- ═══ 6. INDICADORES DE MERCADO BH ═══

CREATE TABLE IF NOT EXISTS indicadores_mercado (
  id TEXT PRIMARY KEY,
  valor NUMERIC(12,2),
  unidade TEXT,
  descricao TEXT,
  fonte TEXT,
  referencia TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO indicadores_mercado (id, valor, unidade, descricao, fonte, referencia) VALUES
  ('bh_estoque_unidades', 4484, 'unidades', 'Estoque imóveis novos BH+NL dez/2025', 'Sinduscon-MG', 'dez/2025'),
  ('bh_meses_demanda', 7, 'meses', 'Meses de demanda sem novos lançamentos', 'Sinduscon-MG', 'dez/2025'),
  ('bh_meses_alta_aluguel', 30, 'meses', 'Meses consecutivos de alta no aluguel', 'FipeZAP', 'mai/2025'),
  ('bh_desconto_negociacao_aluguel', 2.3, '%', 'Desconto médio negociação locação', 'QuintoAndar', 'jan/2026'),
  ('bh_deficit_habitacional', 200000, 'unidades', 'Déficit habitacional BH', 'FJP', '2023'),
  ('bh_vendas_prontos_var_1t26', 35, '%', 'Variação vendas prontos 1T/2026', 'Secovi-MG', '1T/2026'),
  ('mg_vgv_2025', 14500000000, 'R$', 'VGV lançamentos MG 2025', 'Sinduscon-MG', '2025'),
  ('br_leiloes_crescimento_23_24', 86, '%', 'Crescimento nº leilões 2023→2024', 'Resale', '2024'),
  ('br_deságio_medio_residencial', 59, '%', 'Deságio médio residencial (geral)', 'Resale', 'jan-set/2023'),
  ('br_deságio_ocupados', 44, '%', 'Deságio imóveis ocupados', 'Resale', 'jan-set/2023'),
  ('caixa_imoveis_retomados_2024', 47000, 'unidades', 'Estoque retomados Caixa', 'Caixa', '2024'),
  ('caixa_taxa_min_2026', 10.26, '% a.a.', 'Taxa mín financiamento Caixa (relacionamento)', 'Caixa', 'mar/2026'),
  ('caixa_ltv_max_proprio', 95, '%', 'LTV máximo leilão Caixa próprio', 'Caixa', '2026'),
  ('selic_projecao_2026', 12.5, '% a.a.', 'Projeção Selic final 2026', 'ABRAINC', '2026'),
  ('selic_projecao_2027', 10.5, '% a.a.', 'Projeção Selic final 2027', 'ABRAINC', '2027'),
  ('fgts_orcamento_2026', 160200000000, 'R$', 'Orçamento FGTS 2026 total', 'CCFGTS', '2026'),
  ('sfh_teto_2025', 2250000, 'R$', 'Teto SFH (desde out/2025)', 'Resolução CCFGTS', 'out/2025')
ON CONFLICT (id) DO UPDATE SET
  valor = EXCLUDED.valor,
  descricao = EXCLUDED.descricao,
  fonte = EXCLUDED.fonte,
  referencia = EXCLUDED.referencia,
  atualizado_em = NOW();

-- ═══ 7. TAXAS FINANCIAMENTO PÓS-ARREMATAÇÃO ═══

CREATE TABLE IF NOT EXISTS taxas_financiamento (
  banco TEXT PRIMARY KEY,
  taxa_min_aa NUMERIC(5,2),
  taxa_max_aa NUMERIC(5,2),
  indexador TEXT DEFAULT 'TR',
  ltv_max_pct NUMERIC(5,2) DEFAULT 80,
  prazo_max_meses INTEGER DEFAULT 360,
  financia_leilao_judicial BOOLEAN DEFAULT FALSE,
  financia_leilao_extrajudicial BOOLEAN DEFAULT TRUE,
  obs TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO taxas_financiamento (banco, taxa_min_aa, taxa_max_aa, ltv_max_pct, prazo_max_meses, financia_leilao_judicial, financia_leilao_extrajudicial, obs) VALUES
  ('Caixa', 10.26, 11.19, 80, 420, false, true, 'Até 95% LTV em leilões próprios. Relacionamento: 10.26%'),
  ('BRB', 11.36, 11.36, 80, 360, false, true, NULL),
  ('Itaú', 11.60, 11.60, 80, 360, false, false, 'Não financia leilão diretamente'),
  ('Santander', 11.69, 11.79, 80, 420, false, false, NULL),
  ('Bradesco', 11.70, 11.70, 80, 360, false, false, NULL),
  ('BB', 9.00, 12.00, 80, 360, false, true, 'Pró-Cotista: 9.00%. Balcão: 12.00%')
ON CONFLICT (banco) DO UPDATE SET
  taxa_min_aa = EXCLUDED.taxa_min_aa,
  taxa_max_aa = EXCLUDED.taxa_max_aa,
  ltv_max_pct = EXCLUDED.ltv_max_pct,
  financia_leilao_judicial = EXCLUDED.financia_leilao_judicial,
  financia_leilao_extrajudicial = EXCLUDED.financia_leilao_extrajudicial,
  obs = EXCLUDED.obs,
  atualizado_em = NOW();

-- ═══ 8. NOTA IMPORTANTE: ITBI BH ═══
-- A pesquisa indica ITBI BH = 5% sobre valor venal
-- VERIFICAR: a alíquota pode variar entre 2% (transferência onerosa),
-- 3% (usual em vários sites) e 5% (valor venal PBH).
-- Recomendação: verificar no portal da PBH a tabela vigente
-- e atualizar constants.js se necessário.

-- ═══ FIM DO PATCH ═══
SELECT 'Patch RMBH Q1/2026 aplicado com sucesso' AS status,
  (SELECT COUNT(*) FROM custos_construcao) AS custos_construcao,
  (SELECT COUNT(*) FROM indicadores_mercado) AS indicadores_mercado,
  (SELECT COUNT(*) FROM jurisprudencia_leilao) AS jurisprudencia,
  (SELECT COUNT(*) FROM taxas_financiamento) AS bancos;
