# Backend AWS — plano de implementação

Objetivo autorizado: preparar somente o backend para AWS de baixo tráfego, mantendo MongoDB e Supabase. A conta AWS foi criada depois de 15/07/2025. Não publicar recursos nem alterar a rede do Atlas nesta preparação.

Arquitetura: Express existente em Lambda Node 22 com a camada oficial AWS Lambda Web Adapter, Function URL HTTPS e response streaming para os MP3 maiores que 6 MB. Sem servidor permanente, NAT Gateway, API Gateway ou mudança de banco. ZIP produzido localmente com dependências de produção, LF/permissão Unix no launcher. Template CloudFormation com limite de concorrência e logs de retenção curta. Segredos somente nos parâmetros locais ignorados; saída da stack informa URL para um futuro APK.

- [x] Testar conexão Mongo reutilizada/pool limitado e IP do cliente obtido do contexto confiável do adapter; preservar JWT e rotas.
- [x] Implementar infraestrutura declarativa, launcher e empacotamento reproduzível com verificação do ZIP.
- [x] Testar streaming HTTP/Range de música existente e sanitização das URLs configuráveis do cliente.
- [x] Documentar custos, prazo do Free Plan, rede Atlas, preparo dos parâmetros, implantação e smoke tests; verificar testes e pacote local.

Limites: Lambda sem VPC não tem egress fixo. Não liberar 0.0.0.0/0 automaticamente. NAT/IP fixo/rede privada mudam o custo e podem exigir outro plano Atlas. Lambda não garante custo zero total: transferência, logs e bucket do pacote também contam. APK instalado contém a URL antiga até reconstrução. Não pressupor a causa do 404 sem verificar o endpoint correto.
