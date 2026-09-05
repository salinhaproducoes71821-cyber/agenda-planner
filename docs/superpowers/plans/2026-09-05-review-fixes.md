# Correções da revisão — plano de implementação

**Objetivo:** implementar a revisão aprovada em `review/REVISAO.md`.
**Arquitetura:** dados locais versionados por UID, uma fila serial persistente, IDs estáveis e criações idempotentes no servidor. Sessão, notificações e áudio têm donos explícitos. Rotas validam contratos comuns aos dois bancos.
**Stack:** React Native/Expo 54, Supabase, Express, Mongoose e Sequelize; testes Node/Jest sem serviços de produção.
**Autorização:** o usuário aprovou a execução integral da revisão. Trabalho na branch existente `fix/code-review`; não é necessário novo fluxo de aprovação do desenho.

- [x] Reproduzir falhas offline com mocks de sessão, armazenamento e HTTP. Rodar `node --test mobile/tests/*.test.cjs` antes/depois. Isolar por UID, serializar writes/flush, preservar erros, coalescer alterações ainda não enviadas, persistir cache e operações numa única gravação.
- [x] Separar autenticação em `server/auth.js`; testar placeholders, issuer/sub/exp, algoritmo e JWKS. Separar startup de export do app. Testar rotas via HTTP local com banco simulado; validar datas reais, tags, limites de notas, paginação e idempotência.
- [x] Corrigir adaptadores de notas em `server/database.js`, adicionar contrato testável e IDs de criação controlados pelo cliente. Testar conservação das tags e busca combinada.
- [x] Extrair sessão, eventos, notificações, áudio e telas de `mobile/App.js`. Salvar rascunhos sem debounce destrutivo; notificar telas quando sincronização muda dados. IDs/requests da sessão anterior nunca entram na seguinte.
- [x] Usar armazenamento seguro de sessão e cópia durável de avatar local por UID. Corrigir slider, datas locais/virada de mês, assets EAS e permissões.
- [x] Atualizar dependências de forma compatível, revisar scripts e lockfiles; verificar instalação congelada sem scripts, audits, testes e bundle Android. Documentar configuração de proxy, TLS, Supabase, privacidade e limites operacionais que dependem do deploy.
- [x] Revisar diff, rastrear todos os achados no relatório de implementação e registrar evidências. Não publicar nem acessar dados reais.
