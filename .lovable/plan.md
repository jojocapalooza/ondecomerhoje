# Proteção do backend contra abuso via APK

## Diagnóstico atual (confirmado no código)

- O endpoint `POST /api/public/rpc` está **totalmente aberto**: CORS `*`, sem autenticação, sem rate limit, sem validação de payload.
- A URL do site (`https://ondecomerhoje.lovable.app`) está **em texto puro** dentro do APK (`mobile-bridge.ts` vira string legível no JS do app).
- A chave do Google Places **já está segura**: fica só no servidor (`process.env.GOOGLE_MAPS_API_KEY`), nunca vai para o APK.
- Risco real hoje: qualquer pessoa que decompilar o APK descobre o endpoint e pode chamá-lo de um script, **gastando sua cota do Google Places** de graça.

## Verdade importante antes de decidir

Não existe forma de esconder 100% uma URL ou segredo dentro de um APK — quem tiver conhecimento técnico suficiente sempre extrai. O objetivo correto é:

1. **Elevar a barreira** — espantar curiosos e scripts copiados (99% dos casos).
2. **Limitar o dano** — mesmo se descobrirem, o abuso fica caro/lento e você é alertado.

## Propostas (em camadas, você escolhe até onde ir)

### Camada 1 — Rate limit e validação (essencial, recomendo sempre)

- Limitar o endpoint RPC por IP: ex. **30 requisições/minuto e 500/dia por IP**, respondendo HTTP 429 acima disso.
- Validar o payload com Zod (nomes de função permitidos, tipos e limites: raio máximo de busca, tamanho da query, coordenadas válidas). Hoje qualquer JSON é encaminhado.
- Erros genéricos para o cliente (sem vazar mensagens internas do Google no corpo da resposta).
- **Custo: zero. Efeito: ninguém consegue varrer o Google Places inteiro pelo seu endpoint.**

### Camada 2 — Assinatura de requisições do app (proteção forte)

- O APK passa a assinar cada chamada com **HMAC + timestamp** usando um segredo embutido no build (ofuscado, ver Camada 3).
- O servidor recusa chamadas sem assinatura válida ou com timestamp fora de uma janela de 5 minutos (bloqueia replay e scripts simples que copiaram só a URL).
- **Honestidade:** quem decompilar a fundo ainda extrai o segredo — mas precisa entender de criptografia e reengenharia, o que elimina a esmagadora maioria dos abusos. Combinado com a Camada 1, o dano possível fica pequeno.

### Camada 3 — Dificultar a descoberta da URL no APK

- Montar a URL da API em runtime a partir de partes codificadas (nunca como string legível no bundle).
- Build mobile com minificação agressiva e **sem sourcemaps** dentro do APK (verificar o pipeline atual).
- Trocar o path `/api/public/rpc` por algo neutro (ex.: `/api/public/gw`). Não é segurança de verdade, só reduz exposição óbvia.

### Camada 4 — Contenção de dano no Google Cloud (você faz no console, 10 min)

- Definir **cota diária máxima** e **alertas de faturamento** na chave do Google Places — se houver abuso, a cota estoura e o gasto para, em vez de virar surpresa na fatura.
- Ativar alerta de uso anômalo.

### Não recomendo (falsa sensação de segurança)

- Restringir CORS: CORS só vale para navegadores; scripts e curl ignoram. Não protege nada aqui.
- Só "esconder a URL": sem rate limit e assinatura, é questão de minutos para achar.

### Próximo nível (futuro, se o app crescer)

- **Google Play Integrity / App Check**: o servidor só responde a instalações genuínas do app. É o padrão da indústria, mas exige publicação/configuração no Google Play e mais complexidade. Deixar para quando houver distribuição na Play Store.

## Resumo do que mudaria no código (apenas se aprovar)

| Item | Onde | Esforço |
|---|---|---|
| Rate limit por IP + 429 | `src/routes/api/public/rpc.ts` | Baixo |
| Validação Zod do payload | `src/routes/api/public/rpc.ts` | Baixo |
| Assinatura HMAC app→servidor | `rpc.ts` + `data-rpc.ts` + segredo no build mobile | Médio |
| Ofuscação da URL + build sem sourcemap | `mobile-bridge.ts` + workflow do APK | Baixo |
| Cota e alertas no Google Cloud | Console do Google (manual, você) | 10 min |

## Minha recomendação

Aplicar **Camadas 1 + 3 agora** (custo zero, resolve o abuso casual) e deixar a **Camada 2** como decisão sua — ela dá a proteção forte, mas adiciona complexidade ao build do APK. A Camada 4 é independente e vale fazer de qualquer jeito.

Me diga quais camadas aprovar que eu aplico sobre o modelo atual, sem mudar nada da arquitetura híbrida.
