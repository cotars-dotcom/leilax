-- AXIS — Adicionar colunas de fotos à tabela imoveis
-- Executar no Supabase SQL Editor

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS foto_principal TEXT;
