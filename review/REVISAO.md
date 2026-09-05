# Revisão integral — Agenda 3

Data: 05/09/2026. Commit examinado: `b78bbf3bc29dc5e73e8dbe0b76e6a49af85e9c74`.

**Parecer: requer correções antes de uma nova publicação.** Há falhas confirmadas de isolamento entre contas, perda de dados e contratos inconsistentes. Não foi constatada invasão do serviço publicado.

Foram aplicadas Thermo-Nuclear Code Quality Review, Security Review e Security and Hardening. O escopo é o estado completo do código, não apenas o último commit: os seis arquivos JavaScript de mobile/server, manifests, lockfiles, configurações Expo/EAS, exemplo de ambiente e documentação. Assets binários foram inventariados e suas referências conferidas; não houve análise interna dos binários. O arquivo `prototipo` contém somente uma referência ao Figma, não código executável. Nenhum AGENTS.md foi encontrado no projeto ou nos diretórios ancestrais consultados.

A revisão produziu este relatório e os JSONs de auditoria. O código da aplicação não foi alterado. P1 significa correção prioritária por exposição de dados, perda de dados ou bloqueio de entrega; P2 significa defeito relevante ou medida de proteção necessária. Severidades do npm são classificações próprias dos advisories e não equivalem automaticamente à prioridade de um defeito da aplicação.

## 1. Revisão termonuclear: arquitetura e comportamento

### T1 — P1 — O mecanismo offline perde, duplica e ressuscita operações

Referências: `mobile/api-service.js:23`, `:34`, `:91`, `:140`, `:152`, `:200`, `:212`; disparadores em `mobile/App.js:585` e `:602`.

O armazenamento usa leitura-modificação-escrita sem exclusão mútua. Duas inclusões concorrentes leem a mesma fila e a última gravação elimina a outra. Dois flushes leem o mesmo snapshot e enviam o mesmo POST duas vezes. O servidor gera um novo UUID a cada criação, sem idempotência.

Os ramos `temp_` simulam sucesso de edição/exclusão, mas não alteram nem removem o POST original. Criar uma nota offline, editar e excluir deixa a criação original pendente; ao reconectar, ela reaparece. Se a conexão já voltou, o cliente tenta PUT/DELETE do identificador temporário no servidor e recebe 404. Além disso, qualquer erro não classificado como rede, incluindo 500 e 429, remove a operação da fila.

**Evidência:** execução do módulo original em Node VM, com transporte e AsyncStorage em memória, confirmou os quatro comportamentos: edição/exclusão ignorada, descarte em 500, POST duplicado e operação perdida por concorrência.

**Reestruturação recomendada:** uma camada local por usuário que persista entidade e operação juntas, com ID estável, estado de sincronização explícito e um único consumidor da fila. Editar um item pendente deve atualizar a criação; excluir deve cancelá-la. Classificar respostas por status, preservar erros transitórios e apresentar conflitos persistentes. Adicionar idempotência no servidor para reenvios após resposta perdida. Isso elimina os ramos especiais repetidos em cada método de eventos/notas e torna o cache derivado do mesmo estado local.

**Aceitação:** criar/editar/excluir offline deve produzir o estado final esperado após reconexão e reinício; inclusões/flushes concorrentes não podem perder ou duplicar dados; 429/500 preservam operações.

### T2 — P1 — Fechar a nota elimina o último trecho digitado

Referências: `mobile/App.js:2393`, `:2405`, `:2415`, `:2432`.

O autosave espera 1.500 ms. Fechar o editor, abrir outra nota ou desmontar a tela cancela o timer sem persistir o rascunho. Digitar e tocar VOLTAR antes do prazo perde a alteração. Requisições de autosave já iniciadas também podem terminar fora de ordem e sobrescrever uma edição mais recente.

**Correção:** persistir o rascunho local imediatamente e serializar a sincronização por nota/revisão; fechar o editor não deve apagar trabalho pendente. Testar saída imediata, troca de tela, background e respostas invertidas.

### T3 — P2 — O adaptador MySQL apaga tags na resposta e pode apagá-las no banco depois

Referências: `server/database.js:301`, `:336`, `:453`, `:458`, `:467`, `:476`.

O atributo Sequelize se chama `tagsRaw`, mapeado para a coluna `tags`. Objetos retornados pelo model usam o atributo, mas os chamadores sobrescrevem `tagsRaw` com `row.tags`/`plain.tags`, que não existe nesses objetos. O mapper passa a devolver `[]`. Uma edição posterior baseada nessa resposta envia tags vazias ao servidor.

