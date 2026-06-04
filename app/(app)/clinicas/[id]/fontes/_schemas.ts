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
  sheet_id: z.string().min(1, "Obrigatório"),
  aba_nome: z.string().min(1, "Obrigatório"),
  coluna_data: requiredCol,
});

export const preConsultaSchema = base.extend({
  motivo: optionalCol,
  origem: optionalCol,
});

export const npsSchema = base.extend({
  nota_geral: requiredCol,
  nota_profissional: optionalCol,
  nota_recepcao: optionalCol,
  nota_infraestrutura: optionalCol,
  nota_enfermagem: optionalCol,
  comentario: optionalCol,
  nome_paciente: optionalCol,
  anonimato: optionalCol,
  indicacao: optionalCol,
});

export type PreConsultaFormValues = z.infer<typeof preConsultaSchema>;
export type NpsFormValues = z.infer<typeof npsSchema>;
