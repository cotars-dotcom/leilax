import { useState } from 'react'
import { C, K, card, btn } from '../appConstants.js'

const DADOS_BANCO = [
  { nome:'mercado_regional', registros:16, atualizado:'29/03/2026', fonte:'FipeZAP fev/2026 + QuintoAndar 3T2025 + Secovi-MG', descricao:'Preço médio m², yield bruto, tendência, demanda e tempo de venda por região. Cobre BH (11 zonas), Nova Lima, Contagem e Juiz de Fora (4 zonas).', campos:['preco_m2_medio','variacao_12m','demanda','tendencia','yield_bruto_pct'] },
  { nome:'metricas_bairros', registros:29, atualizado:'29/03/2026', fonte:'FipeZAP fev/2026 + QuintoAndar 3T2025 + IPEAD/UFMG', descricao:'29 bairros de BH com preço de anúncio e contrato separados, yield bruto, tendência 12m e classificação IPEAD 1-4 (Popular→Luxo).', campos:['bairro','preco_anuncio_m2','preco_contrato_m2','yield_bruto','classe_ipead'] },
  { nome:'parametros_score', registros:6, atualizado:'Fixo — definido pelo grupo', fonte:'Calibrado pelo grupo AXIS', descricao:'Pesos das 6 dimensões do score AXIS. Localização (20%), Desconto (18%), Jurídico (18%), Ocupação (15%), Liquidez (15%), Mercado (14%). Soma = 100%.', campos:['peso_localizacao','peso_desconto','peso_juridico','peso_ocupacao','peso_liquidez','peso_mercado'] },
  { nome:'riscos_juridicos', registros:15, atualizado:'29/03/2026', fonte:'TJMG 2025 + TRT-MG + Lei 9.514/97 + CPC/2015', descricao:'15 tipos de risco com custo processual real (TJMG), prazo prático meses, nota de risco 1-10 e penalização de score.', campos:['risco_id','custo_min','custo_max','prazo_meses','risco_nota','score_penalizacao'] },
  { nome:'parametros_reforma', registros:4, atualizado:'29/03/2026', fonte:'SINAPI-MG dez/2025', descricao:'4 classes de mercado (A_prime, B_medio_alto, C_intermediario, D_popular) com faixa de preço/m² e teto de reforma em % do imóvel.', campos:['classe','faixa_venda_m2_min','faixa_venda_m2_max','teto_pct_imovel'] },
  { nome:'jurimetria_varas', registros:6, atualizado:'29/03/2026', fonte:'CNJ DataJud + ABRAIM 2024', descricao:'Tempo real de ciclo por vara — TRT-3 (240 dias), TJMG Cível (180 dias). Usado para calcular prazo de liberação estimado.', campos:['vara_nome','tempo_total_ciclo_dias','taxa_embargo_pct','taxa_sucesso_posse_pct'] },
  { nome:'modelos_analise', registros:5, atualizado:'29/03/2026', fonte:'AXIS interno', descricao:'Regras arquivadas do agente interno: regras_leilao_trt_mg, regras_mercado_bh, prompt_agente_leilao_v1, motor_gemini_analise_v1, agente_reanalise_v1.', campos:['nome','categoria','versao','conteudo'] },
  { nome:'analises_leilao', registros:'variável', atualizado:'Auto-gerado', fonte:'Agente AXIS interno', descricao:'Estudo completo de leilão por imóvel: projeção 2º leilão, 4 cenários ROI, redução de custo, probabilidade de venda, MAO e síntese estratégica. Custo: R$ 0,00.', campos:['cenarios','mao_flip','roi_1_pct','estrategia','reducoes_disponiveis'] }
]

