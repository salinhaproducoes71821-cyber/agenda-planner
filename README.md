# Agenda Planner

Aplicativo React Native / Expo 54 com API Express, autenticação Supabase e adaptadores MongoDB/MySQL.

- `mobile/`: aplicativo, armazenamento por conta, sincronização e notificações.
- `server/`: API e persistência. A API não recebe senhas; valida access tokens do Supabase.
- `review/REVISAO.md`: revisão original do commit b78bbf3.
- `review/CORRECOES.md`: mudanças aplicadas, evidências e limites de validação.

## Executar

Use Node 22.22.3 e npm 12.0.2. Instale separadamente em `server/` e `mobile/` com `npm ci --ignore-scripts`. O arquivo COMO_RODAR.txt contém a configuração completa. Não há package.json na raiz.

Em cada diretório, `npm test` executa os testes locais. No mobile, `node node_modules/expo/bin/cli export --platform android --output-dir dist --no-minify` verifica o bundle Android. Isso não substitui um build nativo e testes em aparelho.

## Dados e segurança

A sessão usa SecureStore; notas, eventos e humor usam AsyncStorage separado por UID. A fila offline é persistida junto com os dados, e POSTs usam UUID estável para tolerar reenvios. Logout invalida requisições e cancela lembretes, preservando os dados locais da própria conta para o próximo login.

A foto é local ao aparelho. Retenção, exportação/exclusão integral de conta, criptografia adicional dos conteúdos locais e configuração real dos provedores estão descritas como pendências em review/CORRECOES.md. Não há política jurídica fictícia nem comprovação de consentimento.

CI instala o lockfile sem scripts de dependências, executa testes, audit com triagem explícita e export Android. As três exceções de advisories expiram em 05/10/2026 e exigem reavaliação.