**Correção:** passar os objetos do model diretamente ao mapper; converter nomes de coluna apenas na fronteira da consulta SQL bruta. Usar testes de contrato comuns para MongoDB e MySQL: criar, ler, listar e atualizar uma nota deve preservar tags.

### T4 — P2 — A busca MySQL por tag devolve só a primeira nota e ignora o texto

Referência: `server/database.js:442`.

Com `QueryTypes.SELECT`, Sequelize retorna diretamente a lista de resultados. `const [rows]` captura a primeira linha, e o código a transforma em uma lista unitária. O SQL desse ramo também ignora o filtro `q`, preparado antes em `where`, e retorna nomes de colunas SQL sem converter `user_id`/`updated_at` para o contrato esperado.

**Correção:** usar um único caminho de consulta com os dois filtros, lista completa e mapeamento explícito. O comportamento de SELECT é descrito na [documentação oficial do Sequelize](https://sequelize.org/docs/v6/core-concepts/raw-queries/).

### T5 — P2 — O controle de posição da música recebe uma função inexistente

Referências: `mobile/App.js:757`, `:782`, `:2904`, `:2938`.

`seekTo` existe no provider, mas não é incluído no valor de `MusicContext`. A tela o desestrutura como `undefined` e o passa para `TrackSlider`. Ao concluir o gesto, o slider chama `onChange(v)` e ocorre erro.

**Correção:** expor a operação no contrato do contexto e verificar o gesto. Um contrato verificado por tipos ou um teste de integração simples capturaria essa divergência.

### T6 — P1 — O pacote EAS exclui a própria imagem obrigatória do app

Referências: `mobile/.easignore:16`, `mobile/app.json:8`, `mobile/App.js:1503` e `:3419`.

O ignore exclui `LogoNovaCorEnovosHighlightsNovo.png`, mas a configuração a usa como ícone, splash, adaptive icon e ícone de notificações. O JavaScript também faz require dessa imagem. O arquivo existe localmente e pode funcionar no desenvolvimento, mas será omitido do upload que respeita o ignore, impedindo o build remoto de resolver as referências.

**Correção:** retirar a exclusão da imagem usada; inspecionar o arquivo de upload e executar um build. O build EAS não foi disparado nesta revisão.

### T7 — P2 — Datas de calendário usam UTC enquanto a interface usa a hora local

Referências: `mobile/App.js:1911`, `:2214`, `:2656`, `:2664`.

`toISOString().split('T')[0]` calcula o dia UTC. Em São Paulo, às 21h30 de 05/09, ele retorna 06/09. No cronograma, o número e o dia da semana vêm de getters locais, mas a chave de consulta vem de UTC: o rótulo mostra um dia e busca eventos de outro. O humor também é registrado no dia seguinte. Valores memoizados no mount não avançam na virada do dia.

**Correção:** uma função canônica para datas civis locais e uma estratégia de atualização na retomada/virada do dia. A janela semanal deve carregar também o mês seguinte quando atravessa a fronteira; hoje `load(mesStr)` busca somente o mês inicial (`:2234`).

### T8 — P2 — As responsabilidades centrais estão acopladas num arquivo de 3.449 linhas

Referências: `mobile/App.js:194`, `:373`, `:442`, `:551`, `:648`, `:2379`.

O arquivo reúne temas, sessão, persistência, fila, notificações, áudio, navegação e todas as telas. O problema concreto é que vários donos independentes fazem parte da mesma operação: login/logout não controlam dados offline, telas controlam salvamento durável, carregamento de eventos dispara sincronização e notificações, e componentes dependem de contratos informais de contexto. O `seekTo` ausente e as corridas da fila são consequências observáveis dessas fronteiras.

**Reestruturação:** extrair ownership de sessão, repositório local/sincronização, serviço de notificações e áudio; telas devem consumir contratos pequenos. Extrair componentes por funcionalidade depois de estabilizar esses contratos. Separar também a criação do Express da inicialização em `server/api.js:580`: importar o app atualmente já conecta ao banco e abre uma porta, dificultando testes isolados. Não é necessário adotar microserviços nem uma camada genérica de abstração para cada função.

### T9 — P2 — Os limites de notas se contradizem e o handler oculta a causa

Referências: `server/api.js:144`, `:462`, `:490`, `:571`; `mobile/api-service.js:83`.

Os validadores anunciam 50.000 caracteres de conteúdo, mas o parser rejeita o corpo inteiro acima de 10 KB. Uma nota ASCII de 11.000 caracteres já não chega ao validador; texto Unicode atinge o limite ainda antes. O handler global transforma o erro 413 em 500. O cliente descarta os detalhes de validação 422, pois só lê `err.error` e não `err.errors`.

**Correção:** alinhar limite por rota, modelo e editor; preservar 400/413 para erros do parser e apresentar os campos inválidos. Testar fronteiras em bytes e caracteres.

### T10 — P2 — Validação de data/hora aceita valores impossíveis; sanitização destrói texto legítimo

Referências: `server/api.js:169`, `:241`; `mobile/App.js:339`, `:1771`.

`2026-99-99` e `99:99` passam pelos regexes de formato. Mongo grava datas como strings, enquanto MySQL usa tipos de data/hora, produzindo comportamentos divergentes. O agendamento local normaliza valores inválidos com Date. A remoção indiscriminada de aspas e sinais também transforma nomes como `D'Ávila` e títulos como `Revisar "A"` e pode esvaziar um título depois de ele passar pela validação.

**Correção:** validar datas civis e intervalos de hora; exigir tipos de entrada e validar o valor final. Armazenar texto legítimo e fazer encoding na saída apropriada. O app atual usa Text/TextInput nativos; não foi encontrado um sink de HTML que justifique essa remoção destrutiva.

### T11 — P2 — O avatar sincronizado é apenas um caminho temporário de um dispositivo

Referências: `mobile/App.js:3095`, `:3107`; `server/api.js:300`.

O picker retorna uma URI local e ela é gravada no backend. Outro aparelho recebe um caminho que não possui; a limpeza do cache local também pode invalidá-lo no aparelho de origem. Não há upload nem cópia durável.

**Correção:** definir o produto como avatar local persistente ou implementar armazenamento de imagem com validação e acesso por proprietário. O segundo caso exige desenhar o fluxo de upload antes da implementação. O backend atual não faz fetch dessa URI; não foi demonstrado SSRF no servidor.

## 2. Security Review: fronteiras de confiança

### S1 — P1 — Dados e operações offline atravessam a troca de conta

Referências: `mobile/api-service.js:21`, `:54`, `:91`, `:115`, `:173`, `:227`; `mobile/App.js:499`.

Cache e fila usam chaves globais, sem userId. Logout remove somente `@ag_user`. A sessão é consultada a cada request da fila. Assim, uma nota criada offline por A é enviada com o token de B após troca de conta; B também pode ler notas/humores em cache de A quando a rede falha. As queries do backend corretamente filtradas por usuário não resolvem esse problema: o POST chega autenticado como B.

**Evidência:** duas reproduções com o módulo original confirmaram leitura do cache de A por B e envio de conteúdo de A usando `Bearer account-B`.

**Correção prioritária:** namespaces por UID, proprietário obrigatório em toda operação, checagem da sessão antes de enviar e antes de aplicar respostas, cancelamento de trabalho da sessão anterior e limpeza/isolamento no logout. Dados legados sem dono não devem ser atribuídos automaticamente à próxima conta.

### S2 — P1 condicional — O segredo de exemplo habilita assinatura HS256 conhecida

Referências: `server/.env.example:25`; `server/api.js:71`, `:202`, `:206`.

`COLE_AQUI_O_JWT_SECRET_DO_SUPABASE` tem mais de 20 caracteres e satisfaz o único teste de configuração HS256. Se alguém copiar o exemplo e configurar apenas a URL para usar JWKS, deixando esse texto, o servidor continuará aceitando HS256 com segredo público e previsível. Um token assinado com esse valor, audiência authenticated e sub de outra pessoa passa pela verificação simétrica. A disponibilidade de JWKS não desliga essa alternativa.

**Correção:** placeholder vazio, rejeição explícita de placeholders e configuração fail-closed; habilitar apenas os modos de assinatura realmente provisionados. Verificar que a configuração do deploy não mantém esse exemplo. Não foi acessado o ambiente remoto, portanto a presença desse segredo em produção não foi afirmada.

### S3 — P2 — Notificações privadas sobrevivem ao logout

Referências: `mobile/App.js:391`, `:404`, `:499`.

Notificações contêm o título do compromisso, mas logout não cancela notificações agendadas nem remove o índice global `@ag_notif_ids`. Elas podem exibir títulos de A após a saída ou enquanto B usa o aparelho. Reagendamentos assíncronos também precisam ser invalidados na troca de sessão.

**Correção:** o serviço de notificações deve pertencer à sessão, reconciliar IDs com o conjunto de eventos e cancelar o trabalho anterior na saída. Verificar ainda os fluxos de exclusão/alteração em outro dispositivo: recarregar hoje agenda os eventos existentes, mas não cancela automaticamente os que desapareceram.

### S4 — P2 — Tokens são persistidos sem criptografia adicional no AsyncStorage

Referência: `mobile/supabase.js:25`.

O SDK persiste a sessão, incluindo refresh token, no AsyncStorage. Esse armazenamento é isolado pelo sandbox do app, mas não é criptografado: a extração do armazenamento expõe a sessão. Não significa que qualquer outro app possa lê-lo. A [documentação de segurança do React Native](https://reactnative.dev/docs/security) recomenda armazenamento seguro para tokens.

**Correção:** adaptador seguro para sessão com Keychain/Keystore, migração e tratamento de falhas/tamanho. Classificar separadamente notas e histórico de humor para decidir criptografia, retenção e exclusão. Cookies HttpOnly não são uma substituição automática para o cliente nativo.

### S5 — P2 — Um kid arbitrário força nova consulta JWKS

Referências: `server/api.js:89`, `:95`, `:209`.

Um JWT assimétrico com kid desconhecido entra em fetch antes de ser autenticado, mesmo com cache recente. Cada kid falso provoca nova consulta; não há compartilhamento de chamada em andamento, cooldown para misses nem timeout explícito. O rate limit geral reduz frequência por IP, mas não elimina a amplificação ou a retenção de requisições.

**Correção:** cache com refresh coalescido e intervalo mínimo, validação do header, timeout e limites de resposta. Manter suporte seguro à rotação. A URL vem da configuração do servidor, portanto isso não foi classificado como SSRF controlável pela requisição.

### S6 — P2 — Falta barreira no repositório contra inclusão acidental de segredos

Referências: raiz do repositório; commit atual `b78bbf3` remove o gitignore; `mobile/.easignore`.

Não há .gitignore versionado protegendo .env, chaves ou credenciais. O .easignore também não exclui arquivos de ambiente/credenciais que venham a ser criados no mobile. Isso aumenta o risco em operações rotineiras de add/upload; não prova vazamento atual.

**Correção:** restaurar exclusões de segredos preservando `.env.example`, acrescentar verificação de segredos em commits/CI e separar configurações públicas de privadas. A anon key do Supabase no cliente é pública por design e não foi tratada como chave administrativa vazada. A inspeção de nomes históricos encontrou `.env.example`; não foi executado um scanner completo de conteúdo de todos os commits.

## 3. Security and Hardening: dependências e proteção operacional

`npm audit --json --ignore-scripts` foi executado nas duas raízes independentes que possuem package-lock.json. Nenhuma instalação, atualização forçada ou script de dependência foi executado.

| Raiz | Críticos | Altos | Moderados | Total |
| --- | ---: | ---: | ---: | ---: |
| server | 0 | 3 | 8 | 11 |
| mobile | 1 | 15 | 9 | 25 |

Resultados integrais: `audit-server.json` e `audit-mobile.json`, nesta pasta. Esses totais contam pacotes afetados, inclusive propagação transitiva, não 36 explorações independentes.

**Servidor:** os três pacotes de severidade alta (`brace-expansion`, `browserslist`, `js-yaml`) estão marcados como dev no lockfile. Sua exposição envolve ferramentas de desenvolvimento/teste, não um caminho HTTP demonstrado. Entre os moderados há Express/qs, Mongoose, Morgan, mysql2 e uuid/Sequelize. O app usa uuid v4; o advisory de v3/v5/v6 com buffer não corresponde a essa chamada. As dependências continuam exigindo atualização e triagem por caminho; não se deve declarar exploração só pela presença no lockfile.

**Mobile:** `tar@7.5.16` recebeu classificação crítica no audit. O [advisory de tar](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) descreve DoS na análise/descompressão de arquivo. O código da aplicação não importa tar; a superfície a investigar é a ferramenta Expo que processa arquivos, não uma exploração remota demonstrada do APK. Metro, PostCSS, parsers de imagem/XML/YAML e undici também aparecem na cadeia de ferramentas. Como Expo está em dependencies, a classificação prod/dev do npm não representa fielmente o que executa no aparelho. Parte da remediação sugerida pelo npm envolve major de Expo; não aplicar `audit fix --force` sem plano de compatibilidade.

Medidas adicionais, com dependências de ambiente explicitadas:

- Validar issuer esperado, sub UUID e presença/validade de exp na fronteira JWT. Hoje há allowlist de algoritmos e audiência, mas esses contratos adicionais não são exigidos. Isso é defesa adicional; não demonstra por si só falsificação de assinatura.
- Conferir topologia de proxy antes de usar `trust proxy = 1`. A confiança por contagem pressupõe um caminho de rede específico. Se houver acesso direto ao Node, X-Forwarded-For pode influenciar o IP. Com várias instâncias, os contadores em memória do limiter não são compartilhados. O deploy real não foi inspecionado.
- Manter os limites de login/OTP no Supabase. O bloqueio de 30 segundos no React pode ser contornado fora da interface; não é evidência de que o Supabase esteja sem rate limit.
- Remover permissões que o produto não usa, em especial RECORD_AUDIO: o código examinado reproduz áudio e escolhe fotos, sem gravação de microfone. Conferir o manifest gerado por plugins.
- Reduzir logs com query string: Morgan combined pode registrar buscas pessoais por `q`; evitar também o log integral de erros de parser que podem conter o corpo inválido. Usar eventos estruturados e redação.
- Definir paginação e limites de armazenamento: listas completas de eventos/notas crescem sem limite e podem pressionar memória, rede e renderização. Indexar também as consultas MySQL por usuário/data.
- Formalizar retenção, exportação e exclusão de perfil/notas/humor. O código não oferece exclusão integral de conta/humores nem política de retenção. Termos e política na tela de cadastro não abrem documentos e o aceite não é persistido. Essas são lacunas de engenharia; não foi emitido parecer jurídico.
- Corrigir COMO_RODAR.txt: aponta segredos JWT antigos não usados, caminhos de execução incorretos e incentiva permissão ampla de banco/rede e transporte HTTP. Separar setup local e produção, usar conta de banco com privilégio mínimo e TLS no cenário remoto, inclusive MySQL.
- Fixar versão de Node/npm, documentar scripts necessários e usar instalação congelada com política de scripts revisados em CI. As raízes têm lockfiles, mas não possuem packageManager ou pipeline versionado.

## 4. Ordem concreta de correção

1. **Isolamento e integridade:** corrigir S1, T1 e S3 juntos sob ownership de sessão; testar duas contas, reconexão, logout no meio do flush e reinício. Validar imediatamente a configuração descrita em S2.
2. **Persistência de notas:** corrigir T2–T4 e T9, adicionando testes de contrato executados contra os dois adaptadores com bancos descartáveis. O editor deve preservar rascunhos mesmo quando o servidor rejeita o texto.
3. **Entrega e uso diário:** corrigir T5–T7, T10 e T11; verificar build EAS, slider, datas locais, virada do mês e referências de assets.
4. **Hardening:** armazenamento seguro, cache JWKS, logs, segredos, permissões e dependências. Atualizar grupos compatíveis, revisar changelogs/lockfiles e validar Expo/React Native conjuntamente quando necessário.
5. **Redução estrutural:** aplicar T8 por fronteiras de responsabilidade; evitar mover o mesmo acoplamento para vários arquivos sem reduzir os estados e as decisões duplicadas.

## 5. Verificação e limites

- Seis reproduções passaram ao afirmar os comportamentos defeituosos no serviço offline original. O transporte, sessão e armazenamento foram simulados; nenhum dado foi enviado ao backend real.
- `node --check server/api.js` e `node --check server/database.js` passaram. Isso verifica sintaxe, não segurança ou integração.
- Ambos os audits npm retornaram vulnerabilidades e foram preservados integralmente. O lockfile foi consultado para versões e classificação dev.
- Nenhum arquivo de teste/spec ou CI foi encontrado entre os arquivos versionados. Há script Jest no servidor, mas não há suíte versionada. Não havia node_modules no mobile; não foram instaladas dependências para simular um build completo.
- Não foram executados build APK/iOS, testes de dispositivo, banco Mongo/MySQL real, scanner completo de segredos históricos ou inspeção de configurações de Railway/Supabase. RLS, backups, TLS efetivo, revogação de sessões e limites do provedor dependem dessa inspeção.
- Pontos positivos observados: HTTPS nas URLs atuais do cliente, Helmet, JSON limitado, respostas de erro de aplicação geralmente genéricas, SQL com parâmetros, regex de busca Mongo escapado e filtros de proprietário nos CRUDs expostos. As releituras MySQL após update devem preservar o userId também, embora a rota já confira ownership antes e não tenha sido demonstrado IDOR por esse trecho.

Esta revisão não certifica ausência de vulnerabilidades. Os achados de comportamento indicam problemas concretos no código examinado; as hipóteses dependentes do deploy estão identificadas como condicionais.
