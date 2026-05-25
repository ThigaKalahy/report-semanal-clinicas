# Relatório Semanal — Clínicas

Aplicação web interna para geração de relatórios semanais de múltiplas clínicas de saúde, formatados para envio via WhatsApp.

## O que faz

Consolida dados de 4 fontes e gera um relatório formatado por clínica:

| Fonte | Dados |
|---|---|
| Google Sheets (pesquisa pré-consulta) | Satisfação antes da consulta |
| Google Sheets (pesquisa NPS) | Net Promoter Score pós-consulta |
| Google Places API | Avaliações e nota no Google Maps |
| Supabase (banco) | Metas semanais por clínica |

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (estilo new-york, cor neutral)
- **Banco de dados:** Supabase (PostgreSQL)
- **Integrações:** Google Sheets API v4, Google Places API
- **Validação:** Zod + React Hook Form
- **Deploy:** Vercel

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- npm 10+
- Conta no Supabase
- Projeto no Google Cloud com Sheets API e Places API habilitadas

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd report-semanal-clinicas
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha cada variável no `.env.local` conforme as instruções do `.env.example`.

### 3. Configure o Supabase

> As migrations serão documentadas na próxima etapa do projeto.

### 4. Rode o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura de pastas

```
app/
  (auth)/login/        → Página de login
  (app)/
    dashboard/         → Visão geral
    clinicas/          → Gerenciamento de clínicas
    relatorio/         → Geração de relatórios
  layout.tsx           → Layout raiz (Toaster global)
components/
  ui/                  → Componentes shadcn/ui
lib/
  supabase/
    client.ts          → Cliente Supabase (browser)
    server.ts          → Cliente Supabase (server-side / SSR)
  types.ts             → Tipos TypeScript compartilhados
middleware.ts          → Proteção de rotas (auth)
```

## Deploy na Vercel

1. Conecte o repositório na Vercel
2. Adicione todas as variáveis de `.env.example` nas configurações do projeto
3. O deploy é automático a cada push na branch `main`
