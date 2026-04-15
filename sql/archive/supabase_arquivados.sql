-- ══════════════════════════════════════════════════════════════════════════════
-- AXIS Platform — Arquivamento de Imóveis + RLS por Role
-- ══════════════════════════════════════════════════════════════════════════════

-- Adicionar status "arquivado" nos imóveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS status_operacional TEXT DEFAULT 'ativo'
    CHECK (status_operacional IN ('ativo','arquivado','descartado')),
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;

-- Atualizar RLS para leitura compartilhada por todos os membros ativos
DROP POLICY IF EXISTS "imoveis_read" ON public.imoveis;
CREATE POLICY "imoveis_read" ON public.imoveis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ativo = true
    )
  );

-- Apenas admin e member podem inserir/editar/deletar
DROP POLICY IF EXISTS "imoveis_insert" ON public.imoveis;
CREATE POLICY "imoveis_insert" ON public.imoveis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','member')
        AND p.ativo = true
    )
  );

DROP POLICY IF EXISTS "imoveis_update" ON public.imoveis;
CREATE POLICY "imoveis_update" ON public.imoveis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','member')
        AND p.ativo = true
    )
  );
