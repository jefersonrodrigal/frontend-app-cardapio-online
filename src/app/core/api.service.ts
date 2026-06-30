import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdditionalGroupDto,
  AdditionalGroupPayload,
  AdditionalItemDto,
  AdditionalItemPayload,
  AiAgentsIntegrationDto,
  AnotaiIntegrationDto,
  CategoryDto,
  CategoryPayload,
  ClientAuthResponse,
  ClientLoginPayload,
  ClientDto,
  CreateClientPayload,
  CreateOrderPayload,
  EstablishmentDto,
  IFoodIntegrationDto,
  IntegrationsOverviewDto,
  InventoryMovementDto,
  InventoryMovementPayload,
  InventoryProductDto,
  LoginRequest,
  LoginResponse,
  NinetyNineFoodIntegrationDto,
  OrderDto,
  OrderTrackingDto,
  PaginatedResult,
  ProductDto,
  ProductPayload,
  TakeBlipIntegrationDto,
  UberEatsIntegrationDto,
  UploadResponse,
  ViaCepAddressResponse,
  WhatsAppIntegrationDto,
  ZenviaIntegrationDto,
} from './api.models';
import { apiBaseUrl } from './api.config';
import { ClientAuthService } from './client-auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly clientAuth = inject(ClientAuthService);
  private readonly baseUrl = apiBaseUrl;

  getEstablishment() {
    return this.http.get<EstablishmentDto>(`${this.baseUrl}/Estabelecimento`);
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/Auth/login`, payload);
  }

  saveEstablishment(payload: EstablishmentDto) {
    return this.http.put<EstablishmentDto>(`${this.baseUrl}/Estabelecimento`, payload);
  }

  getProducts(page: number, pageSize: number, category?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (category) {
      params = params.set('category', category);
    }

    return this.http.get<PaginatedResult<ProductDto>>(`${this.baseUrl}/Products`, { params });
  }

  createProduct(payload: ProductPayload) {
    return this.http.post<ProductDto>(`${this.baseUrl}/Products`, payload);
  }

  updateProduct(id: string, payload: ProductPayload) {
    return this.http.put<ProductDto>(`${this.baseUrl}/Products/${id}`, payload);
  }

  deleteProduct(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/Products/${id}`);
  }

  getInventory(page: number, pageSize: number, status?: string, search?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (status) {
      params = params.set('status', status);
    }

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PaginatedResult<InventoryProductDto>>(`${this.baseUrl}/Inventory`, { params });
  }

  getInventoryMovements(productId?: string, page = 1, pageSize = 20) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (productId) {
      params = params.set('productId', productId);
    }

    return this.http.get<PaginatedResult<InventoryMovementDto>>(`${this.baseUrl}/Inventory/movements`, { params });
  }

  createInventoryMovement(payload: InventoryMovementPayload) {
    return this.http.post<InventoryProductDto>(`${this.baseUrl}/Inventory/movements`, payload);
  }

  getClients(page: number, pageSize: number, search?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PaginatedResult<ClientDto>>(`${this.baseUrl}/Clients`, { params });
  }

  createClient(payload: CreateClientPayload) {
    return this.http.post<ClientAuthResponse>(`${this.baseUrl}/Clients`, payload);
  }

  authenticateClient(payload: ClientLoginPayload) {
    return this.http.post<ClientAuthResponse>(`${this.baseUrl}/Clients/authenticate`, payload);
  }

  lookupAddressByCep(cep: string) {
    return this.http.get<ViaCepAddressResponse>(`https://viacep.com.br/ws/${cep}/json/`);
  }

  getOrders(page: number, pageSize: number, date?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<PaginatedResult<OrderDto>>(`${this.baseUrl}/Orders`, { params });
  }

  getClientOrders(page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    const token = this.clientAuth.token();
    const options = token
      ? { params, headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : { params };

    return this.http.get<PaginatedResult<OrderDto>>(`${this.baseUrl}/Orders/client`, options);
  }

  getOrderTracking(id: string) {
    return this.http.get<OrderTrackingDto>(`${this.baseUrl}/Orders/track/${id}`);
  }

  advanceOrderStatus(id: string) {
    return this.http.put<OrderDto>(`${this.baseUrl}/Orders/${id}/advance`, {});
  }

  cancelOrder(id: string) {
    return this.http.put<OrderDto>(`${this.baseUrl}/Orders/${id}/cancel`, {});
  }

  createOrder(payload: CreateOrderPayload) {
    return this.http.post<OrderDto>(`${this.baseUrl}/Orders`, payload);
  }

  uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.baseUrl}/Uploads/image`, formData);
  }

  getCategories() {
    return this.http.get<CategoryDto[]>(`${this.baseUrl}/Categories`);
  }

  createCategory(payload: CategoryPayload) {
    return this.http.post<CategoryDto>(`${this.baseUrl}/Categories`, payload);
  }

  updateCategory(id: number, payload: CategoryPayload) {
    return this.http.put<CategoryDto>(`${this.baseUrl}/Categories/${id}`, payload);
  }

  deleteCategory(id: number) {
    return this.http.delete<void>(`${this.baseUrl}/Categories/${id}`);
  }

  getAdditionalGroups(productId: string) {
    return this.http.get<AdditionalGroupDto[]>(`${this.baseUrl}/Products/${productId}/additional-groups`);
  }

  createAdditionalGroup(productId: string, payload: AdditionalGroupPayload) {
    return this.http.post<AdditionalGroupDto>(`${this.baseUrl}/Products/${productId}/additional-groups`, payload);
  }

  updateAdditionalGroup(productId: string, groupId: string, payload: AdditionalGroupPayload) {
    return this.http.put<AdditionalGroupDto>(`${this.baseUrl}/Products/${productId}/additional-groups/${groupId}`, payload);
  }

  deleteAdditionalGroup(productId: string, groupId: string) {
    return this.http.delete<void>(`${this.baseUrl}/Products/${productId}/additional-groups/${groupId}`);
  }

  createAdditionalItem(productId: string, groupId: string, payload: Omit<AdditionalItemPayload, 'isAvailable'> & { sortOrder?: number }) {
    return this.http.post<AdditionalItemDto>(`${this.baseUrl}/Products/${productId}/additional-groups/${groupId}/items`, payload);
  }

  updateAdditionalItem(productId: string, groupId: string, itemId: string, payload: AdditionalItemPayload) {
    return this.http.put<AdditionalItemDto>(`${this.baseUrl}/Products/${productId}/additional-groups/${groupId}/items/${itemId}`, payload);
  }

  deleteAdditionalItem(productId: string, groupId: string, itemId: string) {
    return this.http.delete<void>(`${this.baseUrl}/Products/${productId}/additional-groups/${groupId}/items/${itemId}`);
  }

  getIntegrations() {
    return this.http.get<IntegrationsOverviewDto>(`${this.baseUrl}/Integrations`);
  }

  saveIFoodIntegration(payload: IFoodIntegrationDto) {
    return this.http.put<IFoodIntegrationDto>(`${this.baseUrl}/Integrations/ifood`, payload);
  }

  saveAnotaiIntegration(payload: AnotaiIntegrationDto) {
    return this.http.put<AnotaiIntegrationDto>(`${this.baseUrl}/Integrations/anotai`, payload);
  }

  saveUberEatsIntegration(payload: UberEatsIntegrationDto) {
    return this.http.put<UberEatsIntegrationDto>(`${this.baseUrl}/Integrations/ubereats`, payload);
  }

  saveNinetyNineFoodIntegration(payload: NinetyNineFoodIntegrationDto) {
    return this.http.put<NinetyNineFoodIntegrationDto>(`${this.baseUrl}/Integrations/99food`, payload);
  }

  saveAiAgentsIntegration(payload: AiAgentsIntegrationDto) {
    return this.http.put<AiAgentsIntegrationDto>(`${this.baseUrl}/Integrations/aiagents`, payload);
  }

  saveWhatsAppIntegration(payload: WhatsAppIntegrationDto) {
    return this.http.put<WhatsAppIntegrationDto>(`${this.baseUrl}/Integrations/whatsapp`, payload);
  }

  saveTakeBlipIntegration(payload: TakeBlipIntegrationDto) {
    return this.http.put<TakeBlipIntegrationDto>(`${this.baseUrl}/Integrations/takeblip`, payload);
  }

  saveZenviaIntegration(payload: ZenviaIntegrationDto) {
    return this.http.put<ZenviaIntegrationDto>(`${this.baseUrl}/Integrations/zenvia`, payload);
  }
}
