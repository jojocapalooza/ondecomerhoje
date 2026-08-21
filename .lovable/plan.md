# Plano: APK 100% independente e sem custos de API para o dono

## Objetivo
Tornar o aplicativo Android (APK) totalmente independente do backend `ondecomerhoje.lovable.app` para consultas de restaurantes. Todos os dados virão de APIs públicas e gratuitas chamadas diretamente do aparelho do usuário, usando a internet e o GPS dele. O dono do projeto não paga por requisições de API de terceiros.

## Arquitetura atual
- O APK embute HTML/CSS/JS localmente.
- As buscas de restaurantes, fotos e detalhes passam pelo endpoint `/api/public/rpc` do site publicado.
- A chave da API do Google Places fica no servidor (segura), mas cada busca gera custo/tráfego no backend do projeto.

## Arquitetura proposta
- O APK passa a chamar diretamente APIs gratuitas do lado do cliente:
  - **Overpass API** (OpenStreetMap) para buscar restaurantes por localização e texto.
  - **Nominatim** (OpenStreetMap) para geocodificação reversa e endereços.
  - **Google Maps / Waze intents** para abrir rotas no app do usuário, sem custo de API.
- Fotos reais do Google são substituídas por ilustrações de categoria (já existem no projeto) e, no futuro, por fotos de usuários.
- O site web pode continuar usando Google Places via backend, ou migrar junto para a mesma fonte gratuita.

## O que será feito

### 1. Criar camada de dados gratuita no cliente
- Novo arquivo `src/lib/osm-places.ts` com funções puramente client-side:
  - `searchOsmRestaurants(lat, lon, radius, cuisine?)` usando Overpass API.
  - `reverseGeocodeOsm(lat, lon)` usando Nominatim.
  - `geocodeAddressOsm(address)` usando Nominatim.
  - `osmToRestaurant(node/way)` para normalizar os dados no formato `NearbyRestaurant` já usado pela UI.
- Respeitar os limites de uso das APIs gratuitas:
  - Nominatim: 1 requisição por segundo, user-agent identificando o app.
  - Overpass: evitar consultas muito amplas, usar timeout e bounding box razoável.

### 2. Adaptar a ponte mobile
- Em `src/lib/mobile-bridge.ts`, adicionar modo "standalone" para o APK:
  - Quando ativo, as funções de dados não reescrevem para `/api/public/rpc`.
  - Em vez disso, `src/lib/data-rpc.ts` passa a usar as funções OSM diretamente no APK.
- No navegador/site, continuar usando server functions normalmente.

### 3. Substituir fotos do Google por fallbacks de categoria
- Ajustar `RestaurantCard` e telas de detalhes para:
  - Tentar foto real vinda do OSM (`photo` tag, Wikimedia Commons) quando disponível.
  - Caso contrário, usar ilustração de categoria já existente.
- Remover dependência de `photoUri` do Google no fluxo principal do APK.

### 4. Ajustar busca textual e filtros
- Mapear categorias do app (Vegan, Pet-friendly, Brunch, Rodízio etc.) para tags e palavras-chave do OpenStreetMap.
- Implementar busca por pratos específicos usando tags de culinária + palavras-chave no nome/descrição.
- Reforçar filtro anti-não-restaurante (remover fábricas, hotéis, boates etc.) usando tags OSM.

### 5. Melhorar lógica de proximidade e Trends
- Manter geolocalização nativa do aparelho.
- Ordenar resultados por distância e nota, com raio configurável.
- Na tela Trends, usar Overpass para buscar cidades próximas e restaurantes em cada uma, tudo do lado do cliente.

### 6. Abrir rotas no app do usuário
- Substituir links de "Abrir no Google Maps" por intents nativos que abrem o Google Maps/Waze instalado no celular.
- Isso não consome API key e usa os dados/offline do app do usuário.

### 7. Cache local
- Salvar últimos resultados de busca e detalhes no `localStorage` do WebView para reabrir rápido.
- Favoritos continuam no dispositivo.

### 8. Remover ou tornar opcional o endpoint `/api/public/rpc`
- Se o site web continuar usando Google Places, manter o endpoint apenas para web.
- No APK, desativar a ponte para o endpoint, eliminando tráfego no domínio publicado.

## Impactos esperados
| Aspecto | Antes | Depois |
|---|---|---|
| Custo de API Google | No servidor do projeto | Zero para o dono |
| Dados do usuário | Pago pelo projeto | Pago pelo usuário com seu plano de internet |
| Segurança da API Key | Boa (no servidor) | Excelente (não há chave no APK) |
| Riqueza dos dados | Alta (Google Places) | Média (OSM), suficiente para nome, endereço, tipo e coordenadas |
| Fotos | Reais do Google | Ilustrações de categoria + Wikimedia quando disponível |
| Dependência do site | Sim, para dados | Apenas para atualizações do app |
| Funciona sem internet | Não | Parcialmente, com cache local |

## Riscos e mitigações
- **Qualidade dos dados OSM**: em regiões pouco mapeadas pode trazer menos resultados. Mitigação: ampliar raio e usar múltiplas fontes de tags.
- **Rate limits**: Nominatim e Overpass têm limites. Mitigação: cache, debounce e user-agent correto.
- **Fotos**: perda de fotos reais. Mitigação: ilustrações de categoria e futura opção de upload por usuários.

## Entregáveis
1. `src/lib/osm-places.ts` — nova camada de dados gratuita.
2. `src/lib/mobile-bridge.ts` — modo standalone para APK.
3. Ajustes em `src/lib/data-rpc.ts` para usar OSM no APK.
4. Ajustes nos componentes de card e detalhes para fotos de categoria.
5. Atualização da tela Trends para usar OSM.
6. Novo workflow de build Android sem dependência de `VITE_MOBILE_API_BASE`.
7. Documento `APK-INDEPENDENTE.md` explicando a nova arquitetura e como gerar o APK.

## Próximos passos
Aprovar este plano para começar a implementação da camada OSM e da ponte standalone.
