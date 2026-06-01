# Identidade Visual — Gestfy Sync

## Paleta de cores

### Interface geral (shadcn / Tailwind)

Definidas via variáveis CSS em `app/globals.css`. Seguem o tema shadcn **new-york / neutral**.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#09090B` | Fundo das páginas |
| `--foreground` | `#09090B` | `#FAFAFA` | Texto principal |
| `--muted` | `#F4F4F5` | `#27272A` | Fundos sutis, skeletons |
| `--muted-foreground` | `#71717A` | `#A1A1AA` | Textos secundários |
| `--border` | `#E4E4E7` | `#27272A` | Bordas de cards e inputs |
| `--primary` | `#18181B` | `#FAFAFA` | Botões primários |
| `--destructive` | `#EF4444` | `#7F1D1D` | Ações destrutivas |
| `--ring` | `#18181B` | `#D4D4D8` | Outline de foco |

### Sidebar

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--sidebar` | `#FAFAFA` | `#18181B` | Fundo da barra lateral |
| `--sidebar-border` | `#E4E4E7` | `#27272A` | Bordas da sidebar |
| `--sidebar-foreground` | `#18181B` | `#F4F4F5` | Texto da sidebar |
| `--sidebar-accent` | `#F4F4F5` | `#27272A` | Hover nos itens da sidebar |
| `--sidebar-accent-foreground` | `#18181B` | `#FAFAFA` | Texto no hover |

---

## Paleta do infográfico (next/og)

Usada exclusivamente em `lib/relatorio/InfograficoOG.tsx` para a geração de imagens PNG.

| Nome | Hex | Uso |
|---|---|---|
| **Fundo principal** | `#210246` | Background do infográfico (roxo escuro) |
| **Fundo rodapé** | `#1A0138` | Gradiente do rodapé |
| **Card** | `#440570` | Cards de seção (faturamento, NPS, comercial) |
| **Card de alertas** | `#2F0342` | Bloco de alertas com borda vermelha |
| **Laranja Gestfy** | `#F4500F` | Títulos de seção, números grandes, ações numeradas |
| **Lavanda** | `#B9A3D4` | Rótulos internos, textos secundários |
| **Branco** | `#FFFFFF` | Valores, texto principal |
| **Verde (acima da meta)** | `#2E9E5B` | Pills de status positivo |
| **Vermelho (abaixo da meta)** | `#E53935` | Pills de status negativo, borda do bloco de alertas |
| **Âmbar (atenção)** | `#E6A700` | Ícone de destaque "Atenção" |

### Regra de cor dos status pills

```
realizado >= meta_periodo  →  pill verde  (+X%)
realizado <  meta_periodo  →  pill vermelho (-X%)
sem meta configurada       →  sem pill (N/A)
```

---

## Tipografia

### Interface geral

- **Família**: Geist Sans (variável `--font-geist-sans`), carregada via `next/font/google`
- **Monospace**: Geist Mono (variável `--font-geist-mono`)
- **Anti-aliasing**: `antialiased` via Tailwind

### Infográfico (next/og)

- **Família**: Inter (28pt optical size), arquivos em `public/fonts/`
- `Inter_28pt-Regular.ttf` → weight 400 → texto corrido, labels
- `Inter_28pt-SemiBold.ttf` → weight 600 → valores, badges
- `Inter_28pt-ExtraBold.ttf` → weight 800 → títulos de seção, números grandes

---

## Logo Gestfy

Componente: `components/brand/gestfy-logo.tsx`

Variantes:
- `variant="icon"` — só o ícone (símbolo)
- `variant="full"` — ícone + nome "gestfy"

Props:
- `size` — tamanho do ícone em pixels
- `showSubtitle` — mostra "Gestão para Clínicas" abaixo
- `onDark` — adapta cores para fundos escuros (login page)

No infográfico PNG, o texto "gestfy" é renderizado diretamente em Inter ExtraBold, pois o SVG do logo não é carregado no contexto do next/og.

---

## Gradiente da marca

Usado no painel lateral da tela de login:

```css
.bg-gestfy-gradient {
  background: linear-gradient(135deg, #210246 0%, #6B21A8 50%, #F4500F 100%);
}
```

Definido em `tailwind.config.ts` como `backgroundImage.gestfy-gradient`.

---

## Badges e indicadores (infográfico)

No Satori (motor do next/og), emojis coloridos não são suportados. Substituídos por componentes CSS:

| Indicador | Visual | Componente |
|---|---|---|
| Acima da meta | Pill verde `+X%` | `StatusPill` com `background: #2E9E5B` |
| Abaixo da meta | Pill vermelho `-X%` | `StatusPill` com `background: #E53935` |
| Destaque positivo | Quadrado verde `+` | `DestaqueIcone tipo="positivo"` |
| Destaque financeiro | Quadrado laranja `$` | `DestaqueIcone tipo="financeiro"` |
| Destaque atenção | Quadrado âmbar `!` | `DestaqueIcone tipo="atencao"` |
| Alerta | Quadrado vermelho `!` | `AlertaIcone` |
