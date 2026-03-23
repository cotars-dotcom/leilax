-- Tabela de dados de mercado regional
CREATE TABLE IF NOT EXISTS public.mercado_regional (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  regiao_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  cidade TEXT NOT NULL,
  bairros JSONB DEFAULT '[]',
  preco_m2_venda_min NUMERIC,
  preco_m2_venda_max NUMERIC,
  preco_m2_venda_medio NUMERIC,
  preco_m2_locacao NUMERIC,
  tempo_venda_dias INTEGER,
  tendencia TEXT,
  tendencia_pct_12m NUMERIC,
  demanda TEXT,
  vacancia_pct NUMERIC,
  yield_bruto_pct NUMERIC,
  yield_liquido_pct NUMERIC,
  imovel_mais_liquido JSONB,
  alertas JSONB DEFAULT '[]',
  viabilidade_temporada TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  fonte TEXT DEFAULT 'estudo_bh_jf_2025'
);

ALTER TABLE public.mercado_regional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercado_read" ON public.mercado_regional
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.ativo = true)
  );

CREATE POLICY "mercado_admin" ON public.mercado_regional
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Popular com dados iniciais
INSERT INTO public.mercado_regional
  (regiao_key, label, cidade, preco_m2_venda_min, preco_m2_venda_max,
   preco_m2_venda_medio, preco_m2_locacao, tempo_venda_dias,
   tendencia, tendencia_pct_12m, demanda, vacancia_pct,
   yield_bruto_pct, yield_liquido_pct, viabilidade_temporada,
   imovel_mais_liquido, bairros, alertas)
