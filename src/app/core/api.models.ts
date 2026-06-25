export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface EstablishmentDto {
  name: string;
  logoUrl: string;
  category: string;
  address: string;
  whatsapp: string;
  openTime: string;
  closeTime: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
}

export interface ClientDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  fullAddress: string;
  registeredAt: string;
  ordersCount: number;
  totalSpent: number;
}

export interface CreateClientPayload {
  name: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  password: string;
}

export interface ViaCepAddressResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface ClientLoginPayload {
  email: string;
  password: string;
}

export interface OrderItemDto {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderDto {
  id: string;
  number: string;
  clientName: string;
  clientPhone: string;
  address: string;
  total: number;
  status: string;
  date: string;
  createdAt: string;
  source: string;
  note: string | null;
  items: OrderItemDto[];
}

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  email: string;
}

export interface UploadResponse {
  url: string;
}

export interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  clientName: string;
  clientPhone: string;
  address: string;
  source: string;
  items: CreateOrderItemPayload[];
  note?: string | null;
}

export interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface CategoryPayload {
  name: string;
  sortOrder: number;
}

export interface IFoodIntegrationDto {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  merchantId: string;
}

export interface AnotaiIntegrationDto {
  enabled: boolean;
  apiToken: string;
  accountId: string;
  webhookUrl: string;
}

export interface UberEatsIntegrationDto {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  storeId: string;
  webhookSigningSecret: string;
}

export interface NinetyNineFoodIntegrationDto {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  storeId: string;
  webhookUrl: string;
}

export interface AiAgentsIntegrationDto {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
  assistantId: string;
  webhookUrl: string;
}

export interface WhatsAppIntegrationDto {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
}

export interface TakeBlipIntegrationDto {
  enabled: boolean;
  botShortName: string;
  authorizationKey: string;
  webhookUrl: string;
}

export interface ZenviaIntegrationDto {
  enabled: boolean;
  apiToken: string;
  channelId: string;
  webhookUrl: string;
}

export interface IntegrationsOverviewDto {
  iFood: IFoodIntegrationDto;
  anotai: AnotaiIntegrationDto;
  uberEats: UberEatsIntegrationDto;
  ninetyNineFood: NinetyNineFoodIntegrationDto;
  aiAgents: AiAgentsIntegrationDto;
  whatsApp: WhatsAppIntegrationDto;
  takeBlip: TakeBlipIntegrationDto;
  zenvia: ZenviaIntegrationDto;
}
