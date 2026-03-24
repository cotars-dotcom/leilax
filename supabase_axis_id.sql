-- Adicionar coluna codigo_axis para identificação interna de imóveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS codigo_axis TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_imoveis_codigo_axis
  ON public.imoveis(codigo_axis);

-- Gerar códigos para imóveis existentes que não têm
UPDATE public.imoveis
SET codigo_axis = 'MG-' || EXTRACT(YEAR FROM COALESCE(criado_em, NOW()))::TEXT || '-' ||
              LPAD(ROW_NUMBER() OVER (ORDER BY COALESCE(criado_em, NOW()))::TEXT, 4, '0')
WHERE codigo_axis IS NULL;
