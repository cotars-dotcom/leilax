/**
 * AXIS — Manual Interativo v2
 * Didático · Esquemático · Com dados reais de amostragem
 */
import { useState, useEffect } from 'react'
import { C, card } from '../appConstants.js'

// ─── PALETA ──────────────────────────────────────────────────────────────────
const P = {
  navy:'#002B80', navyL:'#E8EEF8',
  emerald:'#05A86D', emeraldL:'#E6F7F0',
  mustard:'#D4A017', mustardL:'#FFF8E1',
  red:'#E5484D', redL:'#FCEBEB',
  blue:'#4A9EFF', blueL:'#EBF4FF',
  purple:'#7C3AED', purpleL:'#F0EBFF',
  gray:'#8E8EA0', border:'#E8E6DF',
  surface:'#F4F3EF', white:'#FFFFFF', text:'#1A1A2E',
}

// ─── DADOS DAS DIMENSÕES ──────────────────────────────────────────────────────
const DIMS = [
  { id:'loc', label:'Localização', peso:20, cor:P.blue, icon:'📍',
    desc:'Infraestrutura do bairro, acessibilidade, oferta de serviços, potencial de valorização e qualidade de vida.',
    exemplos:['Bairro consolidado BH com comércio e transporte → 9/10','Subúrbio sem infraestrutura → 4/10'] },
  { id:'des', label:'Desconto',    peso:18, cor:P.emerald, icon:'💰',
    desc:'% de desconto sobre a avaliação judicial E sobre o valor de mercado real estimado pelo motor.',
    exemplos:['Lance 60% da avaliação = desconto 40% → 9/10','Lance 90% da avaliação = desconto 10% → 4/10'] },
  { id:'jur', label:'Jurídico',    peso:18, cor:P.purple, icon:'⚖️',
    desc:'Processos ativos, status da matrícula, riscos presentes (penhoras, alienação fiduciária), modalidade do leilão.',
    exemplos:['Matrícula limpa + extrajudicial CAIXA → 9/10','Embargos + penhora extra → 2/10'] },
  { id:'ocu', label:'Ocupação',    peso:15, cor:P.mustard, icon:'🏠',
    desc:'Situação de quem está no imóvel. Desocupado = pronto. Ocupado = custo R$5–50k + 4–24 meses.',
    exemplos:['Desocupado confirmado in loco → 10/10','Ocupado por ex-mutuário CAIXA → 3/10'] },
  { id:'liq', label:'Liquidez',    peso:15, cor:P.blue, icon:'📊',
    desc:'Facilidade de revender ou alugar. Baseado no tempo médio de venda no bairro e demanda local.',
    exemplos:['Savassi: tempo venda 45 dias, demanda alta → 9/10','Subúrbio: 180+ dias → 4/10'] },
  { id:'mer', label:'Mercado',     peso:14, cor:P.emerald, icon:'📈',
    desc:'Tendência de preços nos últimos 12 meses, yield de locação e expectativa de valorização.',
    exemplos:['Bairro +12% em 12m, yield 6.5% → 8/10','Bairro estável sem valorização → 5/10'] },
]

// ─── TABELAS DO BANCO ─────────────────────────────────────────────────────────
const TABELAS = [
  { nome:'mercado_regional', icone:'🗺️', cor:P.blue, titulo:'Mercado Regional',
    descricao:'Preço/m², yield, demanda e tendência por região de BH, Nova Lima, Contagem e Juiz de Fora.',
    fontes:['FipeZAP fev/2026 — preços de anúncio por cidade','QuintoAndar 3T2025 — preços de contrato','Secovi-MG jul/2025 — tempo médio de venda'],
    amostragem:'16 regiões · 11 zonas BH + Grande BH + Juiz de Fora (4 zonas)',
    campos:['preco_m2_medio','variacao_12m','demanda','tendencia','yield_bruto_pct','tempo_venda_dias'],
    exemplo:{regiao:'BH Centro-Sul', preco_m2:'R$ 10.500/m²', variacao_12m:'+12%', demanda:'Alta'} },
  { nome:'metricas_bairros', icone:'🏘️', cor:P.emerald, titulo:'Métricas por Bairro',
    descricao:'Preço de ANÚNCIO (o que pedem) vs preço de CONTRATO (o que fecham) separados — dado raro e valioso para calcular MAO real.',
    fontes:['FipeZAP fev/2026 — preço anúncio/m² por bairro','QuintoAndar 3T2025 — preço contrato/m²','IPEAD/UFMG — classificação 1-4 (Popular→Luxo)'],
    amostragem:'29 bairros BH · Gap médio anúncio→contrato: ~18% · Yield: 5.3–6.6%',
    campos:['bairro','preco_anuncio_m2','preco_contrato_m2','yield_bruto','classe_ipead'],
    exemplo:{bairro:'Savassi', anuncio:'R$ 16.310/m²', contrato:'R$ 9.302/m²', gap:'43%', classe:'4-Luxo'} },
  { nome:'riscos_juridicos', icone:'⚖️', cor:P.red, titulo:'Riscos Jurídicos',
    descricao:'15 tipos de risco com custo processual real do TJMG, prazo prático em meses e impacto direto no score.',
    fontes:['Tabela de Custas TJMG 2025','TRT-3 MG — tabela de diligências','Lei 9.514/97 + CPC art. 908'],
    amostragem:'15 tipos · Custo: R$ 0 a R$ 30.000 · Prazo: 0 a 24 meses',
    campos:['risco_id','custo_min','custo_max','prazo_meses','risco_nota','score_penalizacao'],
    exemplo:{risco:'Ocupação ex-mutuário', custo_min:'R$ 5.000', custo_max:'R$ 30.000', prazo:'4–24 meses', penalizacao:'-35 pts'} },
  { nome:'jurimetria_varas', icone:'🏛️', cor:P.purple, titulo:'Jurimetria das Varas',
    descricao:'Tempo real de ciclo por vara judicial — quanto leva de fato para liberar um imóvel ocupado. Dado coletado de histórico real de processos.',
    fontes:['CNJ DataJud 2024 — processos encerrados','ABRAIM — Associação Brasileira de Leilões Imobiliários','TRT-3 Relatório Anual 2024'],
    amostragem:'6 varas · 142–450 amostras por vara · Confiança ~85%',
    campos:['vara_nome','tempo_total_ciclo_dias','taxa_embargo_pct','taxa_sucesso_posse_pct','amostras_n'],
    exemplo:{vara:'TRT-3 BH', ciclo:'240 dias', taxa_sucesso:'88%', taxa_embargo:'8%', amostras:'198'} },
  { nome:'parametros_reforma', icone:'🔨', cor:P.mustard, titulo:'Parâmetros de Reforma',
    descricao:'Custo/m² de reforma por escopo e TETO máximo de investimento por classe de imóvel — baseado em SINAPI-MG.',
    fontes:['SINAPI-MG dez/2025 — custo unitário de insumos e serviços por município'],
    amostragem:'4 classes de mercado · 6 escopos · BH e Região Metropolitana',
    campos:['classe','escopo','custo_m2_min','custo_m2_max','teto_pct_imovel'],
    exemplo:{classe:'B médio-alto', escopo:'Reforma média', custo:'R$ 1.450–2.400/m²', teto:'6% do valor do imóvel'} },
]

