# PROMPT DIAGNÓSTICO AXIS IP — AGENTES IA
**Data:** 22/04/2026 | **Referência:** MG-007 Buritis, BH/MG

Envie este prompt para cada agente (Gemini Flash, DeepSeek V3, GPT-4o-mini, Claude Sonnet).
Compare as respostas para identificar divergências e calibrar o sistema.

---

## CONTEXTO DO SISTEMA

Você é um agente de análise imobiliária do **AXIS IP** — plataforma SaaS de análise de imóveis em leilão judicial no RMBH.
Você tem acesso aos seguintes dados do banco de mercado (metricas_bairros, RMBH 2026):

**BANCO DE DADOS DE MERCADO — Buritis, BH:**
- Preço anúncio: R$8.369/m²
- Preço contrato: R$7.231/m²
- Aluguel 2q típico: R$33/m² (= ~R$2.290 para 69m²)
- Aluguel 2q com elevador+piscina: ~R$3.000-3.200 (fatores: elevador+16%, piscina+5%)
- Yield bruto médio bairro: 5.23% a.a.
- Tendência 12m: +6.9% a.a. valorização
- Vacância: 7%
- Tempo venda: 65 dias
- Liquidez: Média
- Classe IPEAD: Alto

**SELIC atual:** 14.75% a.a. (referência renda fixa)
**SINAPI BH (base 2025):** Reforma básica R$834/m² | Média R$2.102/m² | Completa R$5.130/m²

---

## IMÓVEL DE REFERÊNCIA — MG-007

```
Código: MG-007
Imóvel: Apartamento 2q/1s, 69m², 1 vaga — Buritis, BH/MG
Endereço: Av. Protásio de Oliveira Penna, 105
Processo: TJMG / Leilão Judicial
Modalidade: 1ª praça 06/05/2026 (R$360.000) | 2ª praça 13/05/2026 (R$180.000)
Avaliação judicial: R$300.000 (obs: provavelmente defasada)
Infraestrutura: Elevador ✅ | Piscina ✅ | Portaria 24h ✅
Ocupação: Desocupado (confirmado)
Financiável: Não
Débitos: R$88.621 (condo + IPTU em atraso — responsabilidade do arrematante)
Custo jurídico estimado: R$22.000
```

---

## TAREFA 1 — AVALIAÇÃO DE MERCADO

Usando os dados do banco acima, calcule:

1. **Valor de mercado estimado** para este imóvel
   - Método comparativo: área × preço_contrato_m2 × fatores de homogeneização
   - Fatores disponíveis: elevador (+16%), piscina (+5%)
   - Resultado esperado: R$ ____

2. **Desconto real sobre mercado** ao arrematar na 2ª praça (R$180k)
   - Fórmula: (1 - 180.000 / valor_mercado) × 100 = ____%

3. **Preço por m² do imóvel no leilão** vs mercado
   - Lance/área vs R$7.231 contrato = ___% do mercado

4. **Avaliação da avaliação judicial R$300k**
   - Parece subestimada? De quanto?

---

## TAREFA 2 — ESTUDO DE RETORNO (ROI)

**Cenário: 2ª praça R$180.000 | Estratégia: REVENDA (FLIP)**

Custos de aquisição (leilão judicial BH):
- Comissão leiloeiro: 5% sobre lance
- ITBI: 3% sobre lance
- Honorários advocatícios: 5% sobre lance
- Documentação/cartório: 2.5% sobre lance
- Holding 6 meses (condo R$450 + IPTU R$200): R$3.900
- Reforma básica: R$57.807
- Débitos (responsabilidade arrematante): R$88.621
- Custo jurídico: R$22.000

Calcule:
1. **Investimento total** = R$ ____
2. **ROI flip** = (valor_mercado × 0.94 - investimento) / investimento × 100 = ____%
3. **Lance máximo para ROI 20%** (MAO flip) = R$ ____
4. **Status**: 2ª praça R$180k DENTRO ou FORA do MAO?

**Cenário: LOCAÇÃO**
1. **Aluguel estimado** (com infra): R$ ____/mês
2. **Yield bruto** = aluguel × 12 / investimento × 100 = ____%
3. **Yield líquido** (desc. vacância 7%, manutenção 0.5%, IR 27.5% acima R$2.824) = ____%
4. **Lance máximo para yield 6% a.a.** (MAO locação) = R$ ____
5. **Comparação com Selic 14.75%**: ___pp abaixo/acima

---

## TAREFA 3 — ESTUDO DE REFORMA

Dado o imóvel desocupado em Buritis (Alto Padrão):

1. **Reforma Básica** (refresh, sem obra molhada): R$57.807 — R$834/m²
   - Recomendável? Vale o ROI adicional?
   - Valorização estimada: +5% sobre mercado = R$ ____

2. **Reforma Média** (1 área molhada): R$145.947 — R$2.102/m²
   - ROI da reforma: ganho de valorização / custo reforma = ____%

3. **Reforma Completa**: R$355.848 — R$5.130/m²
   - Viável para flip? Qual seria o preço mínimo de venda necessário?

4. **Recomendação de reforma** para maximizar retorno neste imóvel:

---

## TAREFA 4 — ANÁLISE JURÍDICA E DE RISCO

Riscos identificados:
- R1: Débito de condomínio R$74.762 (propter rem — arrematante paga)
- R2: Débito de IPTU R$13.860 (propter rem)
- R3: Custo de imissão na posse R$8.000 (estimado)
- R4: Imóvel desocupado (baixo risco de posse)
- R5: Não financiável (compra à vista)

Para cada risco, avalie:
- Probabilidade: Alta/Média/Baixa
- Impacto financeiro: R$ ____
- Mitigação possível?

**Score jurídico sugerido** (escala 0-10): ____
**Justificativa:**

---

## TAREFA 5 — SCORE FINAL E RECOMENDAÇÃO

Com base nas análises anteriores, preencha:

```
score_localizacao: ___ /10  (Buritis = bairro Alto IPEAD, Zona Oeste BH)
score_desconto:    ___ /10  (desconto __% sobre mercado real)
score_juridico:    ___ /10  (baseado na análise de riscos)
score_ocupacao:    ___ /10  (desocupado confirmado)
score_liquidez:    ___ /10  (liquidez Média, tempo_venda 65 dias)
score_mercado:     ___ /10  (tendência +6.9% a.a., classe Alto)

score_total (ponderado):  ___ /10
RECOMENDAÇÃO: COMPRAR / AGUARDAR / EVITAR
Justificativa (2-3 frases):
```

Pesos: Localização 20% | Desconto 18% | Jurídico 18% | Ocupação 15% | Liquidez 15% | Mercado 14%

---

## TAREFA 6 — SÍNTESE EXECUTIVA

Escreva uma síntese executiva de 3-4 frases para o investidor. Linguagem direta, sem jargões.
Deve responder: Vale arrematar na 2ª praça? Por quê? Qual estratégia?

---

## COMPARATIVO DE RESPOSTAS — COMO USAR

Após receber respostas de todos os agentes, compare:

| Campo | Gemini Flash | DeepSeek V3 | GPT-4o-mini | Claude Sonnet | Banco atual |
|-------|-------------|-------------|-------------|---------------|-------------|
| Valor mercado | | | | | R$523.576 |
| Aluguel 2q | | | | | R$3.052 |
| ROI flip R$180k | | | | | 29% |
| MAO flip | | | | | R$212.496 |
| score_total | | | | | 5.46 |
| Recomendação | | | | | AGUARDAR |

**Divergências > 15%** entre agentes indicam necessidade de calibração dos prompts.
