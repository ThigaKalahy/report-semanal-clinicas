import { z } from "zod";

export const FORMATOS = [
  { value: "moeda_brl", label: "Moeda (R$)" },
  { value: "numero_inteiro", label: "Número inteiro" },
  { value: "numero_decimal", label: "Número decimal" },
  { value: "percentual", label: "Percentual (%)" },
] as const;

export const COMPORTAMENTOS = [
  { value: "acumulativa", label: "Acumulativa" },
  { value: "media", label: "Média" },
] as const;

export const tipoMetaSchema = z.object({
  nome: z.string().min(2, "Mínimo 2 caracteres"),
  unidade: z.string().min(1, "Obrigatório"),
  formato: z.enum(["moeda_brl", "numero_inteiro", "numero_decimal", "percentual"]),
  comportamento: z.enum(["acumulativa", "media"]),
  ordem_exibicao: z.string().min(1, "Obrigatório"),
});

export type TipoMetaFormValues = z.infer<typeof tipoMetaSchema>;
