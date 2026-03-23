-- AXIS — Documentos jurídicos anexados por imóvel
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.documentos_juridicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,           -- 'pdf' | 'imagem' | 'txt'
  tamanho_bytes INTEGER,
  conteudo_texto TEXT,          -- texto extraído pelo Claude
  conteudo_base64 TEXT,         -- base64 para imagens (análise ChatGPT)
  analise_ia TEXT,              -- parecer do Claude sobre o documento
  riscos_encontrados JSONB DEFAULT '[]',
  impacto_score INTEGER DEFAULT 0,
  processado BOOLEAN DEFAULT false,
  enviado_por UUID REFERENCES public.profiles(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documentos_juridicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_read" ON public.documentos_juridicos
  FOR SELECT USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.ativo=true));

CREATE POLICY "docs_write" ON public.documentos_juridicos
  FOR ALL USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','member')));

-- Coluna para histórico de reclassificações
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS historico_juridico JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS score_juridico_manual NUMERIC,
  ADD COLUMN IF NOT EXISTS reclassificado_por_doc BOOLEAN DEFAULT false;
