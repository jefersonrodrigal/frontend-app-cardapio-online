# Cardapio Online — Frontend

Aplicacao Angular para cardapio digital com painel administrativo integrado. Construida com Angular 20 standalone components, Angular Signals e comunicacao via HTTP com o backend ASP.NET Core.

## Visao geral

O frontend cobre dois fluxos principais:

**Cardapio publico (`/`)**
- Exibe dados do estabelecimento (nome, logo, horarios, status aberto/fechado)
- Exibe icones clicaveis de redes sociais no hero (Instagram, Facebook, TikTok, X/Twitter) quando o link estiver preenchido no painel administrativo
- Renderiza secoes de produtos agrupadas por categoria, com paginacao por secao
- Produtos em promocao exibem badge, preco promocional em destaque e preco original riscado
- Ao clicar em um produto que possui grupos de adicionais, abre um modal de personalizacao com selecao de itens por grupo, validacao de obrigatoriedade e total atualizado em tempo real
- Carrinho lateral com fluxo de checkout em duas etapas (itens → dados do cliente)
- Itens no carrinho exibem a lista de adicionais selecionados abaixo do nome
- Exibe subtotal, taxa de entrega (somente quando ha itens e taxa maior que zero) e total final no carrinho
- Itens em promocao no carrinho exibem tag "Promo" e preco original riscado
- Busca de endereco via CEP (ViaCEP)
- Acesso rapido para clientes cadastrados

**Painel administrativo (`/admin`)**
- Protegido por JWT Bearer
- Gerenciamento de categorias (CRUD com slug auto-gerado)
- Gerenciamento de produtos vinculados a categorias com suporte a promocao (desconto em % ou valor absoluto, com sincronizacao automatica entre os dois campos)
- Gerenciamento de grupos de adicionais por produto: criar, editar e excluir grupos; criar, editar, excluir e ativar/desativar itens dentro de cada grupo
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
| `/Products/{id}/additional-groups` | publico | protegido |
| `/Clients/authenticate` | — | publico |
| `/Clients` | protegido | publico |
| `/Orders` | protegido | publico (POST) / protegido (PUT) |
| `/Integrations` | protegido | protegido |

Ao receber `401`, o interceptor faz logout automatico e redireciona para `/login`.

> Os endpoints de additional-groups sao subrecursos de `/Products`, portanto herdam a mesma regra: GET publico, mutacoes protegidas. As URLs no `ApiService` usam `/Products/` (maiusculo) para garantir a correspondencia com a verificacao em `isProtectedApiRequest`.

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

## Grupos de adicionais — fluxo no cardapio publico

Os grupos de adicionais sao retornados diretamente no `ProductDto` (campo `additionalGroups`), sem chamada adicional.

### Abertura do modal

Ao clicar em "Adicionar" num produto que possui `additionalGroups.length > 0`, a home abre um modal de personalizacao em vez de adicionar direto ao carrinho.

O modal exibe:

- foto do produto (thumbnail), nome, descricao e preco base
- para cada grupo: nome, subtitulo com limites (ex: "Ate 2 opcoes (opcional)") e badge de status ("Obrigatorio" laranja / "Pronto" verde / "Opcional" cinza)
- para grupos com `maxSelections = 1`: radio customizado — clicar em qualquer parte da linha seleciona o item
- para grupos com `maxSelections > 1`: stepper com botoes +/−
- total atualizado em tempo real (base + adicionais)
- botao "Adicionar ao carrinho" habilitado apenas quando todos os grupos obrigatorios estiverem satisfeitos

### Signals do modal em `home.ts`

```typescript
productModal: WritableSignal<ProductDto | null>
modalSelections: WritableSignal<Partial<Record<string, number>>>  // itemId → quantidade
baseModalPrice: Signal<number>        // preco efetivo do produto (promocional ou normal)
modalAdditionalsTotal: Signal<number> // soma dos adicionais selecionados
modalTotal: Signal<number>            // baseModalPrice + modalAdditionalsTotal
```

Metodos principais:

```typescript
openProductModal(product)                        // abre o modal
closeProductModal()                              // fecha e limpa selecoes
selectRadioItem(itemId, group)                   // selecao exclusiva (maxSelections = 1)
setModalSelection(itemId, group, delta)          // incrementa/decrementa item (maxSelections > 1)
modalGroupSelectionCount(group): number          // quantos itens selecionados no grupo
isModalGroupValid(group): boolean                // minSelections atendido
canConfirmModal(): boolean                       // todos os grupos validos
confirmProductModal()                            // cria CartItemAdditional[] e chama cartService.add()
```

### CartKey — identificacao unica de item no carrinho

O mesmo produto com adicionais diferentes gera entradas separadas no carrinho. A chave e calculada por `buildCartKey`:

- sem adicionais: `productId`
- com adicionais: `productId|itemId1:qty,itemId2:qty,...` (ids ordenados)

Isso permite que "X-Burger sem adicional" e "X-Burger com Segunda Carne" coexistam no carrinho como itens distintos.

## Grupos de adicionais — gestao no painel administrativo

Ao editar um produto, a secao **Grupos de Adicionais** aparece abaixo do formulario principal. Os grupos e itens sao carregados automaticamente via `GET /api/Products/{id}/additional-groups`.