// ─── GLOSSÁRIO ────────────────────────────────────────────────────────────────
const GLOSS = [
  { t:'Score AXIS', cat:'Análise', icon:'🎯', cor:P.navy,
    def:'Nota de 0 a 10 com 6 dimensões ponderadas pela IA. Threshold: ≥8.0 compra imediata · ≥7.0 comprar · 6-6.9 aguardar · <6.0 evitar.',
    formula:'Score = Σ (nota_dimensão × peso_dimensão)',
    ex:'Dona Clara: 8.5×20%+7.8×18%+7.0×18%+5.5×15%+6.5×15%+7.0×14% = 7.14 → COMPRAR' },
  { t:'Lance Máximo (MAO)', cat:'Financeiro', icon:'💡', cor:P.emerald,
    def:'Maximum Allowable Offer. Valor máximo de lance que preserva o ROI-alvo (20%) na estratégia de flip, já contabilizando reforma, débitos, holding e jurídico.',
    formula:'Lance máx = (Mercado×0,94 / 1,20 − Custos fixos) / (1 + %Custos)',
    ex:'Mercado R$600k · Reforma+débitos+holding+jur R$80k · %Custos 15,5% → Lance máx = (564k / 1,20 − 80k) / 1,155 = R$337.400' },
  { t:'ROI Flip', cat:'Financeiro', icon:'📈', cor:P.blue,
    def:'Retorno sobre investimento na estratégia de comprar + reformar + vender. Inclui IRPF e corretagem.',
    formula:'ROI = (Venda − IRPF − Corretagem − Custo Total) ÷ Custo Total × 100',
    ex:'Custo R$450k · Venda R$700k · IRPF R$37.5k · Corretagem R$42k → ROI = 38%' },
  { t:'Yield Bruto', cat:'Financeiro', icon:'🏦', cor:P.emerald,
    def:'Rendimento anual do aluguel sobre o valor do imóvel. Acima de 6%: boa locação. Abaixo de 4,5%: favorece flip.',
    formula:'Yield = (Aluguel mensal × 12) ÷ Valor de mercado × 100',
    ex:'Aluguel R$3.500 · Imóvel R$600k → Yield = (3.500×12)÷600k = 7,0% a.a.' },
  { t:'Sub-rogação', cat:'Jurídico', icon:'⚖️', cor:P.purple,
    def:'Em leilões judiciais (CPC/2015 art.908), débitos anteriores de IPTU e condomínio são pagos com o produto da arrematação — não viram obrigação do comprador.',
    formula:'Proteção legal — não requer cálculo',
    ex:'IPTU atrasado R$20k + condomínio R$15k em TJMG → ambos sub-rogados no preço' },
  { t:'2º Leilão', cat:'Leilão', icon:'🔨', cor:P.mustard,
    def:'Quando o 1º leilão não recebe lances, realiza-se o 2º com mínimo de 50% da avaliação. Oportunidade histórica de BH: fecha entre 57–65% da avaliação.',
    formula:'Mínimo 2º leilão = Avaliação × 50%',
    ex:'Avaliação R$800k → 1º mínimo R$800k · 2º mínimo R$400k (historicamente fecha em ~R$460k)' },
  { t:'IRPF 15%', cat:'Financeiro', icon:'🧾', cor:P.red,
    def:'Imposto de Renda sobre ganho de capital na venda. ISENÇÃO total para imóvel único PF com venda ≤ R$440k (Lei 11.196/2005).',
    formula:'IRPF = Ganho de Capital × 15% (apenas se venda > R$440k)',
    ex:'Custo R$450k · Venda R$700k → Ganho R$250k → IRPF R$37.500. Venda ≤ R$440k → R$0' },
  { t:'IPEAD Classes', cat:'Mercado', icon:'🏷️', cor:P.blue,
    def:'Instituto de Pesquisa Econômica de BH — classifica imóveis em 4 faixas que determinam o cap rate de locação e teto de reforma.',
    formula:'1-Popular <R$4.5k/m² · 2-Médio R$4.5–8k · 3-Alto R$8–12k · 4-Luxo >R$12k',
    ex:'Dona Clara preço ~R$6.9k/m² → Classe 2-Médio → cap rate 5% · teto reforma 5% do imóvel' },
  { t:'Jurimetria', cat:'Jurídico', icon:'📊', cor:P.purple,
    def:'Aplicação de estatística ao Direito. O AXIS usa dados históricos de varas do TJMG e TRT-3 para estimar o prazo real de liberação de imóvel ocupado.',
    formula:'Prazo estimado = Mediana do ciclo histórico por vara × fator de risco',
    ex:'TRT-3 BH: mediana 240 dias · sucesso 88% · embargo 8% (n=198 processos)' },
  { t:'Gemini Flash', cat:'IA', icon:'🤖', cor:P.navy,
    def:'Modelo Gemini 2.0 Flash da Google — motor principal. Para sites SPA (QuintoAndar), usa Google Search Grounding para buscar dados direto na web.',
    formula:'Custo: ~R$0,03 por análise (com grounding ~R$0,05)',
    ex:'Análise VivaReal: Jina scrape + Gemini → 25s. QuintoAndar (SPA): Gemini Grounding → 40s' },
  { t:'Mercado Direto', cat:'Análise', icon:'🏠', cor:P.blue,
    def:'Imóvel de portal (VivaReal, QuintoAndar, ZAP, OLX). Sem comissão leiloeiro (0%), sem advogado leilão, ITBI 3%. Base de aquisição = preço pedido.',
    formula:'Custo total = Preço pedido + ITBI 3% + Doc 0,5% + Registro',
    ex:'Preço pedido R$235k → Custo total ≈ R$243k (vs leilão: R$235k + comissão 5% + adv 2% ≈ R$260k)' },
  { t:'Homogeneização', cat:'Mercado', icon:'📐', cor:P.emerald,
    def:'Ajuste do valor de mercado conforme NBR 14653/IBAPE. Sem elevador -15%, sem piscina -3%, sem vaga -10%. Aplicado sobre preço de anúncio.',
    formula:'Valor homog. = Valor mercado × fator_homogenizacao',
    ex:'Mercado R$600k · sem elevador (-15%) · sem piscina (-3%) → Homog. R$492k (fator 0,82)' },
  { t:'SPA/Grounding', cat:'IA', icon:'🔍', cor:P.purple,
    def:'Sites SPA (React/Next) como QuintoAndar não retornam dados pelo scraper. O Gemini usa Google Search Retrieval para buscar o anúncio real na web.',
    formula:'Jina falha → verificarQualidadeScrape() → chamarGeminiComGrounding()',
    ex:'QuintoAndar: Jina retorna HTML vazio → Gemini busca "apartamento rua X contagem" no Google → dados reais extraídos' },
]

// ─── FLUXO ────────────────────────────────────────────────────────────────────
const FLUXO = [
  { n:1, titulo:'URL do imóvel',    icon:'🔗', cor:P.blue,   custo:'grátis',  tempo:'<1s',
    desc:'Cole o link de qualquer portal — leilão (Marco Antônio, Superbid, Caixa) ou mercado (VivaReal, QuintoAndar, ZAP).' },
  { n:2, titulo:'Scrape Jina.ai',   icon:'🕷️', cor:'#555',   custo:'grátis',  tempo:'2–5s',
    desc:'Jina.ai extrai texto. Se SPA detectado (QuintoAndar, Loft), tenta HTML e verifica qualidade do conteúdo.' },
  { n:3, titulo:'Extração Regex',   icon:'⚙️', cor:'#888',   custo:'grátis',  tempo:'<1s',
    desc:'25+ campos: preço, área, quartos, vagas, bairro, cidade, ocupação, elevador, piscina, condomínio, processo...' },
  { n:4, titulo:'Banco de Dados',   icon:'🗄️', cor:P.emerald, custo:'grátis', tempo:'<1s',
    desc:'Preço/m², yield, tendência, classe IPEAD e jurimetria consultados nas tabelas internas (21 bairros BH).' },
  { n:5, titulo:'Gemini 2.0 Flash', icon:'🤖', cor:P.purple, custo:'~R$0,03', tempo:'15–40s',
    desc:'IA analisa scores 6D, comparáveis, riscos, síntese e estratégia. Se SPA: usa Google Search Grounding.' },
  { n:6, titulo:'Homogeneização',   icon:'📐', cor:P.emerald, custo:'grátis',  tempo:'<1s',
    desc:'Ajusta valor de mercado por atributos (elevador, piscina, vagas) conforme NBR 14653.' },
  { n:7, titulo:'Score AXIS',       icon:'🎯', cor:P.navy,   custo:'grátis',  tempo:'<1s',
    desc:'Nota 0–10 com 6 pesos + calibração mercado (IPEAD, yield, tendência). COMPRAR / AGUARDAR / EVITAR.' },
  { n:8, titulo:'Reforma SINAPI',   icon:'🔨', cor:P.mustard, custo:'grátis', tempo:'<1s',
    desc:'6 cenários de reforma (SINAPI-MG 2026) com ROI, yield por cenário e alerta de sobrecapitalização.' },
  { n:8, titulo:'Salvar no Banco', icon:'💾', cor:P.emerald, custo:'grátis', tempo:'<1s',
    desc:'Todos os dados ficam no Supabase — sincronizados entre todos os dispositivos do grupo.' },
]

// ─── DIRETRIZES ───────────────────────────────────────────────────────────────
const DIR = [
  { n:1, e:'🏆', t:'Imóvel de qualidade',
    txt:'Foco em apartamentos 2–4 quartos com 1+ suíte e 2+ vagas em bairros consolidados de BH. Evitar terrenos e imóveis comerciais sem análise específica.' },
  { n:2, e:'🎯', t:'Score mínimo para ação',
    txt:'Score ≥ 7.0: avaliar compra. Score ≥ 8.0: sinal de compra imediata. Score < 6.0: evitar, salvo situação excepcional documentada pelo grupo.' },
  { n:3, e:'💡', t:'Margem de segurança (lance máximo)',
    txt:'Nunca pagar acima do lance máximo (MAO). Garante margem mínima de 20% mesmo no cenário mais pessimista — custo zero de reforma e valor de mercado estável.' },
  { n:4, e:'🔨', t:'Reforma dentro do teto',
    txt:'Máximo: 5% do valor do imóvel para Classe Popular/Médio, 6% para Alto, 7% para Luxo. Acima disso: risco real de sobrecapitalização.' },
  { n:5, e:'⚖️', t:'Verificação jurídica obrigatória',
    txt:'Toda análise passa pela equipe jurídica antes do lance. Documentos da matrícula devem ser anexados na aba Jurídico para reclassificação automática.' },
  { n:6, e:'👁️', t:'Presença física obrigatória',
    txt:'Verificar ocupação pessoalmente antes de fazer lance. O edital frequentemente indica ocupação errada ou desatualizada.' },
  { n:7, e:'⏱️', t:'Custo de oportunidade',
    txt:'Imóveis com prazo de liberação > 12 meses: calcular custo do capital imobilizado (~12% CDI a.a.) no ROI efetivo.' },
  { n:8, e:'🏢', t:'Estrutura de aquisição',
    txt:'CPF único para imóveis simples. Consórcio voluntário para múltiplos investidores. Holding/LTDA para operações recorrentes — consultar Pedro (jurídico).' },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const Tag = ({ text, cor }) => (
  <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:10,
    background:`${cor}18`, color:cor, border:`1px solid ${cor}30`, whiteSpace:'nowrap' }}>{text}</span>
)
const Box = ({ children, style }) => (
  <div style={{ background:P.white, border:`1px solid ${P.border}`,
    borderRadius:10, padding:'12px 14px', ...style }}>{children}</div>
)

