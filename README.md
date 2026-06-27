# Cardapio Online — Frontend

Aplicacao Angular para cardapio digital com painel administrativo integrado. Construida com Angular 20 standalone components, Angular Signals e comunicacao via HTTP com o backend ASP.NET Core.

## Visao geral

O frontend cobre dois fluxos principais:

**Cardapio publico (`/`)**
- Exibe dados do estabelecimento (nome, logo, horarios, status aberto/fechado)
- Renderiza secoes de produtos agrupadas por categoria, com paginacao por secao
- Produtos em promocao exibem badge, preco promocional em destaque e preco original riscado
- Carrinho lateral com fluxo de checkout em duas etapas (itens → dados do cliente)
- Exibe subtotal, taxa de entrega (somente quando ha itens e taxa maior que zero) e total final no carrinho
- Itens em promocao no carrinho exibem tag "Promo" e preco original riscado
- Busca de endereco via CEP (ViaCEP)
- Acesso rapido para clientes cadastrados

**Painel administrativo (`/admin`)**
- Protegido por JWT Bearer
- Gerenciamento de categorias (CRUD com slug auto-gerado)
- Gerenciamento de produtos vinculados a categorias com suporte a promocao (desconto em % ou valor absoluto, com sincronizacao automatica entre os dois campos)
- Visualizacao de clientes cadastrados
- Acompanhamento e avanco de status de pedidos com badge do tipo (Entrega / Retirada / Consumo local) e taxa de entrega destacada nos cards
- Configuracoes do estabelecimento com upload de logo e campo de taxa de entrega
- Registro interno de pedidos com calculo automatico da taxa quando o tipo e Entrega
- Configuracao de integracoes externas (iFood, Anotai, Uber Eats, 99Food, AI Agents, WhatsApp, Take Blip, Zenvia)

## Stack tecnica

- Angular `20`
- TypeScript
- Angular Signals (`signal`, `computed`, `effect`)
- `HttpClient` com interceptor funcional (`withInterceptors`)
- `FormsModule` com `[(ngModel)]`
- SCSS / CSS puro por componente
- `CurrencyPipe` localizado em `pt-BR`

## Estrutura do projeto

```text
src/
├─ app/
│  ├─ core/
│  │  ├─ api.config.ts        # URL base, isApiRequest, isProtectedApiRequest
│  │  ├─ api.models.ts        # Interfaces TypeScript para todos os DTOs
│  │  ├─ api.service.ts       # Servico HTTP centralizado
│  │  ├─ auth.interceptor.ts  # Interceptor que injeta Bearer token
│  │  ├─ auth.service.ts      # Gerenciamento do token JWT do admin
│  │  ├─ cart.service.ts      # Estado do carrinho com Signals
│  │  └─ client-auth.service.ts # Sessao do cliente em localStorage
│  ├─ pages/
│  │  ├─ admin/               # Painel administrativo
│  │  │  ├─ admin.ts
│  │  │  ├─ admin.html
│  │  │  └─ admin.css
│  │  ├─ home/                # Cardapio publico
│  │  │  ├─ home.ts
│  │  │  ├─ home.html
│  │  │  └─ home.css
│  │  ├─ login/               # Login do administrador
│  │  ├─ client-access/       # Acesso do cliente
│  │  └─ register/            # Cadastro do cliente
│  ├─ app.config.ts           # Providers globais e registro do interceptor
│  ├─ app.routes.ts           # Rotas lazy-loaded
│  └─ app.ts
├─ environments/
│  ├─ environment.ts
│  └─ environment.prod.ts
└─ assets/
```

## Requisitos

- Node.js `>=20`
- Angular CLI `>=20`
- Backend rodando em `http://localhost:5115` (ou conforme `environment.ts`)

## Como executar localmente

```bash
npm install
ng serve
```

A aplicacao abre em `http://localhost:4200`.

Para build de producao:

```bash
ng build
```

Os artefatos ficam em `dist/`.

## Configuracao de ambiente

`src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5115/api'
};
```

Para producao, altere `environment.prod.ts` com a URL do backend em producao.

## Autenticacao e seguranca

### Admin

O token JWT e armazenado em `localStorage` via `AuthService`. O interceptor `authInterceptor` injeta automaticamente `Authorization: Bearer <token>` nas requisicoes protegidas, determinadas por `isProtectedApiRequest()` em `api.config.ts`.

Regras de protecao por rota:

