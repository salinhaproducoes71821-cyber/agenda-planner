# Correções aplicadas — Agenda 3

Data: 05/09/2026. Base revisada: b78bbf3bc29dc5e73e8dbe0b76e6a49af85e9c74.
Alterações locais na branch existente `fix/code-review`, autorizadas pelo usuário após a revisão. Sem push, deploy ou acesso a dados de produção.

## Rastreabilidade da revisão

| Achado | Implementação | Evidência / limite |
| --- | --- | --- |
| T1 / S1 — fila offline e isolamento | api-service.js usa snapshot por UID, gravação serial de dados+fila, revisão por recurso, consumidor único, UUID estável e criação idempotente no servidor. Preserva 408/429/5xx/rede e sinaliza rejeições permanentes. Edição/exclusão posterior a POST com resposta perdida converge. | Regressões de concorrência, duas contas, reinício, falha de disco, respostas atrasadas e buscas paralelas. |
| T2 — último trecho de nota | notes-screen.js persiste cada alteração local imediatamente. A espera de 750 ms agrupa apenas envio à rede, nunca a gravação local. | Serviço serial testado; sair da tela não cancela a persistência iniciada. Gestos e encerramento abrupto do processo precisam de teste nativo. |
| T3 / T4 — MySQL tags e busca | Mapper recebe tagsRaw correto; busca usa um único findAll com filtros q e tag combinados; releituras mantêm userId. | Testes com Sequelize real e transporte de banco simulado; banco MySQL real ainda não exercitado. |
| T5 — slider | MusicContext publica seekTo. | Contrato conferido, análise de bindings e bundle aprovados. Gesto/áudio nativo ainda não exercitados. |
| T6 — assets EAS | .easignore mantém a imagem obrigatória e exclui segredos. | Export Android inclui logo e os três sons. Upload EAS/build APK não executados. |
| T7 — datas | datas civis locais compartilhadas, relógio de dia em retomada/virada do dia e cronograma carregando eventos além do mês atual. | Teste perto da meia-noite em America/Sao_Paulo, virada de mês, dias impossíveis e ano bissexto. |
| T8 — responsabilidades | App.js passa de 3.449 para aproximadamente 132 linhas, compondo módulos de sessão, eventos, áudio, navegação e telas. Auth/validation do servidor separados; import de Express não inicia processo/banco. | Bundle resolve 902 módulos; análise de escopo não encontrou bindings indefinidos nos módulos mobile. |
| T9 — notas e parser | /api/notes aceita até 320 KB de JSON, mantendo validação de 50 mil caracteres; demais rotas 10 KB. Respostas 413/400 corretas. | HTTP local testado com nota >10 KB, payload excessivo e tipos inválidos. |
| T10 — validação | Datas/meses reais, HH:mm, booleano JSON, strings, tags e paginação limitados; trim preserva pontuação. | Regressões HTTP aprovadas; UI aplica limites correspondentes. |
| T11 — avatar | Cópia em documentDirectory por UID; foto não é enviada ao servidor. Rota legada aceita somente HTTPS, sem credenciais na URL. | Bundle aprovado e validação da rota testada. Galeria/arquivo persistente exigem aparelho. |
| S2 — JWT | Configuração falha com placeholder; exige URL HTTPS real, issuer/audience/sub UUID/exp e allowlist de algoritmos. | JWT assinado, issuer incorreto, sub/exp inválidos e configuração testados. |
| S3 — notificações | Dono explícito e geração de sessão, cancelamento na saída/troca/inicialização deslogada, reconciliação de eventos removidos. | Testes de cancelamento inicial e repetição após falha. Comportamento do SO exige aparelho. |
| S4 — sessão segura | SecureStore com chunks, publicação por manifesto, migração de AsyncStorage e remoção local no logout. | Migração longa, substituição com falha, chunk ausente e manifesto corrompido testados com armazenamento simulado. |
| S5 — JWKS | Cache 10 minutos, refresh compartilhado, cooldown 30 segundos, timeout 5 segundos e limites de chaves/corpo. | Oito kids desconhecidos simultâneos fazem uma consulta; chave conhecida continua validando. |
| S6 — segredos | .gitignore/.easignore, verificação de padrões de segredo em arquivos atuais e CI. | Scanner local passou. É uma barreira limitada, sem varredura integral do histórico Git. |

## Hardening adicional

- Node 22.22.3 / npm 12.0.2 e instalação congelada sem lifecycle scripts de dependências; scripts de teste explícitos funcionam.
- CI versionado: actions fixadas por SHA, permissões contents:read, testes, scanner, triagem de audit e export Android. O workflow ainda não foi executado no GitHub.
- Remoção de RECORD_AUDIO, plugins sem permissão de microfone e backup Android desativado. A efetividade no manifest compilado ainda precisa de build nativo.
- URLs de API/música centralizadas com HTTPS obrigatório. Logs HTTP não incluem URL, query, token ou corpo; erros de conexão não imprimem URI.
- Trust proxy usa IPs/CIDRs explicitamente configurados. MySQL oferece TLS com verificação de CA, e sync automático está restrito a development/test sem alter/force.
- Eventos/notas paginados em lotes de 200. O cliente mantém dados locais e apresenta falhas permanentes de sincronização. Alterar o item cria uma nova tentativa; falhas transitórias são repetidas ao reconectar, retomar/recarregar ou após nova alteração.
- README e COMO_RODAR.txt substituem instruções antigas de segredos, diretórios, permissões amplas e HTTP.
- Removido o aceite fictício de termos sem documento. O cadastro informa o armazenamento e a ausência atual de exclusão integral. Isso não constitui uma política jurídica publicada.

