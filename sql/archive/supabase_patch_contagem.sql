-- ═══════════════════════════════════════════════════════════════
-- AXIS — Patch: Região Contagem/Europa (separar do RMBH genérico)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.mercado_regional
  (regiao_key, label, cidade, preco_m2_venda_min, preco_m2_venda_max,
   preco_m2_venda_medio, preco_m2_locacao, tempo_venda_dias,
   tendencia, tendencia_pct_12m, demanda, vacancia_pct,
   yield_bruto_pct, yield_liquido_pct, viabilidade_temporada,
   imovel_mais_liquido, bairros, alertas)
VALUES
('contagem_europa', 'Contagem — Europa / Eldorado / Santa Cruz', 'Contagem',
 4200, 5800, 5073, 31, 120, 'estavel_leve_alta', 3.5, 'media', 5.5, 6.2, 4.0, 'baixa',
 '{"tipologia":"apartamento","quartos_ideal":3,"suites_min":1,"vagas_ideal":2,"area_min_m2":80,"area_max_m2":130,"faixa_preco_min":350000,"faixa_preco_max":650000,"condominio_teto":600,"lazer":"basico"}',
 '["Europa","Eldorado","Santa Cruz","Ressaca","Petrolândia"]',
 '[]')
ON CONFLICT (regiao_key) DO UPDATE SET
  preco_m2_venda_medio = EXCLUDED.preco_m2_venda_medio,
  preco_m2_venda_min = EXCLUDED.preco_m2_venda_min,
  preco_m2_venda_max = EXCLUDED.preco_m2_venda_max,
  demanda = EXCLUDED.demanda,
  alertas = EXCLUDED.alertas,
  bairros = EXCLUDED.bairros,
  imovel_mais_liquido = EXCLUDED.imovel_mais_liquido,
  atualizado_em = NOW();

-- Remover Europa e bairros que migraram do RMBH genérico
UPDATE public.mercado_regional
SET bairros = (
  SELECT jsonb_agg(b)
  FROM jsonb_array_elements_text(bairros::jsonb) AS b
  WHERE b NOT IN ('Europa', 'Eldorado', 'Santa Cruz', 'Ressaca')
)
WHERE regiao_key = 'bh_rmbh';
