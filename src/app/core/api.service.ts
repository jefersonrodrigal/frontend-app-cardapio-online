import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ClientLoginPayload,
  ClientDto,
  CreateClientPayload,
  CreateOrderPayload,
  EstablishmentDto,
  LoginRequest,
  LoginResponse,
  OrderDto,
  PaginatedResult,
  ProductDto,
  ProductPayload,
  UploadResponse,
  ViaCepAddressResponse,
} from './api.models';
import { apiBaseUrl } from './api.config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
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

  getClients(page: number, pageSize: number, search?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PaginatedResult<ClientDto>>(`${this.baseUrl}/Clients`, { params });
  }

  createClient(payload: CreateClientPayload) {
    return this.http.post<ClientDto>(`${this.baseUrl}/Clients`, payload);
  }

  authenticateClient(payload: ClientLoginPayload) {
    return this.http.post<ClientDto>(`${this.baseUrl}/Clients/authenticate`, payload);
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
}
