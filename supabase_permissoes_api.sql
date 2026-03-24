-- Adicionar campo de permissão de API por usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pode_usar_api BOOLEAN DEFAULT false;

-- Admin sempre pode usar API
UPDATE public.profiles
SET pode_usar_api = true
WHERE role = 'admin';

-- Função para verificar permissão
CREATE OR REPLACE FUNCTION public.usuario_pode_usar_api(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT pode_usar_api FROM public.profiles WHERE id = uid),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER;