| Path | GET | POST/PUT/DELETE |
|---|---|---|
| `/Uploads` | protegido | protegido |
| `/Estabelecimento` | publico | protegido |
| `/Categories` | publico | protegido |
| `/Products` | publico | protegido |
| `/Clients/authenticate` | — | publico |
| `/Clients` | protegido | publico |
| `/Orders` | protegido | publico (POST) / protegido (PUT) |
| `/Integrations` | protegido | protegido |

Ao receber `401`, o interceptor faz logout automatico e redireciona para `/login`.

### Clientes

A sessao do cliente e armazenada em `localStorage` via `ClientAuthService`. Nao usa JWT; o backend retorna um `ClientDto` que e salvo diretamente.

## Gerenciamento de categorias

Categorias sao entidades dinamicas. O painel administrativo oferece uma aba "Categorias" com:

- listagem de todas as categorias ativas ordenadas por `SortOrder`
- formulario para criar nova categoria (nome e ordem de exibicao)
- edicao de nome e ordem de categorias existentes
- exclusao com feedback de erro quando ha produtos ativos vinculados

O `slug` e gerado automaticamente pelo backend no momento da criacao e exibido apenas para referencia no painel.

No cardapio publico, a home carrega as categorias e agrupa os produtos dinamicamente, renderizando uma secao por categoria que tenha produtos — na ordem definida pelo `SortOrder`.

## Cardapio publico — secoes dinamicas

A home carrega em paralelo `GET /api/Categories` e `GET /api/Products`. O `computed` `categorySections` faz o agrupamento:

```
categorias (ordenadas por SortOrder)
  → filtra as que tem ao menos um produto
  → cada secao exibe produtos paginados independentemente
```

A paginacao de cada secao e independente e armazenada em `Record<string, number>` por slug de categoria.

## Painel administrativo — abas

| Aba | Descricao |
|---|---|
| Estabelecimento | Nome, logo (upload), categoria, endereco, WhatsApp, horario e taxa de entrega |
| Produtos | CRUD de produtos com upload de imagem; categoria selecionada via lista dinamica; suporte a promocao com campos sincronizados de desconto percentual e preco promocional |
| Categorias | CRUD de categorias; slug auto-gerado e imutavel |
| Clientes | Listagem somente leitura |
| Pedidos | Acompanhamento com avanco de status e cancelamento; filtro por data; badge de tipo do pedido e taxa de entrega exibida nos cards |
| Integracoes | Formularios por plataforma com toggle de ativacao e campos especificos |

## Servico HTTP

`ApiService` centraliza todas as chamadas HTTP. Metodos disponiveis:

```typescript
// Estabelecimento
getEstablishment(): Observable<EstablishmentDto>
saveEstablishment(payload): Observable<EstablishmentDto>

// Categorias
getCategories(): Observable<CategoryDto[]>
createCategory(payload): Observable<CategoryDto>
updateCategory(id, payload): Observable<CategoryDto>
deleteCategory(id): Observable<void>

// Produtos
getProducts(page, pageSize, category?): Observable<PaginatedResult<ProductDto>>
createProduct(payload): Observable<ProductDto>
updateProduct(id, payload): Observable<ProductDto>
deleteProduct(id): Observable<void>

// Clientes
getClients(page, pageSize, search?): Observable<PaginatedResult<ClientDto>>
createClient(payload): Observable<ClientDto>
authenticateClient(payload): Observable<ClientDto>

// Pedidos
getOrders(page, pageSize, date?): Observable<PaginatedResult<OrderDto>>
advanceOrderStatus(id): Observable<OrderDto>
cancelOrder(id): Observable<OrderDto>
createOrder(payload): Observable<OrderDto>

// Upload
uploadImage(file): Observable<UploadResponse>

// Integracoes
getIntegrations(): Observable<IntegrationsOverviewDto>
saveIFoodIntegration(payload): Observable<IFoodIntegrationDto>
// ... demais providers
```

## Modelos TypeScript

Todos os DTOs ficam em `src/app/core/api.models.ts`. Interfaces principais:

```typescript
interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

interface ProductDto {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;  // slug da categoria
  imageUrl: string;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  stockStatus: string;
  isOnPromotion: boolean;
  promotionalPrice: number | null;
}

interface EstablishmentDto {
  name: string;
  logoUrl: string;
  category: string;
  address: string;
  whatsapp: string;
  openTime: string;
  closeTime: string;
  deliveryFee: number;  // taxa de entrega em reais; 0 = sem taxa
}

interface OrderDto {
  id: string;
  number: string;
  clientName: string;
  clientPhone: string;
  address: string;
  total: number;        // ja inclui a taxa de entrega
  deliveryFee: number;  // snapshot da taxa no momento da criacao
  status: string;
  date: string;
  createdAt: string;
  source: string;
  orderType: string | null;  // 'Entrega' | 'Retirada' | 'ConsumoLocal' | null
  note: string | null;
  items: OrderItemDto[];
}
```

