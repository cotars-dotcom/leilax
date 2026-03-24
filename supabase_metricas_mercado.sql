-- ================================================================
-- AXIS — Métricas de Mercado por Bairro BH
-- Fonte: metricas_bairros_bh.js (QA3T2025 + FZ0226 + IPEAD + PRODABEL)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.metricas_bairros (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bairro_key       TEXT UNIQUE NOT NULL,
  label            TEXT NOT NULL,
  zona             TEXT,
  cidade           TEXT DEFAULT 'Belo Horizonte',
  estado           TEXT DEFAULT 'MG',
  classe_ipead     SMALLINT,
  classe_ipead_label TEXT,
  preco_anuncio_m2 NUMERIC(10,2),
  preco_contrato_m2 NUMERIC(10,2),
  yield_bruto      NUMERIC(5,2),
  tendencia_12m    NUMERIC(6,2),
  ranking_qa       SMALLINT,
  tipo_preco       TEXT,
  destaque_locacao BOOLEAN DEFAULT false,
  obs              TEXT,
  fonte            TEXT DEFAULT 'QuintoAndar 3T2025 + FipeZAP fev/2026 + IPEAD/UFMG',
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir os 28 bairros
INSERT INTO public.metricas_bairros
  (bairro_key, label, zona, classe_ipead, classe_ipead_label,
   preco_anuncio_m2, preco_contrato_m2, yield_bruto, tendencia_12m,
   ranking_qa, tipo_preco, obs)
VALUES
-- Classe 4 Luxo
('bh_bairro_savassi','Savassi','Centro Sul',4,'Luxo',16310,9302,5.30,8.82,4,'anuncio_fipezap',NULL),
('bh_bairro_lourdes','Lourdes','Centro Sul',4,'Luxo',15804,11148,5.30,8.82,2,'anuncio_fipezap',NULL),
('bh_bairro_funcionarios','Funcionários','Centro Sul',4,'Luxo',15053,11237,5.30,8.82,1,'anuncio_fipezap','Top 3 mais caros em locação BH'),
('bh_bairro_gutierrez','Gutierrez','Centro Sul',4,'Luxo',11024,NULL,5.30,8.82,NULL,'anuncio_fipezap','Top 3 mais caros em locação BH'),
('bh_bairro_serra','Serra','Centro Sul',4,'Luxo',NULL,9464,5.30,68.3,3,'contrato_qa','Maior valorização trimestral BH — verificar amostra'),
('bh_bairro_anchieta','Anchieta','Centro Sul',4,'Luxo',NULL,7833,5.30,8.82,5,'contrato_qa',NULL),
('bh_bairro_sion','Sion','Centro Sul',4,'Luxo',NULL,6878,5.30,8.82,7,'contrato_qa',NULL),
('bh_bairro_cruzeiro','Cruzeiro','Centro Sul',4,'Luxo',NULL,6412,5.30,8.82,9,'contrato_qa',NULL),
('bh_bairro_luxemburgo','Luxemburgo','Oeste',4,'Luxo',NULL,5882,5.70,8.82,12,'contrato_qa',NULL),
('bh_bairro_santo_agostinho','Santo Agostinho','Centro Sul',4,'Luxo',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_santo_antonio','Santo Antônio','Centro Sul',4,'Luxo',NULL,NULL,5.30,26.3,NULL,'proxy_zona','Tendência +26,3% — verificar amostra'),
('bh_bairro_mangabeiras','Mangabeiras','Centro Sul',4,'Luxo',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_belvedere','Belvedere','Centro Sul',4,'Luxo',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Incluir Belvedere Nova Lima — verificar divisa'),
('bh_bairro_santa_lucia','Santa Lúcia','Centro Sul',4,'Luxo',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_carmo','Carmo','Centro Sul',4,'Luxo',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Dado específico pendente'),
-- Classe 3 Alto
('bh_bairro_estoril','Estoril','Oeste',3,'Alto',NULL,7544,5.70,8.82,6,'contrato_qa',NULL),
('bh_bairro_buritis','Buritis','Oeste',3,'Alto',10200,6764,5.70,6.9,8,'anuncio_fipezap','Top 3 mais caros em locação BH'),
('bh_bairro_barroca','Barroca','Oeste',3,'Alto',NULL,5176,5.70,8.82,14,'contrato_qa',NULL),
('bh_bairro_cidade_nova','Cidade Nova','Nordeste',3,'Alto',NULL,5188,6.40,8.82,13,'contrato_qa',NULL),
('bh_bairro_castelo','Castelo','Pampulha',3,'Alto',NULL,NULL,6.40,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_floresta','Floresta','Leste',3,'Alto',NULL,NULL,5.90,8.82,NULL,'proxy_zona','Bairro histórico próximo ao centro'),
('bh_bairro_prado','Prado','Oeste',3,'Alto',NULL,NULL,5.70,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_barro_preto','Barro Preto','Centro Sul',3,'Alto',NULL,NULL,5.30,8.82,NULL,'proxy_zona','Polo médico BH — demanda locação alta'),
-- Classe 2 Médio
('bh_bairro_santa_efigenia','Santa Efigênia','Leste',2,'Médio',8123,6300,5.90,3.0,10,'anuncio_fipezap',NULL),
('bh_bairro_carlos_prates','Carlos Prates','Noroeste',2,'Médio',6037,NULL,6.40,2.5,NULL,'anuncio_fipezap',NULL),
('bh_bairro_sagrada_familia','Sagrada Família','Leste',2,'Médio',NULL,NULL,5.90,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_padre_eustaquio','Padre Eustáquio','Noroeste',2,'Médio',NULL,NULL,6.40,8.82,NULL,'proxy_zona','Dado específico pendente'),
('bh_bairro_venda_nova','Venda Nova','Norte',2,'Médio',4365,NULL,6.60,2.0,NULL,'anuncio_fipezap',NULL)
ON CONFLICT (bairro_key) DO UPDATE SET
  preco_anuncio_m2 = EXCLUDED.preco_anuncio_m2,
  preco_contrato_m2 = EXCLUDED.preco_contrato_m2,
  tendencia_12m = EXCLUDED.tendencia_12m,
  atualizado_em = NOW();

-- Índices
CREATE INDEX IF NOT EXISTS idx_metricas_bairros_cidade ON public.metricas_bairros(cidade);
CREATE INDEX IF NOT EXISTS idx_metricas_bairros_classe ON public.metricas_bairros(classe_ipead);
CREATE INDEX IF NOT EXISTS idx_metricas_bairros_zona ON public.metricas_bairros(zona);
