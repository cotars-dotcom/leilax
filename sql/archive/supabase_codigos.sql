-- ══════════════════════════════════════════════════════════════════════════════
-- AXIS Platform — Código único por imóvel + registro de sincronização Trello
-- ══════════════════════════════════════════════════════════════════════════════

-- Código único sequencial por imóvel (ex: AXIS-0001)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS codigo_axis TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS trello_card_id TEXT,
  ADD COLUMN IF NOT EXISTS trello_card_url TEXT,
  ADD COLUMN IF NOT EXISTS trello_sincronizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trello_list_id TEXT;

-- Sequência para gerar códigos únicos
CREATE SEQUENCE IF NOT EXISTS axis_imovel_seq START 1;

-- Função para gerar código AXIS-XXXX
CREATE OR REPLACE FUNCTION gerar_codigo_axis()
RETURNS TEXT AS $$
DECLARE
  novo_num INTEGER;
  novo_codigo TEXT;
BEGIN
  LOOP
    novo_num := nextval('axis_imovel_seq');
    novo_codigo := 'AXIS-' || LPAD(novo_num::TEXT, 4, '0');
    -- Verifica se já existe (segurança extra)
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.imoveis WHERE codigo_axis = novo_codigo
    );
  END LOOP;
  RETURN novo_codigo;
END;
$$ LANGUAGE plpgsql;

-- Trigger: gera código automaticamente ao inserir
CREATE OR REPLACE FUNCTION trigger_gerar_codigo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_axis IS NULL OR NEW.codigo_axis = '' THEN
    NEW.codigo_axis := gerar_codigo_axis();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_imovel_insert_codigo ON public.imoveis;
CREATE TRIGGER on_imovel_insert_codigo
  BEFORE INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION trigger_gerar_codigo();

-- Gerar códigos para imóveis existentes que não têm código
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.imoveis WHERE codigo_axis IS NULL ORDER BY criado_em
  LOOP
    UPDATE public.imoveis
    SET codigo_axis = gerar_codigo_axis()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Tabela de log de sincronização Trello (histórico)
CREATE TABLE IF NOT EXISTS public.trello_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
  codigo_axis TEXT,
  trello_card_id TEXT,
  trello_list_id TEXT,
  acao TEXT NOT NULL, -- 'criado' | 'atualizado' | 'movido' | 'erro'
  detalhes TEXT,
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  sincronizado_por UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.trello_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_read" ON public.trello_sync_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo = true)
  );

CREATE POLICY "sync_log_write" ON public.trello_sync_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
