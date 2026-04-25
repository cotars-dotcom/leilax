-- Sprint 41d-Bx: coluna para marcar quando o OCR retornou JSON com campos
-- ausentes (schema incompleto). Antes deste commit, OCR malformado gravava
-- campos null silenciosamente. Agora, quando há ausência, o array de campos
-- faltantes fica visível para a UI sinalizar.

ALTER TABLE documentos_juridicos
  ADD COLUMN IF NOT EXISTS ocr_ausentes JSONB DEFAULT NULL;

COMMENT ON COLUMN documentos_juridicos.ocr_ausentes IS
  'Quando OCR retorna schema incompleto, lista de campos obrigatórios ausentes (em vez de null silencioso). NULL = OCR completo. Definido em src/lib/constants.js SCHEMA_OCR_DOCUMENTO.';

-- Status novo: 'analisado_parcial' (já vinha como TEXT livre, sem CHECK constraint)
-- Apenas documentar:
COMMENT ON COLUMN documentos_juridicos.status IS
  'Estados: pendente | processando | analisado | analisado_parcial (schema incompleto) | erro';