const GLOSSARIO = [
  { termo:'ROI', cat:'Financeiro', def:'Return on Investment — Retorno sobre Investimento. Mede o lucro líquido como percentual do capital total investido. ROI = (Lucro Líquido ÷ Custo Total) × 100. No AXIS, inclui todos os custos: lance + comissão leiloeiro + ITBI + documentação + advogado + registro + reforma + jurídico.' },
  { termo:'MAO', cat:'Financeiro', def:'Maximum Allowable Offer — Lance Máximo Aceitável. Valor máximo que você pode pagar sem comprometer a margem mínima de lucro. MAO = (Valor de Mercado × 0,80) − Custos. Pagar acima do MAO significa ROI abaixo de 20%.' },
  { termo:'Flip', cat:'Estratégia', def:'Estratégia de comprar, reformar (se necessário) e vender com lucro no curto prazo (6-24 meses). O AXIS calcula ROI de flip considerando IRPF de 15% sobre ganho de capital e corretagem de 6% na venda.' },
  { termo:'ITBI', cat:'Custo', def:'Imposto sobre Transmissão de Bens Imóveis. Cobrado na transferência de propriedade. Em BH: 3% do valor do lance (ou do valor venal, o maior). Pago uma vez na escrituração.' },
  { termo:'Sobrecapitalização', cat:'Risco', def:'Quando o custo da reforma supera o teto recomendado para aquela classe de imóvel. Classe C: máx 5% do valor. Classe B: máx 6%. Classe A: máx 7%. Acima disso, o mercado não absorve o valor investido na reforma e o ROI cai.' },
  { termo:'Score AXIS', cat:'Análise', def:'Nota de 0 a 10 calculada pelo motor de IA com 6 dimensões ponderadas. ≥8.0 = sinal de compra imediato. ≥7.0 = comprar. 6.0-6.9 = aguardar mais informações. <6.0 = evitar. As dimensões e pesos são configuráveis pelo admin.' },
  { termo:'Score por Dimensão', cat:'Análise', def:'Cada dimensão é uma nota de 0 a 10: Localização (infra, bairro, demanda), Desconto (% sobre avaliação e mercado), Jurídico (processos, matrícula, riscos), Ocupação (desocupado/ocupado/incerto), Liquidez (tempo de venda, demanda bairro), Mercado (tendência, yield, valorização 12m).' },
  { termo:'Sub-rogação de Débitos', cat:'Jurídico', def:'Em leilões judiciais (CPC/2015), os débitos anteriores de IPTU e condomínio se "sub-rogam no preço" — ou seja, são pagos com o dinheiro do lance e não viram obrigação do arrematante. Proteção legal importante em leilões do TJMG e TRT.' },
  { termo:'2º Leilão', cat:'Leilão', def:'Quando o 1º leilão não atinge o lance mínimo (geralmente 100% da avaliação), realiza-se o 2º leilão com lance mínimo de 50% da avaliação judicial. Historicamente no TRT-MG, o 2º leilão fecha entre 57-65% da avaliação.' },
  { termo:'Yield Bruto', cat:'Financeiro', def:'Rendimento anual do aluguel em relação ao valor do imóvel. Yield = (Aluguel mensal × 12) ÷ Valor de mercado × 100. BH média: 5,8%. Acima de 6%: bom para locação. Abaixo de 4,5%: favorece flip.' },
  { termo:'IPEAD', cat:'Mercado', def:'Instituto de Pesquisa Econômica Aplicada e Desenvolvimento — classifica imóveis de BH em 4 faixas: 1-Popular (<R$4.500/m²), 2-Médio (R$4.500-8.000/m²), 3-Alto (R$8.000-12.000/m²), 4-Luxo (>R$12.000/m²).' },
  { termo:'Jurimetria', cat:'Jurídico', def:'Ciência que aplica estatística ao Direito. No AXIS, usamos dados reais de varas para estimar o prazo de liberação de um imóvel ocupado. Ex: TRT-MG tem ciclo médio de 240 dias para reintegração de posse.' },
  { termo:'Agente AXIS Interno', cat:'IA', def:'Motor de análise sem chamadas de API externas: usa regras arquivadas no banco (modelos_analise) para calcular cenários de ROI, projeção de 2º leilão e redução de custos. Custo: R$ 0,00 por análise.' },
  { termo:'Gemini Flash-Lite', cat:'IA', def:'Modelo de linguagem da Google usado para análises com custo ~R$ 0,01/análise (vs R$ 3,00 do Claude Sonnet). Acessa a URL do imóvel via Jina.ai (gratuito), extrai campos com regex e usa Gemini para scores + síntese.' },
  { termo:'FipeZAP', cat:'Fonte', def:'Índice de preços imobiliários calculado pela Fipe com dados do ZAP Imóveis. Base de dados de preço/m² de anúncio por bairro/cidade. No AXIS: atualizado mensalmente para BH.' },
]

