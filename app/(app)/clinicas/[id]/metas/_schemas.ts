import { z } from "zod";

export const metaSchema = z.object({
  tipo_meta_id: z.string().min(1, "Selecione o tipo"),
  valor_meta_mensal: z.string().min(1, "Obrigatório"),
});

export const editarMetaSchema = z.object({
  valor_meta_mensal: z.string().min(1, "Obrigatório"),
});

export const atualizarRealizadosSchema = z.object({
  data_referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  updates: z.array(
    z.object({
      id: z.string(),
      valor_realizado: z.string(),
    })
  ),
});

export type MetaFormValues = z.infer<typeof metaSchema>;
export type EditarMetaFormValues = z.infer<typeof editarMetaSchema>;
export type AtualizarRealizadosValues = z.infer<typeof atualizarRealizadosSchema>;
