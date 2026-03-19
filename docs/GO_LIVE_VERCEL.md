# Go-Live Vercel - Influenciando UGC Platform

## 1. Pré-requisitos
- Projeto conectado na Vercel
- Projeto Supabase ativo
- DNS do dominio configurado
- Migrations aplicadas no banco de producao

## 2. Variaveis de ambiente (Vercel)
Configure em `Project Settings > Environment Variables`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`
- `VITE_OPPORTUNITY_CREATED_WEBHOOK_URL` (opcional)
- `VITE_ANALYST_SIGNUP_VALIDATION_ENDPOINT`

## 3. Banco de dados (Supabase)
1. Aplicar migrations em ordem:
   - `supabase/migrations/20260318_phase1_security_hardening.sql`
2. Revisar policies RLS apos aplicacao.
3. Validar que funcoes sensiveis nao possuem grant para `anon`.

## 4. Deploy (Vercel)
1. Branch principal: `main`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Rewrites SPA: ja configurado em `vercel.json`

## 5. Checklist de validacao pos-deploy

### Autenticacao
- Login de creator funciona
- Login de analyst funciona
- Confirmacao de email funciona
- Cadastro de analyst depende de validacao server-side

### Fluxos principais
- Creator consegue ver oportunidades
- Creator consegue candidatar-se
- Analyst consegue criar oportunidade
- Mensagens entre perfis funcionam
- Upload de arquivos e imagens funciona

### Qualidade tecnica
- `npm run lint` sem erros
- `npm run test:ci` passando
- `npm run build` passando
- `npm audit --omit=dev` sem vulnerabilidades

## 6. Rollback rapido
- Reverter para o commit anterior estavel na Vercel
- Se necessario, desativar temporariamente cadastro de analyst
- Restaurar backup de banco caso migration tenha efeito inesperado

## 7. Monitoramento (primeiras 24h)
- Erros de autenticacao
- Falhas em upload
- Erros de webhook de oportunidade
- Latencia de carregamento das paginas principais

## 8. Tarefas pos-MVP
- Migrar Vite para major mais recente quando janela de risco permitir
- Aumentar cobertura de testes para modulos criticos
- Introduzir observabilidade estruturada (Sentry/Logs centralizados)
