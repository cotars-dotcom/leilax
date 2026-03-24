-- ================================================================
-- AXIS — Métricas de Reforma
-- Fonte: custos_reforma.js (Lar Pontual 2026 + Morada Prop BH + Sinduscon-MG)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.metricas_reforma (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escopo       TEXT NOT NULL,
  classe       TEXT NOT NULL,
  custo_min_m2 NUMERIC(10,2),
  custo_max_m2 NUMERIC(10,2),
  custo_medio  NUMERIC(10,2),
  fonte        TEXT,
  competencia  TEXT,
  observacoes  TEXT,
  UNIQUE(escopo, classe)
);

INSERT INTO public.metricas_reforma
  (escopo, classe, custo_min_m2, custo_max_m2, fonte, competencia)
VALUES
('refresh_giro','A_prime',320,520,'Lar Pontual 2026','2026-03'),
('refresh_giro','B_medio_alto',280,470,'Lar Pontual 2026','2026-03'),
('refresh_giro','C_intermediario',240,420,'Lar Pontual 2026','2026-03'),
('refresh_giro','D_sensivel_preco',200,360,'Lar Pontual 2026','2026-03'),
('leve_funcional','A_prime',520,900,'Lar Pontual 2026','2026-03'),
('leve_funcional','B_medio_alto',460,820,'Lar Pontual 2026','2026-03'),
('leve_funcional','C_intermediario',400,740,'Lar Pontual 2026','2026-03'),
('leve_reforcada','A_prime',900,1450,'Lar Pontual 2026 + Morada Prop BH','2026-03'),
('leve_reforcada','B_medio_alto',800,1300,'Lar Pontual 2026','2026-03'),
('leve_reforcada','C_intermediario',700,1150,'Lar Pontual 2026','2026-03'),
('completa','A_prime',1500,3800,'Lar Pontual 2026 + Morada Prop BH (R$1.926/m²)','2026-03'),
('completa','B_medio_alto',1200,2500,'Lar Pontual 2026','2026-03'),
('completa','C_intermediario',900,1800,'Lar Pontual 2026','2026-03')
ON CONFLICT (escopo, classe) DO UPDATE SET
  custo_min_m2 = EXCLUDED.custo_min_m2,
  custo_max_m2 = EXCLUDED.custo_max_m2;

-- Índices CUB e SINAPI como referência
CREATE TABLE IF NOT EXISTS public.indices_construcao (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  indice       TEXT UNIQUE NOT NULL,
  valor        NUMERIC(10,2),
  unidade      TEXT,
  variacao_12m NUMERIC(6,2),
  competencia  TEXT,
  fonte        TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.indices_construcao
  (indice, valor, unidade, variacao_12m, competencia, fonte)
VALUES
('SINAPI_NACIONAL','1891.63','R$/m²',5.63,'2025-12','IBGE/CAIXA dez/2025'),
('CUB_MG_NORMAL_BAIXO','2508.00','R$/m²',NULL,'2026-02','Sinduscon-MG fev/2026'),
('CUB_MG_NORMAL_ALTO','3028.00','R$/m²',NULL,'2026-02','Sinduscon-MG fev/2026'),
('INCC_M','0.34','% mensal',5.83,'2026-02','FGV IBRE fev/2026'),
('REFORMA_COMPLETA_BH','1926.00','R$/m²',NULL,'2025-09','Morada Prop BH set/2025')
ON CONFLICT (indice) DO UPDATE SET
  valor = EXCLUDED.valor,
  competencia = EXCLUDED.competencia,
  atualizado_em = NOW();