// ─── SVG: SCORE ───────────────────────────────────────────────────────────────
function SvgScore() {
  return (
    <svg viewBox="0 0 460 195" style={{width:'100%',maxWidth:460,height:'auto'}} xmlns="http://www.w3.org/2000/svg">
      <rect width="460" height="195" rx="10" fill={P.surface}/>
      <text x="230" y="20" textAnchor="middle" fill={P.navy} fontSize="11" fontWeight="700">
        Composição do Score AXIS
      </text>
      {DIMS.map((d,i) => {
        const y = 35 + i*25, bw = d.peso * 4.5
        return (
          <g key={d.id}>
            <text x="88" y={y+10} textAnchor="end" fill={P.text} fontSize="9.5" fontWeight="600">{d.label}</text>
            <rect x="94" y={y} width={bw} height="16" rx="4" fill={d.cor} opacity="0.85"/>
            <text x={94+bw+5} y={y+11} fill={d.cor} fontSize="9" fontWeight="700">{d.peso}%</text>
          </g>
        )
      })}
      <line x1="215" y1="95" x2="280" y2="95" stroke={P.navy} strokeWidth="1.5" strokeDasharray="4"/>
      <polygon points="280,91 288,95 280,99" fill={P.navy}/>
      <text x="248" y="88" textAnchor="middle" fill={P.navy} fontSize="8" opacity="0.5">ponderada</text>
      <rect x="292" y="74" width="76" height="42" rx="10" fill={P.navy}/>
      <text x="330" y="92" textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="600">Score</text>
      <text x="330" y="107" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">0–10</text>
      {[
        [P.emerald, '≥ 8.0  COMPRAR imediato', 28],
        [P.mustard, '≥ 7.0  COMPRAR', 50],
        ['#E06A00','  6.0  AGUARDAR', 72],
        [P.red,    '< 6.0  EVITAR',   94],
      ].map(([c,l,y]) => (
        <g key={l}>
          <rect x="376" y={y+27} width="80" height="16" rx="5" fill={c} opacity="0.9"/>
          <text x="416" y={y+38} textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="700">{l}</text>
          <line x1="368" y1={y+35} x2="376" y2={y+35} stroke={c} strokeWidth="1" opacity="0.5"/>
        </g>
      ))}
      <line x1="368" y1="95" x2="376" y2="95" stroke={P.navy} strokeWidth="1" opacity="0.3"/>
      <line x1="368" y1="45" x2="368" y2="130" stroke={P.navy} strokeWidth="0.5" opacity="0.2"/>
      <text x="230" y="188" textAnchor="middle" fill={P.gray} fontSize="7.5">
        Pesos configuráveis: Admin → Config → Parâmetros Score
      </text>
    </svg>
  )
}

