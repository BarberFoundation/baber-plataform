
## Contexto

Estou desenvolvendo um app completo para uma barbearia (projeto de portfólio, cobrando valor simbólico de um amigo dono do estabelecimento). Quero que você me ajude a **arquiteturar o projeto antes de eu escrever qualquer linha de código** — preciso de uma sessão de design técnico, não de implementação ainda.

### Sobre mim (developer)
- Stack que domino: Node.js/TypeScript, NestJS, DDD + Clean Architecture, Drizzle ORM, PostgreSQL, React 19 + Vite, Flutter (camadas: domain/datasource/repository, ValueNotifier/Provider/Riverpod, BLoC), Docker, Git.
- Tenho minha própria CLI de scaffolding (`create-gabryel`) com templates NestJS+DDD+Drizzle, React+Vite e Turborepo monorepo — posso reaproveitar.
- Já trabalhei com Evolution API (WhatsApp) em outros projetos (bots multi-agente), então integração de notificação via WhatsApp é viável e barata pra mim.
- Prefiro aprender fazendo e quero feedback direto e honesto — se uma decisão de arquitetura for exagero pro escopo, me avise sem rodeios.

### Sobre o projeto
- **Objetivo:** app completo (mas sem overengineering) pra uma barbearia pequena/média.
- **Plataformas:** mobile (cliente final, em Flutter) + web (painel admin da barbearia).
- **Escopo funcional pretendido:**
  - Lado cliente: cadastro/login, listagem de barbeiros/serviços/preços, agendamento com checagem de disponibilidade real, histórico de cortes, cancelamento/remarcação, notificação via WhatsApp.
  - Lado admin (web): gestão de agenda dos barbeiros, cadastro de serviços/preços, cadastro de clientes e histórico, visão simples de faturamento.
- **Não se apegar agora:** pagamento online, programa de fidelidade/pontos, multi-loja/franquia.
- **Prazo:** livre, sem pressão de deadline.
- **Contexto de negócio:** vai rodar de verdade numa barbearia real, mas é baixo volume (não precisa pensar em escala de milhares de usuários simultâneos).

## O que eu quero que você faça

Quero uma sessão de **design de arquitetura**, estruturada assim:

1. **Bounded contexts**: me ajude a identificar os bounded contexts desse domínio (ex: Agendamento, Catálogo de Serviços, Gestão de Barbeiros, Clientes, Notificações...). Pra cada um, quero saber: responsabilidade, que entidades/agregados pertencem a ele, e como eles se comunicam entre si (eventos de domínio? chamada direta? fila?).

2. **Modelagem tática DDD**: dentro do bounded context de Agendamento (que é o coração do sistema), quero discutir entidades, value objects, agregados e invariantes — principalmente a lógica de conflito de horário/disponibilidade, que é a parte não-trivial do domínio.

3. **Decisão de arquitetura backend**: avalie comigo monolito modular vs separar serviços desde já, dado que é baixo volume e projeto de portfólio. Quero ver prós e contras de cada opção pro MEU contexto específico (não genérico), considerando que depois eu talvez queira mostrar isso pra recrutadores como prova de que sei fazer DDD/arquitetura em camadas.

4. **Definição de camadas**: como ficaria a estrutura de pastas seguindo meu padrão de DDD (domain/application/infra), reaproveitando o template `create-gabryel` quando fizer sentido.

5. **Integração mobile-web-backend**: como o Flutter (cliente) e o painel web (React) vão consumir a mesma API — endpoints compartilhados, autenticação (qual estratégia: JWT simples? sessão?), e se faz sentido ter um BFF ou é exagero pro tamanho do projeto.

6. **Notificação via WhatsApp**: onde essa responsabilidade entra na arquitetura (é um bounded context próprio de Notificações? é um adapter de infra dentro de Agendamento?), e trade-offs entre usar Evolution API self-hosted vs WhatsApp Business API oficial pra esse caso.

7. **Prós e contras explícitos**: ao final de cada decisão arquitetural, quero uma seção curta de prós/contras — não decisões "vendidas" como certas, quero entender os trade-offs reais pra eu decidir com consciência.

8. **O que eu provavelmente estou superdimensionando**: me avise proativamente se em algum ponto eu (ou você) estiver propondo algo desnecessariamente complexo pra um app de barbearia de baixo volume. Prefiro simples e correto a "enterprise-grade" sem necessidade.

## Formato esperado

Não quero código ainda. Quero:
- Diagrama textual ou descrição clara dos bounded contexts e como se relacionam.
- Lista de entidades/agregados principais por contexto.
- Recomendação de arquitetura geral (monolito modular vs serviços) com justificativa.
- Estrutura de pastas proposta.
- Uma seção final resumindo as decisões e os trade-offs aceitos.

Pode fazer perguntas se precisar de mais contexto antes de propor a arquitetura.