VALUES
('bh_centro_sul','BH Centro-Sul','Belo Horizonte',12000,15000,13500,72,75,'alta',12.0,'alta',2.5,5.5,3.5,'alta','{"quartos_ideal":3,"suites_min":1,"vagas_ideal":2,"area_min_m2":80,"area_max_m2":100,"faixa_preco_min":800000,"faixa_preco_max":1200000,"condominio_teto":1200,"lazer":"completo"}','["Lourdes","Funcionários","Serra","Sion","Anchieta"]','["risco_enchente_verificar_urbel"]'),
('bh_savassi','BH Savassi / Lourdes / Belvedere','Belo Horizonte',12000,18000,15000,58,45,'alta',16.0,'muito_alta',2.0,5.0,3.2,'alta','{"quartos_ideal":2,"suites_min":1,"vagas_ideal":2,"area_min_m2":70,"area_max_m2":90,"faixa_preco_min":700000,"faixa_preco_max":900000,"condominio_teto":1000,"lazer":"completo"}','["Savassi","Lourdes","Belvedere"]','[]'),
('bh_pampulha','BH Pampulha','Belo Horizonte',8500,9800,9150,35,105,'estavel_leve_alta',4.0,'media_alta',4.0,5.5,3.5,'media','{"quartos_ideal":3,"suites_min":1,"vagas_ideal":2,"area_min_m2":90,"area_max_m2":120,"condominio_teto":800,"lazer":"basico"}','["Pampulha","Castelo","São Luiz","Bandeirantes","Ouro Preto"]','[]'),
('nova_lima','Nova Lima (Vila da Serra)','Nova Lima',14000,18000,16000,85,60,'alta',8.0,'alta',3.0,4.5,2.8,'media','{"quartos_ideal":3,"suites_min":2,"vagas_ideal":2,"area_min_m2":120,"area_max_m2":150,"condominio_teto":1500,"lazer":"completo"}','["Vila da Serra","Morro do Chapéu"]','["risco_geologico_encostas_verificar"]'),
('bh_buritis','BH Buritis / Estoril','Belo Horizonte',8000,9000,8500,50,75,'alta',10.0,'alta',3.5,6.0,4.0,'media','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":2,"area_min_m2":70,"area_max_m2":100,"condominio_teto":600,"lazer":"basico"}','["Buritis","Estoril","Luxemburgo"]','[]'),
('bh_santa_efigenia','BH Santa Efigênia / Prates','Belo Horizonte',9500,11000,10250,56,120,'estavel_leve_alta',3.0,'media',5.0,5.5,3.3,'baixa','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":60,"area_max_m2":80,"condominio_teto":500,"lazer":"basico"}','["Santa Efigênia","Carlos Prates","Floresta"]','["risco_enchente_corregos_verificar"]'),
('bh_cidade_nova','BH Cidade Nova / Caiçara','Belo Horizonte',8000,9000,8500,40,150,'estavel_queda_moderada',-1.0,'media_baixa',6.0,6.5,4.0,'baixa','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":50,"area_max_m2":70,"condominio_teto":300,"lazer":"nenhum"}','["Cidade Nova","Caiçara","Padre Eustáquio"]','[]'),
('bh_venda_nova','BH Venda Nova / Jardim Leblon','Belo Horizonte',4000,4500,4250,20,195,'estavel_baixa',1.0,'baixa',9.0,7.0,4.5,'nenhuma','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":40,"area_max_m2":60,"condominio_teto":250,"lazer":"nenhum"}','["Venda Nova","Jardim Leblon","Mantiqueira"]','["alta_vacancia","baixa_liquidez"]'),
('bh_barreiro','BH Barreiro / Milionários','Belo Horizonte',6000,7000,6500,31,150,'estavel',2.0,'baixa',7.0,6.0,3.8,'nenhuma','{"quartos_ideal":3,"suites_min":0,"vagas_ideal":1,"area_min_m2":70,"area_max_m2":90,"condominio_teto":300,"lazer":"nenhum"}','["Barreiro","Milionários","Jatobá"]','["risco_geologico_verificar"]'),
('bh_rmbh','RMBH (Contagem / Betim)','Região Metropolitana BH',2500,5500,4000,22,210,'estavel_baixa',1.5,'baixa',8.0,7.0,4.5,'nenhuma','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":45,"area_max_m2":65,"condominio_teto":300,"lazer":"nenhum"}','["Contagem","Betim","Ribeirão das Neves"]','["muito_baixa_liquidez","alta_vacancia"]'),
('jf_centro','JF Centro / Centro Histórico','Juiz de Fora',5500,6800,6150,21,75,'estavel',3.0,'alta',4.0,4.5,2.8,'media','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":55,"area_max_m2":75,"condominio_teto":500,"lazer":"basico"}','["Centro","Centro Histórico","Santa Helena","Monte Castelo"]','[]'),
('jf_bairros_nobres','JF Manoel Honório / Benfica / Dom Bosco','Juiz de Fora',5500,6500,6000,20,75,'estavel',3.5,'alta',3.5,5.0,3.2,'media','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":55,"area_max_m2":75,"condominio_teto":500,"lazer":"basico"}','["Manoel Honório","Benfica","Dom Bosco","Grama","Salvaterra"]','[]'),
('jf_bairros_medios','JF Cascatinha / Granbery / São Mateus','Juiz de Fora',5000,5650,5300,23,105,'estavel',2.5,'media',5.0,5.0,3.0,'baixa','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":55,"area_max_m2":75,"condominio_teto":450,"lazer":"nenhum"}','["Cascatinha","São Mateus","Granbery","Alto dos Passos"]','[]'),
('jf_periferica','JF Bairros Periféricos','Juiz de Fora',4500,5600,5000,18,180,'estavel_queda',0.5,'baixa',7.0,4.0,2.3,'nenhuma','{"quartos_ideal":2,"suites_min":0,"vagas_ideal":1,"area_min_m2":45,"area_max_m2":65,"condominio_teto":350,"lazer":"nenhum"}','["Passos","São Pedro","Graminha","Progresso","Vitorino Braga"]','["baixa_liquidez","lenta_venda"]')
ON CONFLICT (regiao_key) DO UPDATE SET
  preco_m2_venda_medio = EXCLUDED.preco_m2_venda_medio,
  preco_m2_locacao = EXCLUDED.preco_m2_locacao,
  tendencia_pct_12m = EXCLUDED.tendencia_pct_12m,
  atualizado_em = NOW();