// ─── SVG: FLUXO ───────────────────────────────────────────────────────────────
function SvgFluxo() {
  const items = FLUXO.map(f => ({...f, label:f.titulo.split(' ')[0]}))
  const W=460, step=W/items.length
  return (
    <svg viewBox={`0 0 ${W} 95`} style={{width:'100%',maxWidth:W,height:'auto'}} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height="95" rx="10" fill={P.surface}/>
      {items.map((e,i) => {
        const cx = step*i + step/2
        return (
          <g key={i}>
            {i>0 && <>
              <line x1={cx-step+18} y1={36} x2={cx-18} y2={36} stroke={P.border} strokeWidth="1.5"/>
              <polygon points={`${cx-18},32 ${cx-12},36 ${cx-18},40`} fill={P.border}/>
            </>}
            <circle cx={cx} cy={36} r={15} fill={e.cor} opacity="0.88"/>
            <text x={cx} y={41} textAnchor="middle" fontSize="12">{e.icon}</text>
            <text x={cx} y={62} textAnchor="middle" fill={P.text} fontSize="8" fontWeight="700">{e.label}</text>
            <text x={cx} y={72} textAnchor="middle" fill={P.gray} fontSize="7">{e.tempo}</text>
            <text x={cx} y={83} textAnchor="middle"
              fill={e.custo==='grátis' ? P.emerald : P.mustard} fontSize="7" fontWeight="600">
              {e.custo}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── SVG: MAO ─────────────────────────────────────────────────────────────────
function SvgMAO() {
  return (
    <svg viewBox="0 0 400 135" style={{width:'100%',maxWidth:400,height:'auto'}} xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="135" rx="10" fill={P.surface}/>
      <text x="200" y="18" textAnchor="middle" fill={P.navy} fontSize="10" fontWeight="700">
        Como o MAO é calculado
      </text>
      <rect x="16" y="28" width="270" height="18" rx="5" fill={P.blue} opacity="0.12" stroke={P.blue} strokeWidth="1"/>
      <text x="151" y="41" textAnchor="middle" fill={P.blue} fontSize="9" fontWeight="600">Valor de Mercado (ex: R$ 700.000)</text>
      <rect x="16" y="52" width="216" height="18" rx="5" fill={P.navy} opacity="0.10" stroke={P.navy} strokeWidth="1"/>
      <text x="124" y="65" textAnchor="middle" fill={P.navy} fontSize="9" fontWeight="600">× 0,80 = R$ 560.000</text>
      <text x="236" y="64" fill={P.navy} fontSize="8" opacity="0.5">← margem 20%</text>
      <rect x="16" y="76" width="58" height="18" rx="5" fill={P.red} opacity="0.12" stroke={P.red} strokeWidth="1"/>
      <text x="45" y="89" textAnchor="middle" fill={P.red} fontSize="8.5" fontWeight="600">− R$ 60k</text>
      <text x="80" y="88" fill={P.gray} fontSize="8">custos totais (ITBI+docs+reforma+adv)</text>
      <rect x="16" y="100" width="155" height="18" rx="5" fill={P.emerald} opacity="0.88"/>
      <text x="93" y="113" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">MAO = R$ 500.000 ✓</text>
      <text x="177" y="112" fill={P.gray} fontSize="8">lance acima → ROI &lt; 20%</text>
      <line x1="346" y1="28" x2="346" y2="118" stroke={P.border} strokeWidth="1"/>
      <text x="356" y="44" fill={P.gray} fontSize="8.5">R$ 700k</text>
      <text x="356" y="68" fill={P.navy} fontSize="8.5">R$ 560k</text>
      <text x="356" y="92" fill={P.red} fontSize="8.5">R$ 500k</text>
      <text x="356" y="116" fill={P.emerald} fontSize="8" fontWeight="700">MAO</text>
      <line x1="344" y1="40" x2="348" y2="40" stroke={P.gray} strokeWidth="1"/>
      <line x1="344" y1="64" x2="348" y2="64" stroke={P.navy} strokeWidth="1"/>
      <line x1="344" y1="88" x2="348" y2="88" stroke={P.red} strokeWidth="1"/>
      <line x1="344" y1="109" x2="348" y2="109" stroke={P.emerald} strokeWidth="1.5"/>
    </svg>
  )
}

// ─── SVG: CASCATA IA ──────────────────────────────────────────────────────────
function SvgCascata() {
  const modelos = [
    { label:'Gemini 2.0 Flash', sub:'Motor principal', custo:'~R$0,03', cor:P.blue,    p:85 },
    { label:'DeepSeek V3',      sub:'Fallback 1',      custo:'~R$0,08', cor:P.purple,  p:8  },
    { label:'GPT-4o-mini',      sub:'Fallback 2',      custo:'~R$0,10', cor:'#10A37F',  p:5  },
  ]
  return (
    <svg viewBox="0 0 380 90" style={{width:'100%',maxWidth:380,height:'auto'}} xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="90" rx="10" fill={P.surface}/>
      <text x="190" y="16" textAnchor="middle" fill={P.navy} fontSize="10" fontWeight="700">
        Cascata de Modelos de IA
      </text>
      {modelos.map((m,i) => {
        const x = 12 + i*124
        return (
          <g key={m.label}>
            {i>0 && <>
              <line x1={x-4} y1={50} x2={x+4} y2={50} stroke={P.border} strokeWidth="1.5"/>
              <text x={x-2} y={44} textAnchor="middle" fill={P.gray} fontSize="7">falha</text>
            </>}
            <rect x={x+4} y={24} width={116} height={50} rx="8" fill={P.white}
              stroke={m.cor} strokeWidth="1.5"/>
            <circle cx={x+24} cy={49} r={10} fill={m.cor} opacity="0.9"/>
            <text x={x+24} y={53} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{i+1}</text>
            <text x={x+36} y={40} fill={m.cor} fontSize="9" fontWeight="700">{m.label}</text>
            <text x={x+36} y={52} fill={P.gray} fontSize="7.5">{m.sub}</text>
            <text x={x+36} y={64} fill={m.cor} fontSize="8" fontWeight="600">{m.custo}</text>
            <text x={x+110} y={32} textAnchor="end" fill={P.gray} fontSize="8">{m.p}%</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function ManualAxis({ isMobile }) {
  const [cnts, setCnts] = useState({})
  const [aba, setAba] = useState('guia')
  const [dadosVivos, setDadosVivos] = useState(null)
  const [carregandoVivos, setCarregandoVivos] = useState(false)

  // Carregar dados ao vivo ao abrir a aba banco
  useEffect(() => {
    if (aba !== 'banco' || dadosVivos) return
    setCarregandoVivos(true)
    import('../lib/supabase.js').then(async ({ supabase }) => {
      try {
        // Buritis como exemplo — bairro do imóvel ativo MG-007
        const [bairros, imovel] = await Promise.all([
          supabase.from('metricas_bairros').select('bairro,classe_ipead_label,preco_anuncio_m2,preco_contrato_m2,aluguel_2q_tipico,yield_bruto,tendencia_12m,vacancia_pct,liquidez_label,tempo_venda_dias,atualizado_em').order('bairro').limit(10),
          supabase.from('imoveis').select('codigo_axis,titulo,score_total,recomendacao,valor_mercado_estimado,mao_flip,aluguel_mensal_estimado,atualizado_em').eq('status_operacional','ativo').is('status_operacional', null).limit(3)
        ])
        const ativos = await supabase.from('imoveis').select('codigo_axis,titulo,score_total,recomendacao,valor_mercado_estimado,mao_flip,atualizado_em').or('status_operacional.eq.ativo,status_operacional.is.null').order('atualizado_em', { ascending: false }).limit(5)
        setDadosVivos({ bairros: bairros.data || [], ativos: ativos.data || [] })
      } catch(e) { console.warn('[Manual] dados vivos:', e.message) }
      finally { setCarregandoVivos(false) }
    })
  }, [aba])
  const [busca, setBusca] = useState('')
  const [tabIdx, setTabIdx] = useState(0)
  const [dimSel, setDimSel] = useState(null)

  useEffect(() => {
    import('../lib/supabase.js').then(({ supabase }) => {
      const ts = ['imoveis','mercado_regional','metricas_bairros','riscos_juridicos','jurimetria_varas','modelos_analise']
      Promise.all(ts.map(t =>
        supabase.from(t).select('*',{count:'exact',head:true}).then(({count}) => [t,count])
      )).then(res => {
        const c = {}; res.forEach(([t,n]) => { c[t]=n }); setCnts(c)
      }).catch(() => {})
    })
  }, [])

  const [faqAberto, setFaqAberto] = useState(null)
  const [glossAbertos, setGlossAbertos] = useState(new Set())
  const toggleGloss = (t) => setGlossAbertos(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })
  const FAQ = [
    { q:'O que é o Score AXIS e como é calculado?', a:'O Score AXIS é uma nota de 0 a 10 que combina 6 dimensões: Localização (20%), Desconto (18%), Jurídico (18%), Ocupação (15%), Liquidez (15%) e Mercado (14%). Cada dimensão é avaliada de 0 a 10 e ponderada pelo peso correspondente.' },
    { q:'Qual a diferença entre "Desconto s/avaliação" e "Desconto s/mercado"?', a:'O desconto sobre avaliação compara o lance mínimo com o valor oficial da avaliação judicial. O desconto sobre mercado compara com o valor real estimado pelo motor IA. O segundo é mais confiável para decisão de investimento.' },
    { q:'O que significa cada recomendação?', a:'COMPRAR: score ≥ 5.5 com ROI positivo e riscos controlados. AGUARDAR: potencial existe mas há pendências ou preço alto. EVITAR: riscos graves, ROI negativo ou mercado desfavorável.' },
    { q:'Como funciona a análise de matrícula?', a:'O agente jurídico faz OCR na matrícula via Gemini Vision, extrai atos registrais (R., Av., AV-) e monta timeline. Identifica ônus, indisponibilidades, penhoras e alienações, classificando gravidade.' },
    { q:'O que é o Preditor de Concorrência?', a:'Estima quantos licitantes podem participar baseado em desconto, localização, tipologia, praça e dados históricos. Mais concorrência = lance final mais alto.' },
    { q:'Posso confiar nos comparáveis?', a:'Comparáveis são gerados pelo motor IA a partir de portais reais (ZAP, VivaReal, QuintoAndar). Links gerados para verificação. Recomendamos validar presencialmente.' },
    { q:'O que é mercado direto vs. leilão?', a:'Leilão: hasta pública com desconto forçado mas riscos jurídicos. Mercado direto: compra convencional sem desconto mas sem riscos de arrematação.' },
    { q:'Como interpretar ROI e cenários?', a:'ROI considera todos os custos e compara com valor de saída. Cenários: Otimista (venda rápida acima mercado), Realista (mercado em prazo médio), Rápido (abaixo com liquidez) e Locação (renda passiva).' },
    { q:'O AXIS substitui consultoria jurídica?', a:'Não. O AXIS é ferramenta de apoio. Toda arrematação deve ser precedida de due diligence, consulta com advogado e verificação de matrícula atualizada.' },
  ]

  const ABAS = [
    ['guia','📖 O AXIS'],['score','🎯 Score'],['fluxo','⚙️ Fluxo'],
    ['mercado','📈 Mercado BH'],['juridico','⚖️ Jurisprudência'],['financiamento','🏦 Financiamento'],
    ['banco','🗄️ Base de Dados'],['glossario','📚 Glossário'],['diretrizes','📋 Diretrizes'],['faq','❓ FAQ'],
  ]
  const glossFilt = GLOSS.filter(g =>
    !busca || g.t.toLowerCase().includes(busca.toLowerCase()) || g.def.toLowerCase().includes(busca.toLowerCase())
  )
  const tb = TABELAS[tabIdx]
  const nums = {
    mercado_regional: cnts['mercado_regional']??16,
    metricas_bairros: cnts['metricas_bairros']??29,
    riscos_juridicos: cnts['riscos_juridicos']??15,
    jurimetria_varas: cnts['jurimetria_varas']??6,
    imoveis: cnts['imoveis']??'—',
    modelos_analise: cnts['modelos_analise']??5,
  }

  const tabBtn = (k,l) => (
    <button key={k} onClick={() => setAba(k)} style={{
      padding:'7px 12px', borderRadius:8, fontSize:11.5, cursor:'pointer',
      fontWeight: aba===k ? 700 : 400,
      border:`1px solid ${aba===k ? C.navy : C.borderW}`,
      background: aba===k ? C.navy : C.white,
      color: aba===k ? '#fff' : C.muted
    }}>{l}</button>
  )

  return (
    <div style={{ padding: isMobile ? '14px 12px' : '20px 28px', maxWidth:880 }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.navy, marginBottom:4 }}>📖 Manual AXIS</div>
        <div style={{ fontSize:12, color:C.muted }}>Guia completo · Base de dados · Glossário · Diretrizes</div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap' }}>
        {ABAS.map(([k,l]) => tabBtn(k,l))}
      </div>

      {/* ─── ABA: O AXIS ─────────────────────────────────────────────── */}
      {aba === 'guia' && (
        <div>
          <Box style={{ marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:P.navy, marginBottom:8 }}>O que é o AXIS?</div>
            <div style={{ fontSize:12.5, color:P.text, lineHeight:1.8 }}>
              O AXIS é uma plataforma de inteligência patrimonial para análise de imóveis em
              <strong> leilão judicial</strong> e <strong>mercado direto</strong> (VivaReal, QuintoAndar, ZAP).
              Cole um link e em <strong>menos de 60 segundos</strong> você recebe:
              score multidimensional, MAO automático, ROI por cenário de reforma (SINAPI-MG 2026),
              análise jurídica, estimativa de aluguel homogeneizada e
              relatório exportável com fotos — tudo com base em dados reais de BH e região.
            </div>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              {['Score 6D','Gemini 2.0 + Grounding','SINAPI reforma','MAO automático','Mercado direto','Leilão judicial','Export WhatsApp','Export Excel/PDF','Link público','Análise em lote','Pós-leilão auto','Custo ~R$0,03'].map(f => (
                <Tag key={f} text={f} cor={P.navy}/>
              ))}
            </div>
          </Box>

          <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              {icon:'🏆',t:'Diferencial',cor:P.navy,txt:'Score 6D + IA dual + SINAPI + MAO automático + homogeneização NBR 14653 + jurimetria real. Suporta leilão E mercado direto.'},
              {icon:'💰',t:'Custo ~R$0,03',cor:P.emerald,txt:'Gemini 2.0 Flash como motor principal. Fallback: DeepSeek → GPT-4o-mini → Claude. Para sites SPA (QuintoAndar): Gemini Grounding busca via Google.'},
              {icon:'🔄',t:'Cascata de IA',cor:P.purple,txt:'Gemini 2.0-flash → DeepSeek V3 → GPT-4o-mini → Claude Sonnet. Detecção automática de SPA com Google Search Grounding.'},
              {icon:'📄',t:'Export completo',cor:P.blue,txt:'Relatório HTML com fotos base64 embutidas — funciona no WhatsApp, email e offline. Abas interativas no browser, flat mode sem JS.'},
              {icon:'📊',t:'Export Carteira (Sprint 10)',cor:P.blue,txt:'Exporta toda a carteira ativa em Excel (.xlsx, 2 abas, 35+ colunas) ou PDF (HTML A4 paisagem com KPIs). Botões no Dashboard.'},
              {icon:'⏰',t:'Pós-Leilão Auto (Sprint 10)',cor:P.red,txt:'PainelPosLeilao no Dashboard detecta leilões vencidos e próximos (D-14). Botões Arrematado/Não Arrematado direto, sem abrir o imóvel.'},
              {icon:'🔗',t:'Link Público (Sprint 10)',cor:P.purple,txt:'Compartilhe análise via link sem login — token de 16 chars, validade 30 dias. Viewer completo com Score 6D, KPIs, síntese. Rota: /#/share/:token.'},
              {icon:'🤖',t:'Análise em Lote (Sprint 10)',cor:P.emerald,txt:'Multi-select na lista de imóveis + botão "Analisar Docs". Loop automático: texto salvo → Jina fallback → Gemini. Progresso em tempo real.'},
              {icon:'⚖️',t:'Agente Jurídico IA (Sprint 11)',cor:P.purple,txt:'Upload de PDFs do edital e matrícula. Análise com Claude Vision: extração de ônus, dívidas, processos, score jurídico 0-10. Timeline da matrícula com histórico de alienações.'},
              {icon:'🏗️',t:'Reforma Inteligente SINAPI (Sprint 21)',cor:P.red,txt:'Cenários Básico/Médio/Completo com itens reais do SINAPI-MG 2026. Custo por m², viabilidade por cenário, análise de sobrecapitalização. Reformas calibradas por padrão de acabamento.'},
              {icon:'🎯',t:'Score Radar + Confidence (Sprint 25)',cor:P.navy,txt:'Radar visual das 6 dimensões do score (Loc/Desc/Jur/Ocup/Liq/Merc). Badge de confiança 0-100% com diagnóstico de fraquezas. Escala unificada 0-100 no display.'},
              {icon:'📊',t:'Índice AXIS + MAO Duplo (Sprint 27)',cor:P.emerald,txt:'MAO flip (ROI 20%) e MAO locação (yield 6%) calculados separadamente. Débitos do arrematante incorporados no MAO. Faixa vermelha kill-switch quando score jurídico crítico.'},
              {icon:'🏠',t:'Yield Airbnb por Bairro (Sprint 28)',cor:P.amber,txt:'PainelYieldModalidades com 3 cenários: residencial, corporativo e Airbnb. Buritis, Gutierrez, Belvedere e outros bairros elegíveis com fator multiplicador por demanda turística.'},
              {icon:'⏳',t:'Próximos Leilões + Countdown (Sprint 33)',cor:P.red,txt:'Vista dedicada com countdown em tempo real para 1ª e 2ª praça. Semáforo urgência: vermelho ≤7d, laranja ≤15d, amarelo ≤30d. Banner global no topo quando há leilão ≤15 dias.'},
              {icon:'⚖️',t:'Consulta Datajud CNJ (Sprint 35)',cor:P.purple,txt:'Botão no card de processo — consulta a API pública do CNJ em 1 clique. Exibe classe, vara, movimentos relevantes (hasta, penhora, extinção) e auto-preenche vara_judicial.'},
              {icon:'🎯',t:'Decisão de Lance (Sprint 35)',cor:P.emerald,txt:'Painel no Resumo Pré-Leilão para registrar lance máximo, estratégia (flip/locação/híbrido) e ver ROI em tempo real. Exporta PDF A4 executivo com 1 página de decisão para imprimir.'},
            ].map(({icon,t,cor,txt}) => (
              <Box key={t} style={{ borderLeft:`3px solid ${cor}` }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color:cor, marginBottom:4 }}>{t}</div>
                <div style={{ fontSize:11, color:P.gray, lineHeight:1.5 }}>{txt}</div>
              </Box>
            ))}
          </div>

          <Box style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:P.navy, marginBottom:10 }}>📊 Estado atual do banco</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[['🗺️',nums.mercado_regional,'regiões'],['🏘️',nums.metricas_bairros,'bairros BH'],['⚖️',nums.riscos_juridicos,'tipos risco'],
                ['🏛️',nums.jurimetria_varas,'varas judiciais'],['🏠',nums.imoveis,'imóveis grupo'],['🤖',nums.modelos_analise,'modelos IA']].map(([i,n,l]) => (
                <div key={l} style={{ textAlign:'center', padding:'8px 4px', background:P.surface, borderRadius:8 }}>
                  <div style={{ fontSize:18 }}>{i}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:P.navy }}>{n}</div>
                  <div style={{ fontSize:9, color:P.gray }}>{l}</div>
                </div>
              ))}
            </div>
          </Box>

          <Box>
            <div style={{ fontSize:12, fontWeight:700, color:P.navy, marginBottom:8 }}>Cascata de modelos de IA</div>
            <SvgCascata/>
            <div style={{ marginTop:8, fontSize:11, color:P.gray, lineHeight:1.5 }}>
              Na prática 85%+ das análises rodam com Gemini 2.0 Flash (~R$0,03). Para sites SPA (QuintoAndar, Loft) que bloqueiam scraping, o Gemini usa <strong>Google Search Grounding</strong> para buscar dados diretamente na web. DeepSeek, GPT-4o-mini e Claude são backups automáticos.
            </div>
          </Box>
        </div>
      )}

      {/* ─── ABA: SCORE ──────────────────────────────────────────────── */}
      {aba === 'score' && (
        <div>
          <Box style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:P.navy, marginBottom:8 }}>Como o score é calculado?</div>
            <div style={{ fontSize:12, color:P.text, lineHeight:1.7, marginBottom:12 }}>
              O score é uma <strong>média ponderada de 6 dimensões</strong>, cada uma avaliada de 0 a 10 pela IA.
              Os pesos refletem o que o grupo definiu como prioritário em leilões de BH.
            </div>
            <SvgScore/>
            <div style={{ marginTop:10, padding:'8px 12px', background:P.navyL, borderRadius:8,
              fontSize:11, color:P.navy, lineHeight:1.6 }}>
              <strong>Exemplo real — Dona Clara (BH-2026-0002):</strong> 8.5×20% + 7.8×18% + 7.0×18% +
              5.5×15% + 6.5×15% + 7.0×14% = <strong>7.14 → COMPRAR ✓</strong>
            </div>
          </Box>

          <div style={{ fontSize:12, fontWeight:600, color:P.navy, marginBottom:8 }}>
            Clique em uma dimensão para ver detalhes e exemplos de notas:
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {DIMS.map(d => (
              <div key={d.id} onClick={() => setDimSel(dimSel?.id===d.id ? null : d)}
                style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer',
                  border:`1.5px solid ${dimSel?.id===d.id ? d.cor : P.border}`,
                  background: dimSel?.id===d.id ? `${d.cor}10` : P.white,
                  transition:'all .15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:14 }}>{d.icon}</span>
                  <Tag text={`${d.peso}%`} cor={d.cor}/>
                </div>
                <div style={{ fontSize:11.5, fontWeight:600, color:P.navy, marginTop:4 }}>{d.label}</div>
              </div>
            ))}
          </div>

          {dimSel && (
            <Box style={{ borderLeft:`3px solid ${dimSel.cor}`, marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:dimSel.cor, marginBottom:6 }}>
                {dimSel.icon} {dimSel.label} · peso {dimSel.peso}%
              </div>
              <div style={{ fontSize:12, color:P.text, lineHeight:1.7, marginBottom:8 }}>{dimSel.desc}</div>
              <div style={{ fontSize:11, fontWeight:600, color:P.navy, marginBottom:6 }}>Exemplos de notas:</div>
              {dimSel.exemplos.map((e,i) => (
                <div key={i} style={{ fontSize:11, color:P.text, padding:'5px 10px',
                  marginBottom:5, background:P.surface, borderRadius:6 }}>• {e}</div>
              ))}
            </Box>
          )}

          <Box>
            <div style={{ fontSize:12, fontWeight:700, color:P.navy, marginBottom:8 }}>Calculando o Lance Máximo (MAO)</div>
            <SvgMAO/>
            <div style={{ marginTop:8, fontSize:11, color:P.gray, lineHeight:1.6 }}>
              O lance máximo é calculado automaticamente pelo motor AXIS para cada imóvel.
              Lance acima deste limite = ROI abaixo de 20% antes de custos adicionais.
            </div>
          </Box>
        </div>
      )}

      {/* ─── ABA: FLUXO ──────────────────────────────────────────────── */}
      {aba === 'fluxo' && (
        <div>
          <Box style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:P.navy, marginBottom:6 }}>
              Do link ao relatório — 8 etapas automáticas
            </div>
            <div style={{ fontSize:11, color:P.gray, marginBottom:10 }}>
              Tempo total: <strong>30–60 segundos</strong> · Custo total: <strong>~R$ 0,01</strong>
            </div>
            <SvgFluxo/>
          </Box>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {FLUXO.map((f,i) => (
              <div key={f.n} style={{ display:'flex', gap:12 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:f.cor,
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, flexShrink:0 }}>{f.icon}</div>
                  {i < FLUXO.length-1 && (
                    <div style={{ width:2, flex:1, background:P.border, margin:'4px 0', minHeight:10 }}/>
                  )}
                </div>
                <Box style={{ flex:1, padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:P.navy }}>{f.n}. {f.titulo}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <Tag text={f.tempo} cor={P.gray}/>
                      <Tag text={f.custo} cor={f.custo==='grátis' ? P.emerald : P.mustard}/>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:P.gray, lineHeight:1.5 }}>{f.desc}</div>
                </Box>
              </div>
            ))}
          </div>

          <Box style={{ marginTop:14, background:P.emeraldL, border:`1px solid ${P.emerald}30` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:P.emerald, marginBottom:2 }}>Custo total por análise</div>
                <div style={{ fontSize:11, color:P.text }}>
                  Gemini Flash: <strong>~R$ 0,01</strong> · Claude Sonnet: ~R$ 2,20 · <span style={{color:P.gray}}>Redução de 99,5%</span>
                </div>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:P.emerald }}>~R$ 0,01</div>
            </div>
          </Box>
        </div>
      )}

      {/* ─── ABA: MERCADO BH (NOVA) ─────────────────────────────────── */}
      {aba === 'mercado' && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:P.navy, marginBottom:8 }}>📊 Panorama do Mercado Imobiliário BH — Q1/2026</div>
          <div style={{ fontSize:11.5, color:P.text, lineHeight:1.7, marginBottom:14 }}>
            Preços de venda recuaram <strong>-0,41%</strong> no 1º trimestre, mas aluguéis acumulam <strong>+10,52%</strong> em 12 meses.
            Vendas de imóveis prontos avançaram <strong>35%</strong> — maior resultado já catalogado pelo Secovi-MG.
            Vacância em mínima histórica: estoque de apenas <strong>7 meses</strong> de demanda.
          </div>

          {/* Cards indicadores */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:14 }}>
            {[
              { v:'R$ 10.595', sub:'Preço m²/venda', fonte:'FipeZAP fev/26', cor:P.navy },
              { v:'R$ 48,28', sub:'Preço m²/aluguel', fonte:'FipeZAP fev/26', cor:P.blue },
              { v:'5,96%', sub:'Yield bruto nacional', fonte:'FipeZAP dez/25', cor:P.emerald },
              { v:'7 meses', sub:'Estoque BH+NL', fonte:'Sinduscon-MG', cor:P.mustard },
              { v:'+35%', sub:'Vendas prontos 1T/26', fonte:'Secovi-MG', cor:P.emerald },
              { v:'200 mil', sub:'Déficit habitacional', fonte:'FJP', cor:P.red },
            ].map(({ v, sub, fonte, cor }) => (
              <div key={sub} style={{ background:P.white, border:`1px solid ${P.border}`, borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:800, color:cor }}>{v}</div>
                <div style={{ fontSize:9.5, color:P.gray, marginTop:2 }}>{sub}</div>
                <div style={{ fontSize:8, color:P.border, marginTop:1 }}>{fonte}</div>
              </div>
            ))}
          </div>

          {/* Aluguel por bairro */}
          <Box style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:8 }}>🔥 Top 10 valorização aluguel (QuintoAndar 2025)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 12px' }}>
              {[['Barro Preto','+47,7%'],['São Pedro','+46,8%'],['Santa Efigênia','+41,8%'],
                ['Centro','+39,9%'],['Anchieta','+33,7%'],['Serra','+33,1%'],
                ['Santo Agostinho','+31,7%'],['Sagrada Família','+28,5%'],
                ['Santa Mônica','+27,3%'],['Prado','+26,3%']
              ].map(([b,v]) => (
                <div key={b} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:`1px solid ${P.border}`, fontSize:10.5 }}>
                  <span style={{ color:P.text }}>{b}</span>
                  <span style={{ color:P.emerald, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9, color:P.gray, marginTop:6 }}>
              Apenas 3 bairros com queda: Funcionários (-6,9%), Luxemburgo (-4,2%), Camargos (-1,7%).
              Aluguel por tipologia: 1q <strong>R$ 65,60/m²</strong> · 2q <strong>R$ 42,49/m²</strong> · 3q <strong>R$ 39,77/m²</strong>
            </div>
          </Box>

          {/* Custos de construção */}
          <Box style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:6 }}>🏗️ Custos de Construção MG</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[['CUB R8-N','R$ 2.504,80/m²','Sinduscon-MG jan/26'],['SINAPI MG','R$ 1.811,56/m²','IBGE/Caixa dez/25']].map(([t,v,f]) => (
                <div key={t} style={{ background:`${P.navyL}`, borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, color:P.gray }}>{t}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:P.navy }}>{v}</div>
                  <div style={{ fontSize:8, color:P.gray }}>{f}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9.5, color:P.text, marginTop:6, lineHeight:1.5 }}>
              O CUB R8-N serve como <strong>piso de custo de reposição</strong> — se o preço arrematado está abaixo do CUB, o imóvel custa menos que construir novo.
              MG teve a <strong>maior variação estadual</strong> em dez/2025 (+3,34%), por acordo coletivo de mão de obra.
            </div>
          </Box>

          {/* Leilões */}
          <Box>
            <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:6 }}>🔨 Mercado de Leilões</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {[['📈 +86%','Crescimento leilões 2023→2024'],['💰 59%','Deságio médio residencial'],['🏠 47 mil','Retomados Caixa 2024']].map(([v,l]) => (
                <div key={l} style={{ background:P.mustardL, borderRadius:8, padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:P.mustard }}>{v}</div>
                  <div style={{ fontSize:8, color:P.gray, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9.5, color:P.text, marginTop:8, lineHeight:1.5 }}>
              Deságio médio: <strong>59%</strong> (geral) · <strong>44%</strong> (ocupados). 92,6% dos compradores são PF, 47% para moradia.
              Piso legal: <strong>50%</strong> da avaliação (abaixo = preço vil, art. 891 CPC).
            </div>
          </Box>
        </div>
      )}

      {/* ─── ABA: JURISPRUDÊNCIA (NOVA) ──────────────────────────────── */}
      {aba === 'juridico' && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:P.navy, marginBottom:10 }}>⚖️ Jurisprudência Atualizada — STJ e TJMG</div>
          <div style={{ fontSize:11, color:P.text, lineHeight:1.6, marginBottom:14 }}>
            Decisões que impactam diretamente o score AXIS e a viabilidade de leilões.
          </div>

          {[
            { tema:'Tema 1.134', titulo:'Arrematante NÃO responde por tributos anteriores',
              corpo:'A 1ª Seção do STJ fixou tese vinculante: sub-rogação ocorre sobre o preço, não sobre o arrematante (art. 130, §único, CTN). Aplica-se a editais publicados após a ata de julgamento.',
              processo:'REsp 1.914.902, 1.944.757, 1.961.835', data:'Out/2024', cor:P.emerald, impacto:'+1.5 score jurídico' },
            { tema:'Preço Vil', titulo:'Vedação estendida a leilões extrajudiciais',
              corpo:'A vedação ao preço vil (< 50% da avaliação) aplica-se também à execução extrajudicial em alienação fiduciária. Matéria de ordem pública.',
              processo:'REsp 2.096.465/SP', data:'Mai/2024', cor:P.mustard, impacto:'Limita desconto a 50%' },
            { tema:'Condominiais', titulo:'Arrematante responde SOMENTE se constar no edital',
              corpo:'Obrigação propter rem, mas STJ definiu que débitos anteriores são responsabilidade do arrematante apenas se expressamente declarados no edital.',
              processo:'REsp 1.672.508/SP', data:'2024', cor:P.blue, impacto:'Verificar edital' },
            { tema:'Tema 1.113', titulo:'Base de cálculo do ITBI = valor de mercado',
              corpo:'Valor declarado pelo contribuinte goza de presunção de veracidade. Prefeitura não pode arbitrar base unilateralmente. Em BH: ITBI 3% sobre valor venal ou transação (o maior).',
              processo:'Repetitivos — 1ª Seção STJ', data:'2023', cor:P.navy, impacto:'ITBI pode ser > lance' },
            { tema:'Tema 1.266', titulo:'Penhora por dívida condominial em alienação fiduciária',
              corpo:'PENDENTE DE JULGAMENTO. Impacto potencial em imóveis financiados com débitos condominiais.',
              processo:'Pendente', data:'—', cor:P.red, impacto:'⚠️ Monitorar' },
          ].map(j => (
            <Box key={j.tema} style={{ marginBottom:10, borderLeft:`3px solid ${j.cor}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                <div>
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, background:`${j.cor}15`, color:j.cor }}>{j.tema}</span>
                  <span style={{ fontSize:9, color:P.gray, marginLeft:6 }}>{j.data}</span>
                </div>
                <span style={{ fontSize:8, fontWeight:600, color:j.cor }}>{j.impacto}</span>
              </div>
              <div style={{ fontSize:11.5, fontWeight:700, color:P.text, marginBottom:3 }}>{j.titulo}</div>
              <div style={{ fontSize:10.5, color:P.gray, lineHeight:1.6 }}>{j.corpo}</div>
              <div style={{ fontSize:8.5, color:P.border, marginTop:4 }}>{j.processo}</div>
            </Box>
          ))}
        </div>
      )}

      {/* ─── ABA: FINANCIAMENTO (NOVA) ───────────────────────────────── */}
      {aba === 'financiamento' && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:P.navy, marginBottom:10 }}>🏦 Financiamento Pós-Arrematação — Taxas 2026</div>

          {/* Tabela de bancos */}
          <Box style={{ marginBottom:12, padding:0, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px', gap:0, fontSize:10 }}>
              <div style={{ padding:'6px 10px', background:P.navy, color:'#fff', fontWeight:700 }}>Banco</div>
              <div style={{ padding:'6px 8px', background:P.navy, color:'#fff', fontWeight:700, textAlign:'center' }}>Taxa mín.</div>
              <div style={{ padding:'6px 8px', background:P.navy, color:'#fff', fontWeight:700, textAlign:'center' }}>LTV</div>
              <div style={{ padding:'6px 8px', background:P.navy, color:'#fff', fontWeight:700, textAlign:'center' }}>Prazo</div>
              {[
                ['🏦 Caixa','10,26%','80%','420m'],['🏦 BRB','11,36%','80%','360m'],
                ['🏦 Itaú','11,60%','80%','360m'],['🏦 Santander','11,69%','80%','420m'],
                ['🏦 Bradesco','11,70%','80%','360m'],['🏦 BB (Pró-Cotista)','9,00%','80%','360m'],
              ].map(([b,t,l,p], i) => (
                [b,t,l,p].map((cell, ci) => (
                  <div key={`${i}-${ci}`} style={{ padding:'5px 10px', background:i%2===0?P.surface:P.white, borderBottom:`1px solid ${P.border}`,
                    textAlign:ci>0?'center':'left', fontWeight:ci===1?700:400, color:ci===1?P.emerald:P.text }}>
                    {cell}
                  </div>
                ))
              ))}
            </div>
          </Box>

          {/* Destaques */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <Box style={{ background:P.emeraldL, border:`1px solid ${P.emerald}30` }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.emerald, marginBottom:4 }}>✅ Caixa — leilões próprios</div>
              <div style={{ fontSize:24, fontWeight:800, color:P.emerald }}>95%</div>
              <div style={{ fontSize:9, color:P.gray }}>LTV máximo em extrajudicial próprio</div>
            </Box>
            <Box style={{ background:P.redL, border:`1px solid ${P.red}30` }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.red, marginBottom:4 }}>❌ Leilão judicial</div>
              <div style={{ fontSize:11, fontWeight:700, color:P.red, marginTop:8 }}>Pagamento à vista</div>
              <div style={{ fontSize:9, color:P.gray }}>Bancos não financiam hasta pública judicial</div>
            </Box>
          </div>

          {/* FGTS */}
          <Box style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:6 }}>💳 FGTS em Leilão</div>
            <div style={{ fontSize:10.5, color:P.text, lineHeight:1.7 }}>
              <strong>Extrajudicial:</strong> pode usar para entrada se edital autorizar. Requisitos: 3+ anos contribuição, imóvel urbano residencial até <strong>R$ 2,25 mi</strong> (teto SFH out/2025), cidade onde reside há 1+ ano, sem outro SFH ativo.
            </div>
            <div style={{ fontSize:10.5, color:P.gray, lineHeight:1.7, marginTop:4 }}>
              <strong>Judicial:</strong> só para amortizar financiamento posterior, não na arrematação.
            </div>
          </Box>

          {/* Emolumentos */}
          <Box>
            <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:6 }}>📋 Emolumentos Cartoriais MG 2026</div>
            <div style={{ fontSize:10, color:P.gray, marginBottom:6 }}>Portaria 8.664/CGJ/2025 · UFEMG R$ 5,7899</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 10px', fontSize:10 }}>
              {[['Até R$ 105k','R$ 2.928'],['R$ 175-280k','R$ 4.772'],['R$ 350-420k','R$ 5.035'],
                ['R$ 560-700k','R$ 5.826'],['R$ 840k-1,12M','R$ 6.866'],['R$ 1,68-3,2M','R$ 8.582']
              ].map(([f,v]) => (
                <div key={f} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:`1px solid ${P.border}` }}>
                  <span style={{ color:P.gray }}>{f}</span>
                  <span style={{ color:P.text, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9, color:P.gray, marginTop:6 }}>SFH/SFI: desconto de 80% · Promessa/compromisso: 50% · Simulador: simulador.corimg.org</div>
          </Box>
        </div>
      )}

      {/* ─── ABA: BASE DE DADOS ──────────────────────────────────────── */}
      {aba === 'banco' && (
        <div>
          {/* Dados ao vivo do banco */}
          {carregandoVivos && <div style={{ fontSize:12, color:P.gray, padding: '12px 0' }}>⏳ Carregando dados do banco...</div>}
          {dadosVivos && dadosVivos.bairros.length > 0 && (
            <div style={{ marginBottom:16, background:P.navyL, border:`1px solid ${P.navy}20`, borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:P.navy, marginBottom:8 }}>
                📡 Dados em tempo real — metricas_bairros (Top bairros BH)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10.5 }}>
                  <thead>
                    <tr style={{ background:`${P.navy}10` }}>
                      {['Bairro','Classe','Anúncio/m²','Contrato/m²','Aluguel 2q','Yield','Tend.12m','Vacância','Atualizado'].map(h => (
                        <th key={h} style={{ padding:'5px 8px', textAlign:'left', color:P.navy, fontWeight:700, whiteSpace:'nowrap', borderBottom:`1px solid ${P.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosVivos.bairros.map((b,i) => (
                      <tr key={b.bairro} style={{ background: i%2===0 ? P.white : P.surface }}>
                        <td style={{ padding:'5px 8px', fontWeight:600, color:P.text }}>{b.bairro}</td>
                        <td style={{ padding:'5px 8px', color:P.gray }}>{b.classe_ipead_label||'—'}</td>
                        <td style={{ padding:'5px 8px', color:P.emerald, fontWeight:600 }}>R${Number(b.preco_anuncio_m2||0).toLocaleString('pt-BR')}</td>
                        <td style={{ padding:'5px 8px', color:P.navy, fontWeight:700 }}>R${Number(b.preco_contrato_m2||0).toLocaleString('pt-BR')}</td>
                        <td style={{ padding:'5px 8px', color:P.purple }}>R${Number(b.aluguel_2q_tipico||0).toLocaleString('pt-BR')}/m²</td>
                        <td style={{ padding:'5px 8px', color:P.mustard }}>{b.yield_bruto||'—'}%</td>
                        <td style={{ padding:'5px 8px', color:Number(b.tendencia_12m)>0?P.emerald:P.red }}>{b.tendencia_12m>0?'+':''}{b.tendencia_12m||'—'}%</td>
                        <td style={{ padding:'5px 8px', color:P.gray }}>{b.vacancia_pct||'—'}%</td>
                        <td style={{ padding:'5px 8px', color:P.gray, fontSize:9.5 }}>{b.atualizado_em ? new Date(b.atualizado_em).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ fontSize:12, color:P.gray, marginBottom:12, lineHeight:1.6 }}>
            O AXIS usa <strong>bases de dados proprietárias</strong> para análise — sem consultas externas em tempo real.
            Cada tabela tem fonte auditável, data de atualização e amostragem documentada.
          </div>

          <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
            {TABELAS.map((t,i) => (
              <button key={t.nome} onClick={() => setTabIdx(i)} style={{
                padding:'5px 10px', borderRadius:7, fontSize:11, cursor:'pointer',
                fontWeight: tabIdx===i ? 700 : 400,
                border:`1px solid ${tabIdx===i ? t.cor : P.border}`,
                background: tabIdx===i ? `${t.cor}12` : P.white,
                color: tabIdx===i ? t.cor : P.gray,
              }}>{t.icone} {t.titulo}</button>
            ))}
          </div>

          {tb && (
            <div>
              <Box style={{ marginBottom:10, borderLeft:`3px solid ${tb.cor}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:tb.cor, marginBottom:4 }}>
                      {tb.icone} {tb.titulo}
                    </div>
                    <span style={{ fontSize:10, fontFamily:'monospace', color:P.gray,
                      background:P.surface, padding:'1px 6px', borderRadius:4, border:`1px solid ${P.border}` }}>
                      {tb.nome}
                    </span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:tb.cor }}>
                      {nums[tb.nome] ?? '—'}
                    </div>
                    <div style={{ fontSize:9, color:P.gray }}>registros ativos</div>
                  </div>
                </div>

                <div style={{ fontSize:12, color:P.text, lineHeight:1.7, marginBottom:10 }}>
                  {tb.descricao}
                </div>

                <div style={{ padding:'8px 12px', background:`${tb.cor}0D`, border:`1px solid ${tb.cor}25`,
                  borderRadius:8, marginBottom:10, fontSize:11, color:tb.cor, fontWeight:600 }}>
                  📊 Amostragem: {tb.amostragem}
                </div>

                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:P.navy, marginBottom:6 }}>Fontes de dados:</div>
                  {tb.fontes.map(f => (
                    <div key={f} style={{ fontSize:11, color:P.gray, padding:'4px 0',
                      borderBottom:`1px solid ${P.border}`, display:'flex', gap:6 }}>
                      <span style={{ color:tb.cor }}>•</span>{f}
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:P.navy, marginBottom:6 }}>Campos principais:</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {tb.campos.map(c => (
                      <span key={c} style={{ fontSize:9.5, padding:'2px 7px', borderRadius:4,
                        background:P.surface, color:P.gray, fontFamily:'monospace',
                        border:`1px solid ${P.border}` }}>{c}</span>
                    ))}
                  </div>
                </div>
              </Box>

              <Box style={{ background:P.navyL, border:`1px solid ${P.navy}20` }}>
                <div style={{ fontSize:11, fontWeight:700, color:P.navy, marginBottom:8 }}>
                  📋 Exemplo de registro real desta tabela:
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'5px 16px' }}>
                  {Object.entries(tb.exemplo).map(([k,v]) => (
                    <div key={k} style={{ display:'contents' }}>
                      <span style={{ fontSize:10.5, fontFamily:'monospace', color:P.gray, fontWeight:600 }}>{k}:</span>
                      <span style={{ fontSize:10.5, fontFamily:'monospace', color:P.navy, fontWeight:700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Box>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA: GLOSSÁRIO ──────────────────────────────────────────── */}
      {aba === 'glossario' && (
        <div>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar termo, sigla, conceito..."
            style={{ width:'100%', padding:'9px 14px', borderRadius:9,
              border:`1px solid ${P.border}`, fontSize:13, marginBottom:10,
              background:P.white, color:P.text, outline:'none', boxSizing:'border-box' }}/>

          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
            {['Todos','Financeiro','Jurídico','Mercado','IA','Leilão','Análise'].map(c => (
              <button key={c} onClick={() => setBusca(c==='Todos' ? '' : c)}
                style={{ padding:'3px 10px', borderRadius:6, fontSize:10.5, cursor:'pointer',
                  border:`1px solid ${P.border}`, background:P.surface, color:P.gray }}>
                {c}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {glossFilt.map(g => {
              const aberto = glossAbertos.has(g.t)
              return (
                <Box key={g.t} style={{ borderLeft:`3px solid ${g.cor}`, padding:'0', overflow:'hidden' }}>
                  {/* Header clicável */}
                  <button onClick={() => toggleGloss(g.t)}
                    style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px',
                      background:'none', border:'none', cursor:'pointer', textAlign:'left', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <span style={{ fontSize:17 }}>{g.icon}</span>
                      <span style={{ fontSize:13.5, fontWeight:700, color:g.cor }}>{g.t}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <Tag text={g.cat} cor={g.cor}/>
                      <span style={{ fontSize:12, color:P.gray, fontWeight:600 }}>{aberto ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {/* Conteúdo colapsável */}
                  {aberto && (
                    <div style={{ padding:'0 14px 12px' }}>
                      <div style={{ fontSize:12, color:P.text, lineHeight:1.7, marginBottom:8 }}>{g.def}</div>
                      <div style={{ padding:'6px 10px', background:P.surface, borderRadius:7,
                        fontSize:10.5, color:P.navy, fontFamily:'monospace', marginBottom:6 }}>
                        <strong>Fórmula:</strong> {g.formula}
                      </div>
                      <div style={{ padding:'6px 10px', background:`${g.cor}08`, border:`1px solid ${g.cor}20`,
                        borderRadius:7, fontSize:10.5, color:P.text, lineHeight:1.5 }}>
                        <strong style={{ color:g.cor }}>Exemplo:</strong> {g.ex}
                      </div>
                    </div>
                  )}
                </Box>
              )
            })}
            {glossFilt.length===0 && (
              <div style={{ textAlign:'center', padding:30, color:P.gray, fontSize:12 }}>
                Nenhum termo encontrado para "{busca}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA: DIRETRIZES ─────────────────────────────────────────── */}
      {aba === 'diretrizes' && (
        <div>
          <Box style={{ marginBottom:14, background:P.navyL, border:`1px solid ${P.navy}20` }}>
            <div style={{ fontSize:12, color:P.navy, lineHeight:1.7 }}>
              Princípios operacionais definidos pelo grupo AXIS. Regras práticas destiladas
              de experiência real em leilões de BH — seguir reduz risco de erros custosos.
            </div>
          </Box>

          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
            {DIR.map(d => (
              <Box key={d.n} style={{ borderLeft:`3px solid ${P.navy}` }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:P.navy,
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, flexShrink:0 }}>{d.e}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:P.navy, marginBottom:4 }}>
                      {d.n}. {d.t}
                    </div>
                    <div style={{ fontSize:11.5, color:P.text, lineHeight:1.65 }}>{d.txt}</div>
                  </div>
                </div>
              </Box>
            ))}
          </div>

          <Box style={{ background:`${P.mustard}0A`, border:`1px solid ${P.mustard}30` }}>
            <div style={{ fontSize:12, fontWeight:700, color:P.mustard, marginBottom:6 }}>
              ⚠️ Aviso importante
            </div>
            <div style={{ fontSize:11.5, color:P.text, lineHeight:1.7 }}>
              O AXIS é uma ferramenta de <strong>apoio à decisão</strong> — não a substitui.
              Nenhuma análise substitui due diligence presencial, consulta jurídica com Pedro
              e verificação da matrícula no cartório. Investimentos em leilão envolvem riscos reais.
            </div>
          </Box>
        </div>
      )}

      {/* ─── ABA: FAQ ────────────────────────────────────────────────── */}
      {aba === 'faq' && (
        <div>
          <Box style={{ marginBottom:14, background:P.emeraldL, border:`1px solid ${P.emerald}20` }}>
            <div style={{ fontSize:12, color:P.navy, lineHeight:1.7 }}>
              Perguntas frequentes sobre o AXIS, interpretação de dados e boas práticas.
            </div>
          </Box>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {FAQ.map((item, i) => {
              const open = faqAberto === i
              return (
                <div key={i} style={{
                  borderRadius:10, overflow:'hidden',
                  border:`1px solid ${open ? `${P.emerald}40` : P.border}`,
                  background: open ? `${P.emerald}06` : P.white,
                  transition:'all .2s',
                }}>
                  <div onClick={() => setFaqAberto(open ? null : i)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'12px 14px', cursor:'pointer', gap:10 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:P.navy, lineHeight:1.5 }}>{item.q}</div>
                    <span style={{ fontSize:16, color:P.emerald, flexShrink:0,
                      transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s' }}>▾</span>
                  </div>
                  {open && (
                    <div style={{ padding:'0 14px 14px', fontSize:12, color:P.text,
                      lineHeight:1.75, borderTop:`1px solid ${P.border}`, paddingTop:12 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
