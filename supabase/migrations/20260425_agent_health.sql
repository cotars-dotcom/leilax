-- Sprint 41d: tabela de health check da cascata de IA
-- Cada linha = 1 ping de 1 provedor em 1 momento.
-- Frontend dispara health check a cada 5min (cooldown via timestamp) e lê o estado atual.

CREATE TABLE IF NOT EXISTS agent_health (
  id              BIGSERIAL PRIMARY KEY,
  provedor        TEXT NOT NULL CHECK (provedor IN ('gemini','deepseek','gpt','claude')),
  ok              BOOLEAN NOT NULL,
  latencia_ms     INTEGER NOT NULL DEFAULT 0,
  erro            TEXT,            -- 'sem_chave', 'timeout_8s', 'HTTP_429', etc
  modelo          TEXT,            -- 'gemini-2.5-flash', 'deepseek-chat', etc
  testado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detalhe         TEXT             -- mensagem de erro completa (opcional, truncada em 200ch no frontend)
);

-- Índices para consultas típicas: status mais recente por provedor
CREATE INDEX IF NOT EXISTS idx_agent_health_testado ON agent_health (testado_em DESC);
CREATE INDEX IF NOT EXISTS idx_agent_health_provedor ON agent_health (provedor, testado_em DESC);

-- Limpeza automática: deletar registros com mais de 7 dias.
-- (rodar via pg_cron ou job manual; sem cron, basta truncate periódico)
COMMENT ON TABLE agent_health IS
  'Health check da cascata de IA. Frontend grava a cada 5min (cooldown). Limpar > 7d periodicamente.';

-- RLS: somente usuários autenticados podem ler/escrever (sem distinção entre user — tabela coletiva)
ALTER TABLE agent_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_can_read" ON agent_health;
CREATE POLICY "auth_users_can_read" ON agent_health
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_users_can_insert" ON agent_health;
CREATE POLICY "auth_users_can_insert" ON agent_health
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- View útil: status mais recente de cada provedor
CREATE OR REPLACE VIEW vw_agent_health_atual AS
SELECT DISTINCT ON (provedor)
  provedor,
  ok,
  latencia_ms,
  erro,
  modelo,
  testado_em,
  EXTRACT(EPOCH FROM (NOW() - testado_em))::INTEGER AS segundos_atras
FROM agent_health
ORDER BY provedor, testado_em DESC;
