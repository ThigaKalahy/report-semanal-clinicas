# Como Cadastrar uma Clínica no Gestfy Sync

Este guia é para quem vai configurar uma nova clínica na ferramenta. Não é preciso ser técnico — siga os passos na ordem.

---

## 1. Cadastrar a clínica

1. Acesse o sistema e clique em **Clínicas** no menu lateral.
2. Clique em **Nova Clínica**.
3. Preencha:
   - **Nome**: nome completo da clínica (ex: `Clínica Vida Nova`)
   - **Slug**: identificador sem espaços ou acentos (ex: `clinica-vida-nova`) — gerado automaticamente
   - **Tag curta**: abreviação de até 6 letras para aparecer nos relatórios (ex: `VIDNOV`)
   - **Google Place ID**: ID da clínica no Google Maps (veja seção 4 abaixo)
   - **Ativa**: deixe marcado

---

## 2. Configurar as planilhas (fontes de dados)

Depois de criar a clínica, clique nela e vá em **Fontes de Dados**. Você vai configurar até 2 planilhas: **Pré-Consulta** e **NPS**.

### O que é o `sheet_id`?

É o código da planilha do Google Sheets. Está na URL da planilha:

```
https://docs.google.com/spreadsheets/d/AQUI_FICA_O_SHEET_ID/edit
```

Copie apenas a parte entre `/d/` e `/edit`.

### Compartilhar a planilha com o sistema

O sistema lê as planilhas usando uma conta do Google (Service Account). Você precisa compartilhar cada planilha com ela:

1. Abra a planilha no Google Sheets.
2. Clique em **Compartilhar** (botão azul no canto superior direito).
3. Cole o e-mail da service account (peça ao técnico responsável — é algo como `gestfy@projeto.iam.gserviceaccount.com`).
4. Defina a permissão como **Leitor** e clique em Enviar.

### Configurar Pré-Consulta

| Campo | O que colocar |
|---|---|
| **Tipo** | Pré-Consulta |
| **Sheet ID** | ID da planilha (veja acima) |
| **Nome da aba** | Nome exato da aba com os dados (ex: `Respostas`) |
| **Coluna de data** | Letra da coluna que tem a data do atendimento (ex: `A`) |
| **Mapeamento — motivo** | Letra da coluna que tem o motivo da consulta (ex: `C`) |
| **Mapeamento — origem** | Letra da coluna que tem a origem do paciente (ex: `D`) |

> As colunas devem estar no formato `DD/MM/AAAA` (ex: `15/01/2026`).

### Configurar NPS

| Campo | O que colocar |
|---|---|
| **Tipo** | NPS |
| **Sheet ID** | ID da planilha NPS |
| **Nome da aba** | Nome da aba (ex: `Respostas NPS`) |
| **Coluna de data** | Letra da coluna com a data |
| **Mapeamento — nota_geral** | Coluna da nota geral (0–10) |
| **Mapeamento — nota_profissional** | Coluna da nota do profissional (opcional) |
| **Mapeamento — nota_recepcao** | Coluna da nota da recepção (opcional) |
| **Mapeamento — nota_infraestrutura** | Coluna da nota da infraestrutura (opcional) |
| **Mapeamento — nota_enfermagem** | Coluna da nota da enfermagem (opcional) |
| **Mapeamento — comentario** | Coluna do comentário livre (opcional) |
| **Mapeamento — nome_paciente** | Coluna com o nome do paciente (opcional) |

> As notas devem ser números de 0 a 10. Aceita vírgula ou ponto decimal.

---

## 3. Configurar as metas mensais

1. Clique na clínica e acesse **Metas**.
2. Selecione o mês e ano.
3. Para cada tipo de meta cadastrado, preencha:
   - **Meta mensal**: o valor total que a clínica quer atingir no mês
   - **Realizado**: o valor acumulado até hoje
   - **Realizado na semana**: o valor somente da semana atual

> Os **tipos de meta** (ex: Faturamento, NPS, Google Reviews) são configurados em **Configurações → Tipos de Meta**.

---

## 4. Obter o Google Place ID

O Place ID identifica a clínica no Google Maps e é usado para buscar avaliações automaticamente.

**Como encontrar:**

1. Acesse [Google Maps](https://maps.google.com).
2. Pesquise o nome da clínica.
3. Clique no resultado correto.
4. Na URL do navegador, procure o trecho `place/ChIJ...` ou copie da URL:
   ```
   https://www.google.com/maps/place/.../@.../.../data=...!1s ChIJxxxxxxxxxxxxxxx
   ```
5. O Place ID começa com `ChIJ` e tem cerca de 27 caracteres.

**Alternativa:** use a [ferramenta oficial do Google](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder) — busque a clínica e o Place ID aparece abaixo do nome.

Cole o Place ID no campo **Google Place ID** no cadastro da clínica.

---

## 5. Testar a configuração

Após configurar:

1. Acesse **Gerar Relatório**.
2. Selecione a clínica.
3. Escolha o período **Semana passada** e o formato **WhatsApp — Pesquisas**.
4. Clique em **Gerar**.

Se aparecer algum aviso em amarelo, siga a instrução do aviso (geralmente é um problema de acesso à planilha ou de coluna não encontrada).

---

## Perguntas frequentes

**A planilha tem cabeçalho na primeira linha?**
Sim, o sistema sempre pula a primeira linha. A linha 1 deve ter os nomes das colunas; os dados começam na linha 2.

**As datas precisam estar em algum formato específico?**
Sim: `DD/MM/AAAA` (com barras). Formatos americanos ou com hora funcionam parcialmente mas podem causar erros.

**Posso usar a mesma planilha para várias clínicas?**
Sim, desde que cada clínica tenha sua própria aba. Configure o mesmo `sheet_id` e abas diferentes.

**O que fazer se o Google não retornar avaliações?**
A API do Google só retorna as ~5 avaliações mais recentes. Se não houver avaliações no período, use o campo **Avaliações Google manuais** na tela de geração do relatório.