const FLUXO_ANALISE = [
  { etapa:'1', titulo:'URL do Edital', desc:'Cole o link do edital (Marco Antônio, Superbid, Caixa, etc.)', custo:'R$ 0,00' },
  { etapa:'2', titulo:'Scrape (Jina.ai)', desc:'Jina.ai lê o edital gratuitamente e extrai o texto', custo:'R$ 0,00' },
  { etapa:'3', titulo:'Extração Regex', desc:'25 campos extraídos automaticamente: preço, área, quartos, modalidade...', custo:'R$ 0,00' },
  { etapa:'4', titulo:'Mercado do Banco', desc:'Busca preço/m², yield e tendência do bairro nas tabelas internas', custo:'R$ 0,00' },
  { etapa:'5', titulo:'Gemini Flash-Lite', desc:'IA analisa scores, comparáveis, riscos, síntese e estratégia', custo:'~R$ 0,01' },
  { etapa:'6', titulo:'Score AXIS', desc:'Calcula nota 0-10 com os 6 pesos configurados pelo grupo', custo:'R$ 0,00' },
  { etapa:'7', titulo:'Agente Leilão', desc:'Projeta 2º leilão, MAO, ROI de 4 cenários e redução de custo', custo:'R$ 0,00' },
  { etapa:'8', titulo:'Salvar no Banco', desc:'Todos os dados ficam no Supabase — sincronizados entre dispositivos', custo:'R$ 0,00' },
]

const DIRETRIZES = [
  { titulo:'Imóvel de qualidade', texto:'Foco em apartamentos 2-4 quartos com 1+ suíte e 2+ vagas em bairros consolidados de BH. Evitar terrenos e imóveis comerciais sem análise específica.' },
  { titulo:'Score mínimo para ação', texto:'Score ≥ 7.0: avaliar compra. Score ≥ 8.0: sinal de compra imediata. Score < 6.0: evitar, salvo situação excepcional documentada pelo grupo.' },
  { titulo:'Margem de segurança (MAO)', texto:'Nunca pagar acima do MAO (80% do valor de mercado menos custos). O MAO garante margem mínima de 20% mesmo no cenário mais pessimista.' },
  { titulo:'Reforma dentro do teto', texto:'Reforma máxima: 5% do valor do imóvel para Classe C, 6% para Classe B, 7% para Classe A. Acima disso, risco de sobrecapitalização.' },
  { titulo:'Verificação jurídica obrigatória', texto:'Toda análise passa pela equipe jurídica antes do lance. Documentos da matrícula devem ser anexados na aba Jurídico para reclassificação automática do score.' },
  { titulo:'Estrutura de aquisição', texto:'CPF único para imóveis simples. Consórcio voluntário para múltiplos investidores. Holding/LTDA para operações recorrentes — consultar Pedro.' },
  { titulo:'Presença no leilão', texto:'Verificar ocupação pessoalmente antes de fazer lance. Nunca basear ocupação apenas no edital — informação frequentemente imprecisa.' },
  { titulo:'Custo de oportunidade', texto:'Imóveis com prazo de liberação > 12 meses: considerar custo de oportunidade do capital imobilizado (~12% CDI a.a.) no cálculo do ROI efetivo.' },
]

