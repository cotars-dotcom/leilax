-- Sprint 41d-Bx: estado do circuit breaker da cascata de IA
-- 1 linha por provedor. Sincroniza estado entre múltiplas tabs/instâncias.
-- Quando uma tab descobre que Gemini está fora, outras tabs evitam queimar
-- tempo testando o mesmo provedor.

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  provedor          TEXT PRIMARY KEY CHECK (provedor IN ('gemini','deepseek','gpt','claude')),
  falhas            INTEGER NOT NULL DEFAULT 0,
  aberto_ate        TIMESTAMPTZ,           -- se preenchido E > NOW(), circuit está OPEN
  ultima_tentativa  TIMESTAMPTZ,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: garantir que os 4 provedores existem como linhas
INSERT INTO circuit_breaker_state (provedor) VALUES
  ('gemini'), ('deepseek'), ('gpt'), ('claude')
ON CONFLICT (provedor) DO NOTHING;

ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_can_read_circuit" ON circuit_breaker_state;
CREATE POLICY "auth_can_read_circuit" ON circuit_breaker_state
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_can_upsert_circuit" ON circuit_breaker_state;
CREATE POLICY "auth_can_upsert_circuit" ON circuit_breaker_state
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
