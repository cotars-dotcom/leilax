CREATE TABLE IF NOT EXISTS public.riscos_juridicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  risco_id TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  label TEXT NOT NULL,
  modalidade_leilao TEXT,
  base_legal TEXT,
  rota_processual TEXT,
  prazo_legal_dias INTEGER DEFAULT 0,
  prazo_pratico_meses_min INTEGER DEFAULT 0,
  prazo_pratico_meses_max INTEGER DEFAULT 0,
  custo_processual_mg_min NUMERIC DEFAULT 0,
  custo_processual_mg_max NUMERIC DEFAULT 0,
  custo_operacional_extra_min NUMERIC DEFAULT 0,
  custo_operacional_extra_max NUMERIC DEFAULT 0,
  bloqueia_uso BOOLEAN DEFAULT false,
  bloqueia_reforma BOOLEAN DEFAULT false,
  bloqueia_revenda BOOLEAN DEFAULT false,
  bloqueia_nova_locacao BOOLEAN DEFAULT false,
  risco_nota INTEGER DEFAULT 0,
  score_penalizacao INTEGER DEFAULT 0,
  exige_leitura_edital BOOLEAN DEFAULT true,
  exige_advogado BOOLEAN DEFAULT false,
  observacoes TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.riscos_juridicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riscos_read" ON public.riscos_juridicos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.ativo = true)
  );

CREATE POLICY "riscos_admin" ON public.riscos_juridicos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin')
  );

INSERT INTO public.riscos_juridicos
  (risco_id,categoria,subcategoria,label,modalidade_leilao,base_legal,rota_processual,
   prazo_legal_dias,prazo_pratico_meses_min,prazo_pratico_meses_max,
   custo_processual_mg_min,custo_processual_mg_max,
   custo_operacional_extra_min,custo_operacional_extra_max,
   bloqueia_uso,bloqueia_reforma,bloqueia_revenda,bloqueia_nova_locacao,
   risco_nota,score_penalizacao,exige_leitura_edital,exige_advogado,observacoes)
VALUES
('ocupacao_fiduciaria','ocupacao','ex_mutuario','Ocupado pelo ex-mutuário (fiduciário)','extrajudicial_fiduciario','Lei 9.514/97 + STJ 2024','reintegracao_posse',60,4,24,514.38,5818.61,5000,30000,true,true,true,true,9,-35,true,true,'Prazo real 4–24 meses. Acordo amigável R$5–30k pode ser mais rápido.'),
('inquilino_regular','locacao','inquilino_regular','Inquilino regular (locação vigente)','judicial','STJ + Lei 8.245/91','despejo',15,2,18,779.98,1405.09,0,3000,true,true,true,false,7,-22,true,true,'Pode haver renda em curso. Liminar em 15d só em hipóteses específicas.'),
('iptu_previo_judicial','tributario','iptu_previo','IPTU anterior — Leilão judicial','judicial','STJ repetitivo + CTN art.130','nenhuma',0,0,3,0,0,0,0,false,false,false,false,3,-5,true,false,'STJ protege arrematante em hasta pública. Risco documental médio.'),
('iptu_previo_caixa','tributario','iptu_previo','IPTU anterior — Imóvel CAIXA','caixa_leilao','FAQ CAIXA oficial','nenhuma',0,0,6,0,0,500,30000,false,false,false,false,7,-15,true,false,'CRÍTICO: IPTU atrasado é custo real do comprador em imóveis CAIXA.'),
('condominio_previo_judicial','condominio','condominio_previo','Débito condominial — Leilão judicial CPC/2015','judicial','CPC/2015 + STJ','nenhuma',0,0,3,0,0,0,5000,false,false,false,false,4,-8,true,false,'Tendência sub-rogação no preço sob CPC/2015. Editais antigos: risco maior.'),
('condominio_previo_caixa','condominio','condominio_previo','Débito condominial — Imóvel CAIXA','caixa_leilao','FAQ CAIXA oficial','nenhuma',0,0,3,0,0,1000,50000,false,false,false,false,8,-20,true,false,'Pode ser muito alto (anos acumulados). Solicitar certidão ANTES do lance.'),
('edital_matricula_divergente','edital','descricao_errada','Divergência edital vs matrícula vs imóvel real','qualquer','STJ 2025 — anulou por omissão de construção no edital','acao_autonoma',10,12,24,514.38,5818.61,0,0,true,true,true,true,10,-50,true,true,'RISCO IMPEDITIVO. Anulação do leilão. Sempre checar matrícula + vistoria.'),
('remicao_embargos','procedimental','remicao','Remição / Embargos pós-arrematação','judicial','CPC — 10 dias para contestação','embargos',10,1,6,221.24,884.96,0,0,true,true,true,true,6,-15,false,true,'Janela de instabilidade. Não reformar/vender antes da carta de arrematação + registro.'),
('retencao_benfeitorias','benfeitorias','retencao_benfeitorias','Retenção por benfeitorias pelo ocupante','qualquer','STJ 2023 — análise obrigatória na contestação','imissao_posse',0,3,12,0,0,0,15000,false,false,false,false,5,-12,false,true,'Atraso +3–12 meses. Pode gerar pagamento ao ocupante.'),
('custo_desocupacao','operacional','arrombamento','Custo operacional de desocupação física','qualquer','TJMG tabela 2025','nenhuma',0,0,1,141.70,354.20,500,5000,false,false,false,false,2,-3,false,false,'Chaveiro, mudança, depósito. Não confundir com custas judiciais.'),
('agravo_instrumento','procedimental','remicao','Agravo de instrumento — TJMG','qualquer','TJMG tabela 2025: R$331,86','embargos',0,2,8,331.86,663.72,0,0,false,true,false,false,4,-8,false,true,'Contestação de liminar. Atraso +2–8 meses.')
ON CONFLICT (risco_id) DO UPDATE SET
  risco_nota = EXCLUDED.risco_nota,
  score_penalizacao = EXCLUDED.score_penalizacao,
  atualizado_em = NOW();

-- Tabela de vinculação: risco por imóvel
CREATE TABLE IF NOT EXISTS public.riscos_imovel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
  risco_id TEXT NOT NULL,
  modalidade_confirmada TEXT,
  valor_debito_estimado NUMERIC DEFAULT 0,
  confirmado BOOLEAN DEFAULT false,
  observacao_especifica TEXT,
  registrado_por UUID REFERENCES public.profiles(id),
  registrado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.riscos_imovel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riscos_imovel_read" ON public.riscos_imovel
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.ativo = true)
  );

CREATE POLICY "riscos_imovel_write" ON public.riscos_imovel
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin','member'))
  );

-- Campo modalidade_leilao na tabela imoveis (se não existir)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS modalidade_leilao TEXT DEFAULT 'nao_informado',
  ADD COLUMN IF NOT EXISTS comissao_leiloeiro_pct NUMERIC DEFAULT 5,
  ADD COLUMN IF NOT EXISTS custo_juridico_estimado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_liberacao_meses INTEGER DEFAULT 0;
