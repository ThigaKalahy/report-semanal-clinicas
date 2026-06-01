import { z } from "zod";

export const clinicaSchema = z.object({
  nome: z.string().min(2, "Mínimo 2 caracteres"),
  slug: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  tag_curta: z.string().max(10, "Máximo 10 caracteres"),
  google_place_id: z.string(),
  ativa: z.boolean(),
});

export type ClinicaFormValues = z.infer<typeof clinicaSchema>;
