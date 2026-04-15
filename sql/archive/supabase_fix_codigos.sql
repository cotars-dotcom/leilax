-- Corrigir codigo_axis com formato errado
-- Executar manualmente no Supabase SQL Editor

-- Verificar códigos com formato incorreto
SELECT id, codigo_axis, cidade, criado_em
FROM imoveis
WHERE codigo_axis IS NOT NULL
  AND codigo_axis NOT SIMILAR TO '[A-Z]{2}-[0-9]{4}-[0-9]{4}';

-- Verificar duplicatas
SELECT codigo_axis, count(*)
FROM imoveis
WHERE codigo_axis IS NOT NULL
GROUP BY codigo_axis
HAVING count(*) > 1;
