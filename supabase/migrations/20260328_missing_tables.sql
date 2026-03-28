-- AXIS Platform — Tabelas auxiliares (faltantes no repo)
-- Executar no Supabase SQL Editor
-- Estas tabelas são usadas pelo código em supabase.js mas não tinham CREATE TABLE

-- 1. PARAMETROS DE SCORE — pesos das dimensões de análise
CREATE TABLE IF NOT EXISTS public.parametros_score (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL,
  dimensao    TEXT NOT NULL,
  peso        NUMERIC DEFAULT 0,
  ordem       INT DEFAULT 0,
  ativo       BOOLEAN DEFAULT true,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.parametros_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parametros_score_read" ON public.parametros_score FOR SELECT TO authenticated USING (true);
CREATE POLICY "parametros_score_write" ON public.parametros_score FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. CRITERIOS DE AVALIACAO — critérios qualitativos
CREATE TABLE IF NOT EXISTS public.criterios_avaliacao (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  descricao   TEXT,
  peso        NUMERIC DEFAULT 1,
  ativo       BOOLEAN DEFAULT true,
  ordem       INT DEFAULT 0,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.criterios_avaliacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criterios_read" ON public.criterios_avaliacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "criterios_write" ON public.criterios_avaliacao FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. AVALIACOES POR IMOVEL — notas por critério
CREATE TABLE IF NOT EXISTS public.avaliacoes_imovel (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id   UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  criterio_id UUID REFERENCES public.criterios_avaliacao(id),
  avaliador_id UUID REFERENCES public.profiles(id),
  nota        NUMERIC,
  observacao  TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(imovel_id, criterio_id, avaliador_id)
);
ALTER TABLE public.avaliacoes_imovel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avaliacoes_read" ON public.avaliacoes_imovel FOR SELECT TO authenticated USING (true);
CREATE POLICY "avaliacoes_write" ON public.avaliacoes_imovel FOR ALL TO authenticated USING (true);

-- 4. TAREFAS — kanban de tarefas do grupo
CREATE TABLE IF NOT EXISTS public.tarefas (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  prioridade      TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  imovel_id       UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  atribuido_para  UUID REFERENCES public.profiles(id),
  criado_por      UUID REFERENCES public.profiles(id),
  data_limite     TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarefas_read" ON public.tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "tarefas_write" ON public.tarefas FOR ALL TO authenticated USING (true);

-- 5. OBSERVACOES — notas/comentários em imóveis
CREATE TABLE IF NOT EXISTS public.observacoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id   UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  autor_id    UUID REFERENCES public.profiles(id),
  texto       TEXT NOT NULL,
  tipo        TEXT DEFAULT 'nota',
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.observacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "observacoes_read" ON public.observacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "observacoes_write" ON public.observacoes FOR ALL TO authenticated USING (true);

-- 6. APP SETTINGS — configurações globais e chaves de API por usuário
CREATE TABLE IF NOT EXISTS public.app_settings (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave           TEXT UNIQUE NOT NULL,
  valor           TEXT,
  descricao       TEXT,
  atualizado_por  UUID REFERENCES public.profiles(id),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON public.app_settings FOR ALL TO authenticated USING (true);

-- 7. ATIVIDADES — log de auditoria de ações dos usuários
CREATE TABLE IF NOT EXISTS public.atividades (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id  UUID REFERENCES public.profiles(id),
  acao        TEXT NOT NULL,
  entidade    TEXT,
  entidade_id TEXT,
  detalhes    JSONB,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atividades_read" ON public.atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "atividades_insert" ON public.atividades FOR INSERT TO authenticated WITH CHECK (true);

-- 8. API USAGE LOG — controle de custos de chamadas de IA
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.profiles(id),
  tipo            TEXT NOT NULL,
  modelo          TEXT NOT NULL,
  tokens_input    INT DEFAULT 0,
  tokens_output   INT DEFAULT 0,
  custo_usd       NUMERIC(10,6) DEFAULT 0,
  imovel_id       UUID,
  imovel_titulo   TEXT,
  modo_teste      BOOLEAN DEFAULT false,
  sucesso         BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_read" ON public.api_usage_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "usage_insert" ON public.api_usage_log FOR INSERT TO authenticated WITH CHECK (true);
