import { z } from "zod";

// Accepts empty string (optional) or uppercase letters only
const optionalCol = z
  .string()
  .refine((v) => v === "" || /^[A-Z]+$/.test(v), "Apenas letras maiúsculas (ex: A, B, AB)");

const requiredCol = z
  .string()
  .min(1, "Obrigatório")
  .regex(/^[A-Z]+$/, "Apenas letras maiúsculas (ex: A, B, AB)");

const base = z.object({
  sheet_id:    z.string().min(1, "Obrigatório"),
  aba_nome:    z.string().min(1, "Obrigatório"),
  coluna_data: requiredCol,
});

// Base para fontes financeiras: sem aba_nome fixa; usa mapa por mês + resumo opcional
const baseFinancial = z.object({
  sheet_id:    z.string().min(1, "Obrigatório"),
  aba_resumo:  z.string(), // nome da aba de resumo anual (opcional; armazenado em aba_nome no DB)
  abas_mensais: z.record(z.string(), z.string()), // "AAAA-MM" → nome exato da aba
  coluna_data: requiredCol,
});

export const preConsultaSchema = base.extend({
  motivo: optionalCol,
  origem: optionalCol,
});

export const npsSchema = base.extend({
  nota_geral:          requiredCol,
  nota_profissional:   optionalCol,
  nota_recepcao:       optionalCol,
  nota_infraestrutura: optionalCol,
  nota_enfermagem:     optionalCol,
  comentario:          optionalCol,
  nome_paciente:       optionalCol,
  anonimato:           optionalCol,
  indicacao:           optionalCol,
});

export const leadsSchema = base.extend({
  convertido:      optionalCol,
  valor_conversao: z.string().min(1, "Obrigatório").max(50),
  // Row (1-indexed) where data starts. Use 3 when there is a title row before the header.
  linha_inicial:   z.number().int().min(1),
});

export const faturamentoSchema = baseFinancial.extend({
  categoria:     requiredCol,
  valor_pago:    requiredCol,
  profissional:  optionalCol,
  linha_inicial: z.number().int().min(1),
});

export const despesaSchema = baseFinancial.extend({
  categoria:     requiredCol,
  valor_pago:    requiredCol,
  linha_inicial: z.number().int().min(1),
});

export type PreConsultaFormValues = z.infer<typeof preConsultaSchema>;
export type NpsFormValues         = z.infer<typeof npsSchema>;
export type LeadsFormValues       = z.infer<typeof leadsSchema>;
// abas_mensais é gerenciado como estado local no form; omitido do tipo react-hook-form
export type FaturamentoFormValues = Omit<z.infer<typeof faturamentoSchema>, "abas_mensais">;
export type DespesaFormValues     = Omit<z.infer<typeof despesaSchema>,     "abas_mensais">;
