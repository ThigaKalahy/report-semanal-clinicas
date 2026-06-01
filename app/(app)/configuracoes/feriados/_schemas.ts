import { z } from "zod";

export const feriadoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: AAAA-MM-DD"),
  descricao: z.string().min(2, "Mínimo 2 caracteres"),
  uf: z.string().max(2).toUpperCase().optional(),
});

export type FeriadoFormValues = z.infer<typeof feriadoSchema>;
