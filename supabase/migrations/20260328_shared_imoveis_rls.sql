-- Sprint 9: Modo compartilhado — todos os authenticated leem todos os imóveis
-- Executar no Supabase Studio → SQL Editor

-- 1. Permitir SELECT para qualquer usuário autenticado (grupo compartilhado)
DROP POLICY IF EXISTS "imoveis_select_policy" ON imoveis;
DROP POLICY IF EXISTS "Authenticated users can read all imoveis" ON imoveis;
CREATE POLICY "imoveis_todos_autenticados" ON imoveis
  FOR SELECT TO authenticated
  USING (true);

-- 2. Manter INSERT/UPDATE restritos ao criador ou admin
DROP POLICY IF EXISTS "imoveis_insert_policy" ON imoveis;
CREATE POLICY "imoveis_insert_autenticado" ON imoveis
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "imoveis_update_policy" ON imoveis;
CREATE POLICY "imoveis_update_criador_ou_admin" ON imoveis
  FOR UPDATE TO authenticated
  USING (
    criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. DELETE restrito ao admin
DROP POLICY IF EXISTS "imoveis_delete_policy" ON imoveis;
CREATE POLICY "imoveis_delete_admin" ON imoveis
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
