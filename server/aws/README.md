# Backend na AWS

## Implantação ativa — 05/09/2026

Publicação autorizada e concluída na região `us-east-1`, stack `agenda-backend`, função `agenda-backend-api`. Endpoint: https://5iqcsa5wa7y3xb7eueqtapx5zm0tzrri.lambda-url.us-east-1.on.aws/ . MongoDB `agenda` e Supabase existentes foram preservados. A conexão foi obtida da configuração do backend anterior, sem exibir suas credenciais e sem modificar a lista de acesso do Atlas. O backend antigo permanece intacto.

A conta informou Free Plan ativo, US$119,95 de créditos restantes no início da implantação e vencimento em 05/02/2027. Isso é um retrato do momento; conferir Billing para o saldo atual. Não houve migração para Paid Plan. Não foram criados alertas por e-mail.

A quota regional é de 10 execuções simultâneas; esta implantação usa `ReservedConcurrency=-1` para compartilhar essa quota, pois a conta nova não permite a reserva proposta de 5. O template ainda aceita 0 para desativar ou valores positivos quando houver quota suficiente. Não há garantia de teto de gastos.

Verificações reais: `/api/health` retornou 200; `/api/events` sem token e com token inválido retornou 401; Range de música retornou 206 com 16 bytes. O bucket de artefatos tem bloqueio de acesso público. Os 35 testes de servidor e 38 do mobile passaram novamente. Login e operações com uma sessão real no aparelho ainda precisam ser testados pelo usuário; não foram usados dados de login de terceiros para essa verificação.

Transferência completa de música: uma chamada retornou HTTP 200 com 8.485.753 bytes em 1,53 s, mas outras chamadas locais excederam 30/60 segundos após baixar apenas parte do arquivo. Os logs Lambda registraram conclusão em menos de um segundo, sem eventos ERROR. A causa da intermitência na transferência ainda não foi determinada; conferir reprodução no aparelho antes de liberar para usuários.

