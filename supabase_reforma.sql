-- Tabela de parâmetros de reforma por classe de mercado
CREATE TABLE IF NOT EXISTS public.parametros_reforma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classe TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  faixa_venda_m2_min NUMERIC,
  faixa_venda_m2_max NUMERIC,
  bairros_referencia JSONB DEFAULT '[]',
  regioes_mercado JSONB DEFAULT '[]',
  custo_refresh_min NUMERIC,
  custo_refresh_max NUMERIC,
  custo_leve_funcional_min NUMERIC,
  custo_leve_funcional_max NUMERIC,
  custo_leve_reforcada_min NUMERIC,
  custo_leve_reforcada_max NUMERIC,
  teto_pct_min NUMERIC,
  teto_pct_max NUMERIC,
  observacao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pacotes de serviço
CREATE TABLE IF NOT EXISTS public.pacotes_reforma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pacote_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  custo_min NUMERIC,
  custo_max NUMERIC,
  unidade TEXT DEFAULT 'fixo',
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parametros_reforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacotes_reforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reform_read" ON public.parametros_reforma
  FOR SELECT USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.ativo=true));
CREATE POLICY "reform_admin" ON public.parametros_reforma
  FOR ALL USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin'));

CREATE POLICY "pacotes_read" ON public.pacotes_reforma
  FOR SELECT USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.ativo=true));
CREATE POLICY "pacotes_admin" ON public.pacotes_reforma
  FOR ALL USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin'));

INSERT INTO public.parametros_reforma
  (classe,label,faixa_venda_m2_min,faixa_venda_m2_max,custo_refresh_min,custo_refresh_max,custo_leve_funcional_min,custo_leve_funcional_max,custo_leve_reforcada_min,custo_leve_reforcada_max,teto_pct_min,teto_pct_max,observacao)
VALUES
('A_prime','Classe A — Prime',12000,99999,320,520,520,900,900,1450,0.03,0.07,'Savassi/Lourdes/Belvedere/Vila da Serra. Aceita acabamento melhor.'),
('B_medio_alto','Classe B — Médio-Alto',8000,12000,280,470,470,820,820,1320,0.03,0.06,'Buritis/Estoril/Pampulha/Santa Efigênia. Obra objetiva com bom acabamento.'),
('C_intermediario','Classe C — Intermediário',5000,8000,240,420,420,720,720,1150,0.025,0.05,'Cidade Nova/Barreiro/JF Centro/Cascatinha. Obra muito objetiva e econômica.'),
('D_sensivel_preco','Classe D — Sensível a Preço',0,5000,200,360,360,620,620,980,0.02,0.04,'Venda Nova/RMBH periférica/JF periférica. Somente refresh estrito.')
ON CONFLICT (classe) DO UPDATE SET
  custo_refresh_min=EXCLUDED.custo_refresh_min,
  custo_refresh_max=EXCLUDED.custo_refresh_max,
  atualizado_em=NOW();

INSERT INTO public.pacotes_reforma (pacote_id,label,custo_min,custo_max,unidade) VALUES
('pintura_geral_reparos','Pintura geral + reparos leves',3500,9000,'fixo'),
('revisao_eletrica_pontual','Revisão elétrica pontual',1500,5000,'fixo'),
('revisao_hidraulica_pontual','Revisão hidráulica pontual',1500,6000,'fixo'),
('banheiro_refresh','Banheiro refresh econômico',7000,14000,'fixo'),
('banheiro_leve_reforcado','Banheiro leve reforçado',14000,22000,'fixo'),
('cozinha_refresh','Cozinha refresh econômica',10000,20000,'fixo'),
('cozinha_leve_reforcada','Cozinha leve reforçada',20000,32000,'fixo'),
('serralheria_pontual','Serralheria pontual',1000,6000,'fixo'),
('vidracaria_pontual','Vidraçaria pontual',800,5000,'fixo'),
('piso_simples_m2','Piso simples/vinílico/laminado',70,180,'por_m2'),
('gesso_pontual_m2','Gesso pontual/sanca',60,180,'por_m2')
ON CONFLICT (pacote_id) DO UPDATE SET
  custo_min=EXCLUDED.custo_min,
  custo_max=EXCLUDED.custo_max,
  atualizado_em=NOW();

-- Adicionar campos de reforma na tabela imoveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS escopo_reforma TEXT DEFAULT 'refresh_giro',
  ADD COLUMN IF NOT EXISTS custo_reforma_calculado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classe_mercado_reforma TEXT,
  ADD COLUMN IF NOT EXISTS indice_sobrecapitalizacao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alerta_sobrecap TEXT DEFAULT 'verde',
  ADD COLUMN IF NOT EXISTS valor_pos_reforma_estimado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indice_eficiencia_reforma NUMERIC DEFAULT 0;