Operacoes disponiveis:

- **Novo grupo**: define nome, minimo, maximo e ordem
- **Editar grupo**: atualiza qualquer campo do grupo
- **Excluir grupo**: remove grupo e todos os seus itens
- **Novo item**: define nome, preco e ordem dentro de um grupo
- **Editar item**: atualiza nome, preco e ordem
- **Ativar/Desativar item**: alterna `isAvailable` sem excluir o item
- **Excluir item**: remove o item permanentemente

Erros retornados pelo backend (validacoes de grupo, conflitos) sao exibidos inline acima da lista de grupos.

## Painel administrativo — abas

| Aba | Descricao |
|---|---|
| Estabelecimento | Nome, logo (upload), categoria, endereco, WhatsApp, horario, taxa de entrega e links de redes sociais (Instagram, Facebook, TikTok, X/Twitter) |
| Produtos | CRUD de produtos com upload de imagem; categoria selecionada via lista dinamica; suporte a promocao com campos sincronizados; secao de grupos de adicionais ao editar um produto existente |
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

// Grupos de adicionais
getAdditionalGroups(productId): Observable<AdditionalGroupDto[]>
createAdditionalGroup(productId, payload): Observable<AdditionalGroupDto>
updateAdditionalGroup(productId, groupId, payload): Observable<AdditionalGroupDto>
deleteAdditionalGroup(productId, groupId): Observable<void>

// Itens de adicionais
createAdditionalItem(productId, groupId, payload): Observable<AdditionalItemDto>
updateAdditionalItem(productId, groupId, itemId, payload): Observable<AdditionalItemDto>
deleteAdditionalItem(productId, groupId, itemId): Observable<void>

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
interface AdditionalItemDto {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

interface AdditionalGroupDto {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  items: AdditionalItemDto[];
}

interface ProductDto {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;          // slug da categoria
  imageUrl: string;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  stockStatus: string;
  isOnPromotion: boolean;
  promotionalPrice: number | null;
  additionalGroups: AdditionalGroupDto[];
}

interface OrderItemAdditionalDto {
  groupName: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderItemDto {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  additionalsPrice: number;  // soma dos adicionais por unidade
  subtotal: number;          // quantity * (unitPrice + additionalsPrice)
  additionals: OrderItemAdditionalDto[];
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

interface EstablishmentDto {
  name: string;
  logoUrl: string;
  category: string;
  address: string;
  whatsapp: string;
  openTime: string;
  closeTime: string;
  deliveryFee: number;
  sendOrderTrackingViaWhatsApp: boolean;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tikTokUrl?: string | null;
  twitterUrl?: string | null;
}
```

## CartService

`CartService` gerencia o estado do carrinho com Angular Signals.

### Interface CartItem

```typescript
interface CartItemAdditional {
  additionalItemId: string;
  groupName: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartItem {
  cartKey: string;       // chave unica: productId ou productId|itemId:qty,...
  productId: string;
  name: string;
  price: number;         // preco efetivo (promocional ou normal)
  originalPrice: number; // preco original, para exibicao do riscado
  isOnPromotion: boolean;
  additionalsPrice: number; // soma dos adicionais por unidade
  additionals: CartItemAdditional[];
  quantity: number;
  trackInventory: boolean;
  stockQuantity: number;
}
```

### Signals expostos

```typescript
items: Signal<CartItem[]>
deliveryFee: WritableSignal<number>   // setado ao carregar o estabelecimento
total: Signal<number>                 // soma de (price + additionalsPrice) * quantity
grandTotal: Signal<number>            // total + deliveryFee (0 quando carrinho vazio)
count: Signal<number>
```

### Metodos principais

```typescript
add(item: ProductDto, additionals?: CartItemAdditional[]): boolean
incrementByKey(cartKey: string, stockLimit: number, trackInventory: boolean): boolean
remove(cartKey: string): void    // decrementa 1 ou remove se quantity === 1
delete(cartKey: string): void    // remove independentemente da quantidade
clear(): void
```

`grandTotal` so adiciona a taxa de entrega quando ha ao menos um item no carrinho, evitando exibir o valor da taxa no Total quando o carrinho esta vazio.

## Payload de criacao de pedido com adicionais

O checkout envia `additionals` por item quando o cliente selecionou adicionais:

```typescript
interface CreateOrderItemAdditionalPayload {
  additionalItemId: string;
  quantity: number;
}

interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
  additionals?: CreateOrderItemAdditionalPayload[];
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

No modal de personalizacao, o preco base exibido ja e o promocional, com o preco original riscado ao lado.

No carrinho, itens em promocao exibem:

- tag **Promo** ao lado do nome
- preco original riscado abaixo do preco pago

### Impacto no pedido

O `CartService.add()` usa o `promotionalPrice` como preco efetivo quando `isOnPromotion = true`. Esse preco e o valor enviado no payload de criacao do pedido e gravado como `UnitPrice` no `OrderItem`. O preco original fica disponivel apenas no frontend para exibicao.

## Localizacao

`LOCALE_ID` esta configurado para `pt-BR` em `app.config.ts`. Pipes de moeda usam o locale brasileiro:

```html
{{ item.price | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
```