`mobile/config.js` e os perfis `preview`/`production` de `mobile/eas.json` agora apontam para a URL AWS. O build APK `b2680ad2-0236-4d73-9692-eaa471cab235` terminou com status FINISHED, com essa variável confirmada na saída de envio. [Baixar APK conectado à AWS](https://expo.dev/artifacts/eas/zZECtHa-8TiI91ZN9VwHf56arlUCvLzrfZqFJtyYyWw.apk). As instruções abaixo são referência para futuras implantações; não executar `create-stack` novamente sobre a stack existente.

Preparação para publicar o Express existente no Lambda Node.js 22/ARM64, mantendo MongoDB Atlas e Supabase. A Function URL fornece HTTPS. O Web Adapter oficial v1.0.1 (layer ARM64 versão 28) inicia o servidor e transmite respostas, inclusive MP3 maiores que o limite de 6 MB do modo buffered. Nenhum recurso AWS é criado pelo empacotador.

## Custos e escolha de serviço

Para tráfego baixo/intermitente, Lambda evita uma máquina permanentemente ligada. A franquia publicada é de 1 milhão de requisições e 400 mil GB-segundos/mês, compartilhada conforme as regras da conta. Isso não garante custo total zero: transferência das músicas, streaming, logs e armazenamento do ZIP no S3 também precisam ser considerados. A Function URL evita adicionar um API Gateway.

Contas criadas depois de 15/07/2025 seguem o programa novo: US$100 iniciais e até US$100 adicionais por atividades elegíveis. O Free Plan termina em seis meses ou ao consumir os créditos, o que ocorrer primeiro. A data de criação, o plano atual e o saldo precisam ser conferidos em Billing; não presumir que uma conta posterior à data ainda está no período gratuito. Para continuidade após o Free Plan é necessário avaliar o Paid Plan, com cobrança do que exceder benefícios aplicáveis.

Lightsail é uma alternativa se IP fixo e servidor permanente forem prioritários, mas a oferta é temporária e depois há mensalidade. EC2 exige mais administração e também não é uma promessa de hospedagem gratuita permanente.

Fontes consultadas em 05/09/2026: [planos AWS](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html), [Free Tier](https://aws.amazon.com/free/free-tier-faqs/), [Lambda](https://aws.amazon.com/lambda/pricing/), [Lightsail](https://aws.amazon.com/lightsail/pricing/), [streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html).

## Decisão obrigatória: rede do Atlas

Este template não cria VPC, NAT Gateway ou IP de saída fixo. Lambda acessando a internet pode sair por IPs variáveis, incompatíveis com uma allowlist de um único IP no Atlas. Não altere automaticamente a lista para `0.0.0.0/0`. Defina uma política aceitável antes do deploy: rede privada/saída fixa adiciona custo e depende do plano Atlas; se uma allowlist restrita por IP for requisito, considere Lightsail ou outra arquitetura com saída fixa. O parâmetro `NetworkAccessReviewed=yes` registra essa revisão, mas não configura nem valida a conectividade.

Use credenciais exclusivas com acesso somente ao banco necessário e TLS; não coloque a URI no aplicativo. O pool Mongo é reutilizado no processo, limitado a cinco conexões de aplicação por instância (há conexões adicionais de monitoramento). Concorrência reservada 5 limita instâncias simultâneas, não o gasto mensal. O limitador HTTP é local a cada instância. Músicas permanecem públicas como antes e podem consumir transferência.

[Orientação oficial MongoDB para Lambda](https://www.mongodb.com/docs/atlas/manage-connections-aws-lambda/).

## Preparar e publicar

Execute os comandos abaixo a partir de `server`, somente quando for publicar. Requisitos: Python 3.10+, Node/npm compatíveis com package.json, AWS CLI autenticada e permissões CloudFormation/Lambda/IAM/Logs/S3. Escolha uma região comercial AWS próxima ao Atlas e disponível na conta. A layer usada não foi configurada para GovCloud/China. Confira a quota de concorrência: a reserva não pode consumir a parcela mínima não reservada da conta; uma conta nova pode precisar de aumento de quota.

1. Em Billing, confira plano/créditos e configure alertas de orçamento. Alertas não são bloqueio automático de gastos.
2. Prepare um bucket S3 **privado**, na mesma região, com bloqueio de acesso público e criptografia. Ele armazena apenas o pacote de implantação. Evite manter versões antigas indefinidamente.
3. Gere o pacote e copie os parâmetros locais:

```powershell
python aws/package.py
Copy-Item aws/parameters.example.json .env.aws.parameters.json
```

Edite `.env.aws.parameters.json` localmente com bucket, chave do objeto, URI real do Atlas (incluindo nome do banco e credenciais URL-encoded), URL do mesmo projeto Supabase do mobile e a decisão de rede. Deixe `SupabaseJwtSecret` vazio para chaves assimétricas/JWKS; só preencha para HS256 legado. `AllowedOrigins` vazio atende ao app nativo; para web, use origens exatas separadas por vírgula. Esse arquivo está ignorado pelo Git. Não cole segredos no terminal, em commits ou no chat. `NoEcho` oculta parâmetros nas respostas comuns do CloudFormation, mas administradores com acesso à configuração Lambda podem ver as variáveis.

4. Escolha a região e envie o artefato. Substitua o bucket abaixo e use a mesma chave no arquivo de parâmetros:

```powershell
$awsRegion = 'us-east-1'
$artifactBucket = 'SUBSTITUA_BUCKET_PRIVADO'
$artifactManifest = Get-Content .aws-build/manifest.json | ConvertFrom-Json
$artifactKey = "agenda/$($artifactManifest.sha256).zip"
aws s3 cp .aws-build/agenda-backend.zip "s3://$artifactBucket/$artifactKey" --sse AES256 --region $awsRegion
aws cloudformation validate-template --template-body file://aws/template.json --region $awsRegion
aws cloudformation create-stack --stack-name agenda-backend --template-body file://aws/template.json --parameters file://.env.aws.parameters.json --capabilities CAPABILITY_IAM --region $awsRegion
aws cloudformation wait stack-create-complete --stack-name agenda-backend --region $awsRegion
aws cloudformation describe-stacks --stack-name agenda-backend --query 'Stacks[0].Outputs' --region $awsRegion
```

Pare se qualquer comando falhar. Para atualização, gere outro ZIP, use sua nova chave SHA256 nos parâmetros e troque `create-stack` por `update-stack`, seguido de `stack-update-complete`. Mantenha o artefato anterior para eventual rollback. Os comandos acima criam recursos cobrados conforme o plano; não foram executados nesta preparação (apenas `validate-template`, que é leitura).

O launcher é normalizado para LF e modo Unix 755 dentro do ZIP mesmo no Windows. Instalação usa o lockfile, somente dependências de produção e scripts de instalação desabilitados. Não adicionar dependências nativas compiladas no Windows a este pacote ARM64: nesse caso será necessário empacotar em Linux ARM64 compatível. O ZIP exclui `.env`, testes do projeto e arquivos de infraestrutura.

## Validar e configurar o aplicativo

Após obter `ApiBaseUrl`, teste `/api/health` (200), `/api/events` sem token (401) e, com login real, criação/leitura/edição/exclusão de um item de teste. Confirme que outra conta não acessa esse item. Teste música completa e `Range: bytes=0-15` em `/music/rudolph.mp3` (206, 16 bytes), inclusive no APK. Consulte logs da stack para falhas de rede/JWKS sem registrar tokens ou URI.

A Function URL é pública no nível AWS (`AuthType=NONE`), mas rotas privadas continuam exigindo JWT Supabase no Express. As duas permissões de invocação exigidas pelas URLs atuais são limitadas ao acesso via Function URL. O contexto de IP usado pelo rate limiter vem do header sobrescrito pelo adapter, aceito apenas no Lambda via loopback; não se confia em X-Forwarded-For enviado pelo cliente.

Configure `EXPO_PUBLIC_API_URL` com a URL real da stack no ambiente EAS utilizado pelo perfil `preview` (e depois no ambiente de produção), sem `/api` no final. A URL é pública e pode aparecer no bundle. Gere um novo APK via EAS no diretório `mobile`; definir apenas uma variável no PowerShell local não garante sua presença no build remoto. O APK já instalado mantém a URL Railway antiga. O código aceita a barra final retornada pela AWS e a remove para não gerar `//api/...`.

Em emergência, concorrência reservada zero desativa invocações. Remover a stack apaga seus recursos e logs; o bucket de artefatos é externo e permanece. Nenhuma dessas operações modifica ou apaga o Atlas ou Supabase.

## Validação desta preparação

35 testes do servidor e 38 do mobile passaram. O ZIP foi gerado e verificado localmente (arquivos obrigatórios, exclusões, tamanho e permissões). `aws cloudformation validate-template` aceitou o template em us-east-1. Isso não substitui o primeiro deploy: conexão com Atlas, disponibilidade/quota na região, execução real da layer e testes no aparelho dependem da publicação.

[Web Adapter ZIP](https://aws.github.io/aws-lambda-web-adapter/getting-started/zip-packages.html) · [Permissões Function URL](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html).