export default function ManualAxis({ isMobile }) {
  const [aba, setAba] = useState('guia')
  const [busca, setBusca] = useState('')

  const abas = [
    ['guia','📖 Guia AXIS'],
    ['glossario','📚 Glossário'],
    ['banco','🗄️ Banco de Dados'],
    ['fluxo','⚙️ Como Analisa'],
    ['diretrizes','📋 Diretrizes'],
  ]

  const glossFiltrado = GLOSSARIO.filter(g =>
    !busca || g.termo.toLowerCase().includes(busca.toLowerCase()) || g.def.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{padding: isMobile ? 16 : '20px 28px', maxWidth:900}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22, fontWeight:700, color:C.navy, marginBottom:4}}>Manual AXIS</div>
        <div style={{fontSize:13, color:C.muted}}>Diretrizes, glossário, bases de dados e fluxo de análise</div>
      </div>

      {/* Abas */}
      <div style={{display:'flex', gap:4, marginBottom:20, flexWrap:'wrap'}}>
        {abas.map(([k,l]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            padding:'7px 14px', borderRadius:8, fontSize:12, cursor:'pointer', fontWeight: aba===k ? 600 : 400,
            border:`1px solid ${aba===k ? C.navy : C.borderW}`,
            background: aba===k ? C.navy : C.white, color: aba===k ? '#fff' : C.muted
          }}>{l}</button>
        ))}
      </div>

      {/* ABA: GUIA */}
      {aba === 'guia' && (
        <div>
          <div style={{...card(), padding:20, marginBottom:16}}>
            <div style={{fontSize:15, fontWeight:600, color:C.navy, marginBottom:8}}>O que é o AXIS?</div>
            <div style={{fontSize:13, color:C.text, lineHeight:1.7}}>
              AXIS Inteligência Patrimonial é uma plataforma SaaS para análise de imóveis em leilão judicial no Brasil. 
              Combina um motor de IA dual (Claude Sonnet + Gemini) com bases de dados proprietárias de mercado BH/JF 
              para gerar análises completas: score multidimensional, ROI, MAO, jurimetria e estudo de leilão — 
              em menos de 60 segundos por imóvel.
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12, marginBottom:16}}>
            {[
              ['🏆','Diferencial único','Único sistema que combina: Score 6D + IA dual + SINAPI reforma + MAO automático + jurimetria real de varas'],
              ['💰','Custo por análise','~R$ 0,01 com Gemini Flash-Lite. Fallback para Claude Sonnet (~R$ 3,00) apenas se necessário'],
              ['🔒','Segurança','Dados no Supabase com RLS. Chaves de API sincronizadas entre dispositivos via banco criptografado'],
              ['👥','Multi-usuário','Admin cria convites com link. Membros veem todos os imóveis. Cada usuário tem acesso conforme seu papel (admin/membro/viewer)'],
            ].map(([icon, titulo, texto]) => (
              <div key={titulo} style={{...card(), padding:14}}>
                <div style={{fontSize:16, marginBottom:4}}>{icon}</div>
                <div style={{fontSize:12, fontWeight:600, color:C.navy, marginBottom:4}}>{titulo}</div>
                <div style={{fontSize:11, color:C.muted, lineHeight:1.5}}>{texto}</div>
              </div>
            ))}
          </div>

          <div style={{...card(), padding:16}}>
            <div style={{fontSize:13, fontWeight:600, color:C.navy, marginBottom:10}}>Score AXIS — 6 dimensões</div>
            {[
              ['Localização','20%','Infraestrutura do bairro, acessibilidade, qualidade de vida, potencial de valorização'],
              ['Desconto','18%','% de desconto sobre avaliação judicial e sobre valor de mercado estimado'],
              ['Jurídico','18%','Processos ativos, status da matrícula, riscos identificados, modalidade do leilão'],
              ['Ocupação','15%','Situação de ocupação — desocupado (melhor), incerto, ocupado (pior)'],
              ['Liquidez','15%','Tempo médio de venda no bairro, demanda e facilidade de revenda'],
              ['Mercado','14%','Tendência de preços 12m, yield bruto, valorização histórica da região'],
            ].map(([dim, peso, desc]) => (
              <div key={dim} style={{display:'flex', gap:10, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid ${C.borderW}`}}>
                <div style={{minWidth:90, fontSize:12, fontWeight:600, color:C.navy}}>{dim}</div>
                <div style={{minWidth:36, fontSize:12, fontWeight:700, color:C.emerald}}>{peso}</div>
                <div style={{fontSize:11, color:C.muted, lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
            <div style={{marginTop:8, fontSize:11, color:C.hint}}>
              Thresholds: ≥8.0 compra imediata · ≥7.0 comprar · 6.0-6.9 aguardar · &lt;6.0 evitar
            </div>
          </div>
        </div>
      )}

      {/* ABA: GLOSSÁRIO */}
      {aba === 'glossario' && (
        <div>
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar termo..."
            style={{width:'100%', padding:'8px 12px', borderRadius:8, border:`1px solid ${C.borderW}`,
              fontSize:13, marginBottom:12, background:C.white, color:C.text}}
          />
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {glossFiltrado.map(g => (
              <div key={g.termo} style={{...card(), padding:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                  <span style={{fontSize:14, fontWeight:600, color:C.navy}}>{g.termo}</span>
                  <span style={{fontSize:10, padding:'2px 8px', borderRadius:10, background:C.surface, color:C.muted}}>{g.cat}</span>
                </div>
                <div style={{fontSize:12, color:C.text, lineHeight:1.6}}>{g.def}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA: BANCO DE DADOS */}
      {aba === 'banco' && (
        <div>
          <div style={{fontSize:13, color:C.muted, marginBottom:12}}>
            Todas as tabelas usadas pelo AXIS. Dados sincronizados no Supabase — acessíveis em qualquer dispositivo.
          </div>
          {DADOS_BANCO.map(d => (
            <div key={d.nome} style={{...card(), padding:14, marginBottom:10}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:6}}>
                <div>
                  <span style={{fontSize:12, fontWeight:700, color:C.navy, fontFamily:'monospace'}}>{d.nome}</span>
                  <span style={{marginLeft:8, fontSize:11, color:C.muted}}>{d.registros} registros</span>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <span style={{fontSize:10, color:C.hint}}>Atualizado: {d.atualizado}</span>
                </div>
              </div>
              <div style={{fontSize:11, color:C.text, marginBottom:6, lineHeight:1.5}}>{d.descricao}</div>
              <div style={{fontSize:10, color:C.hint}}>
                Fonte: {d.fonte}
              </div>
              <div style={{display:'flex', gap:6, marginTop:6, flexWrap:'wrap'}}>
                {d.campos.map(c => (
                  <span key={c} style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:C.surface, color:C.muted, fontFamily:'monospace'}}>{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA: FLUXO */}
      {aba === 'fluxo' && (
        <div>
          <div style={{fontSize:13, color:C.muted, marginBottom:16}}>
            Como o AXIS analisa um imóvel — do link ao relatório completo.
          </div>
          <div style={{position:'relative'}}>
            {FLUXO_ANALISE.map((f, i) => (
              <div key={f.etapa} style={{display:'flex', gap:12, marginBottom:16}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                  <div style={{width:32, height:32, borderRadius:'50%', background:C.navy, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0}}>
                    {f.etapa}
                  </div>
                  {i < FLUXO_ANALISE.length - 1 && (
                    <div style={{width:2, flex:1, background:C.borderW, margin:'4px 0'}}/>
                  )}
                </div>
                <div style={{...card(), padding:'10px 14px', flex:1, marginBottom:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                    <span style={{fontSize:12, fontWeight:600, color:C.navy}}>{f.titulo}</span>
                    <span style={{fontSize:11, fontWeight:700, color: f.custo === 'R$ 0,00' ? C.emerald : C.mustard}}>{f.custo}</span>
                  </div>
                  <div style={{fontSize:11, color:C.muted}}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{...card(), padding:14, background:`${C.emerald}08`, border:`1px solid ${C.emerald}20`}}>
            <div style={{fontSize:12, fontWeight:600, color:C.emerald, marginBottom:4}}>Custo total por análise</div>
            <div style={{fontSize:13, color:C.text}}>
              ~<strong>R$ 0,01</strong> com Gemini Flash-Lite &nbsp;·&nbsp;
              <span style={{color:C.muted}}>vs R$ 3,00 com Claude Sonnet (99,7% de redução)</span>
            </div>
          </div>
        </div>
      )}

      {/* ABA: DIRETRIZES */}
      {aba === 'diretrizes' && (
        <div>
          <div style={{fontSize:13, color:C.muted, marginBottom:16}}>
            Princípios operacionais definidos pelo grupo AXIS para análise e decisão de investimento.
          </div>
          {DIRETRIZES.map((d, i) => (
            <div key={i} style={{...card(), padding:14, marginBottom:10, borderLeft:`3px solid ${C.navy}`}}>
              <div style={{fontSize:12, fontWeight:600, color:C.navy, marginBottom:6}}>{i+1}. {d.titulo}</div>
              <div style={{fontSize:12, color:C.text, lineHeight:1.6}}>{d.texto}</div>
            </div>
          ))}
          <div style={{...card(), padding:14, marginTop:8, background:`${C.mustard}08`, border:`1px solid ${C.mustard}20`}}>
            <div style={{fontSize:12, fontWeight:600, color:C.mustard, marginBottom:4}}>⚠️ Aviso importante</div>
            <div style={{fontSize:11, color:C.text, lineHeight:1.6}}>
              O AXIS é uma ferramenta de apoio à decisão. Nenhuma análise substitui a due diligence presencial, 
              a consulta jurídica com Pedro e a verificação da matrícula atualizada no cartório. 
              Investimentos em leilões envolvem riscos reais — use o AXIS para filtrar e priorizar, 
              não como única fonte de decisão.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
