import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Fontes embarcadas nas imagens geradas (Satori só aceita ttf/otf/woff). */
export async function loadFonts() {
  const fontDir = join(process.cwd(), "public", "fonts");
  const names = [
    "Inter_28pt-Regular.ttf",
    "Inter_28pt-SemiBold.ttf",
    "Inter_28pt-ExtraBold.ttf",
  ];
  const buffers = await Promise.all(
    names.map(async (name) => {
      const path = join(fontDir, name);
      try {
        return await readFile(path);
      } catch {
        throw new Error(`Fonte nao encontrada: ${path}`);
      }
    })
  );
  return [
    { name: "Inter", data: buffers[0], weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: buffers[1], weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: buffers[2], weight: 800 as const, style: "normal" as const },
  ];
}

/** Logo Gestfy como data URI — o Satori não busca imagem por URL relativa. */
export async function loadLogoSrc(): Promise<string | null> {
  try {
    const data = await readFile(join(process.cwd(), "public", "gestfy-logo.png"));
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}