## Dependências

| Raiz | Antes: crítico / alto / moderado | Depois: crítico / alto / moderado |
| --- | --- | --- |
| server | 0 / 3 / 8 | 0 / 0 / 2 |
| mobile | 1 / 15 / 9 | 0 / 8 / 8 |

Os números contam pacotes, incluindo propagação transitiva. Os relatórios integrais são audit-server-after.json e audit-mobile-after.json. npm audit continua retornando status 1 pelos advisories remanescentes; não foi declarado um audit sem vulnerabilidades.

Atualizações compatíveis preservam Expo 54 / React 19.1 / RN 0.81.5. Overrides explícitos: qs 6.16.0 e PostCSS 8.5.28, verificados com testes e bundle.

Os alertas restantes correspondem a três advisories:

- uuid (moderado), [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): afeta v3/v5/v6 com buffer. O app agora usa crypto.randomUUID / expo-crypto. Na cadeia examinada, Sequelize usa v1/v4 e xcode usa v4. Não se aplica àquelas chamadas. Permanece transitive dependency sem suporte; reavaliar na atualização dos consumidores.
- image-size (alto), [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) e [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq): sem versão corrigida informada pelo audit. O Metro principal e seu transformer carregam image-size-policy.cjs antes do parser e desativam esses formatos. PNG usado pelo app continua funcionando; ICNS malformado é rejeitado em teste com timeout. A proteção não corrige o pacote upstream nem ferramentas externas que ignorem essa configuração.

scripts/audit-dependencies.cjs permite somente esses advisories conhecidos até 05/10/2026, imprime a triagem e falha em qualquer advisory novo ou exceção vencida. Não se usou audit fix --force nem salto de major do Expo.

## Migração e operação

A versão anterior não gravava dono na fila offline. Não há como atribuí-la automaticamente com segurança: a migração preserva seu conteúdo em @ag_legacy_unowned_queue (ou arquivo lógico com sufixo em caso de colisão), fora da fila ativa e fora da interface. Sua recuperação exige análise local e confirmação de propriedade; nunca é enviada como se pertencesse à próxima conta. Os caches globais antigos são removidos. Os snapshots novos são por UID e permanecem após logout.

Tokens migram para SecureStore. Conteúdo de notas/humor/eventos e perfil continuam em AsyncStorage, isolados por conta na aplicação, sem criptografia adicional dos conteúdos. Não há proteção contra extração do sandbox em aparelho comprometido.

O backend atualizado deve entrar antes do cliente para que IDs estáveis e paginação tenham o contrato esperado. O novo cliente requer recompilação nativa pelos plugins SecureStore/FileSystem/permissões. Não foi disparada essa publicação.

## Validação executada

- npm ci --ignore-scripts --no-fund --no-audit: passou nas duas raízes (429 pacotes server, 676 mobile).
- npm test em server: 29 testes / 3 suítes aprovados após instalação congelada.
- npm test em mobile: 35 testes aprovados após instalação congelada, incluindo datas e proteção Metro.
- Export Android: 902 módulos, 23 assets, bundle Hermes ~3,15 MB. Artefatos gerados em mobile/dist (ignorados pelo Git).
- Análise sintática/de bindings dos módulos mobile: passou. git diff --check: passou.
- Scanner de padrões de segredo dos arquivos atuais: passou. Gate de advisories: passou com as exceções explicitadas acima.

## Limites e pendências para publicação

Não foram exercitados APK/iOS ou dispositivo, bancos Mongo/MySQL reais, nem as configurações Railway/Supabase. Os testes de banco usam bibliotecas reais e I/O simulado; não substituem contratos contra bancos descartáveis. Não há comprovação de TLS efetivo, RLS, limites de OTP, backup/restauração ou revogação remota.

A topologia real precisa definir TRUST_PROXY e um rate limiter compartilhado se houver réplicas; o limite em memória atual é por processo. Índices adicionais MySQL por usuário/data e qualquer preparação de schema produtivo precisam de migração revisada. Limites globais de armazenamento/quantidade por conta ainda não foram definidos.

Retenção, exportação e exclusão integral (inclusive identidade Supabase, humores, backups e dados locais) permanecem pendências de produto/operação. Não foi inventado prazo de retenção nem aplicado apagamento de contas. A validação nativa deve cobrir logout durante sync, troca de conta, notificações, sessão migrada, galeria, slider, edição seguida de saída e virada de data. Estas correções não constituem certificação de segurança.