## Taxa de entrega

### Como funciona

A taxa de entrega e configurada pelo administrador na aba **Estabelecimento** do painel. O valor e persistido no banco e retornado pela API em `GET /api/Estabelecimento`.

### Fluxo no cardapio publico

1. A home carrega os dados do estabelecimento e seta `CartService.deliveryFee` com o valor recebido.
2. O carrinho exibe a linha **Taxa de entrega** apenas quando ha itens no carrinho e a taxa e maior que zero.
3. O **Total** (grandTotal) tambem so inclui a taxa quando ha itens; carrinho vazio exibe Total R$0,00.
4. Ao finalizar o pedido, o payload envia `orderType: 'Entrega'`; o backend busca a taxa atual do estabelecimento, aplica ao pedido e grava o snapshot em `Order.DeliveryFee`.

### Fluxo no painel administrativo

O registro interno de pedidos recalcula o total conforme o tipo selecionado:

- **Entrega**: subtotal dos itens + `estForm.deliveryFee`
- **Retirada** e **Consumo local**: apenas subtotal dos itens

O total exibido no formulario interno ja reflete a taxa antes de salvar. Nos cards de pedidos existentes, quando `order.deliveryFee > 0`, uma linha informativa mostra o valor da taxa separado do total.

## Promocao de produtos

### Configuracao no painel administrativo

Na aba **Produtos**, ao criar ou editar um produto, e possivel habilitar a promocao com o toggle **Produto em promocao**. Ao ativar:

- aparece o campo **Desconto (%)** e o campo **Preco promocional (R$)**
- os dois campos sao sincronizados em tempo real: preencher um calcula o outro automaticamente
- apenas o `promotionalPrice` e enviado ao backend; o percentual e calculado localmente
- ao editar um produto ja em promocao, o percentual e preenchido automaticamente

Regras de validacao aplicadas pelo backend:

- `promotionalPrice` e obrigatorio quando `isOnPromotion = true`
- `promotionalPrice` deve ser maior que zero e menor que `price`

### Exibicao no cardapio publico

Produtos em promocao exibem:

- badge **Promocao** sobre a imagem do card
- preco promocional em destaque (vermelho)
- preco original riscado abaixo

No carrinho, itens em promocao exibem:

- tag **Promo** ao lado do nome
- preco original riscado abaixo do preco pago

### Impacto no pedido

O `CartService.add()` usa o `promotionalPrice` como preco efetivo quando `isOnPromotion = true`. Esse preco e o valor enviado no payload de criacao do pedido e gravado como `UnitPrice` no `OrderItem`. O preco original fica disponivel apenas no frontend para exibicao.

### CartService — signals expostos

```typescript
items: Signal<CartItem[]>
deliveryFee: WritableSignal<number>   // setado ao carregar o estabelecimento
total: Signal<number>                 // soma dos itens (sem taxa)
grandTotal: Signal<number>            // total + deliveryFee (0 quando carrinho vazio)
count: Signal<number>
```

`CartItem` inclui os campos:

```typescript
interface CartItem {
  id: string;
  name: string;
  price: number;         // preco efetivo (promocional ou normal)
  originalPrice: number; // preco original, para exibicao do riscado
  isOnPromotion: boolean;
  quantity: number;
  trackInventory: boolean;
  stockQuantity: number;
}
```

`grandTotal` so adiciona a taxa de entrega quando ha ao menos um item no carrinho, evitando exibir o valor da taxa no Total quando o carrinho esta vazio.

## Localizacao

`LOCALE_ID` esta configurado para `pt-BR` em `app.config.ts`. Pipes de moeda usam o locale brasileiro:

```html
{{ item.price | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
```

## Pontos de atencao

- a URL do backend esta hardcoded em `environment.ts`; em producao, atualizar `environment.prod.ts`
- o `isProtectedApiRequest` em `api.config.ts` e a fonte de verdade sobre quais rotas levam token; qualquer novo endpoint protegido precisa ser registrado la
- o admin carrega todas as entidades no construtor (products 1000, clients 1000, orders 1000) para paginacao local; em bases grandes, considerar paginacao server-side

## Sugestoes de proximos passos

- adicionar testes unitarios para `ApiService`, `CartService` e computed signals criticos
- implementar paginacao server-side no admin para grandes volumes
- adicionar feedback visual (skeleton loaders) durante carregamento inicial do cardapio
- proteger a rota `/admin` com um `AuthGuard` baseado em `AuthService`
