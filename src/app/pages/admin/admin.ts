import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  ClientDto,
  EstablishmentDto,
  InventoryMovementDto,
  InventoryMovementPayload,
  InventoryProductDto,
  OrderDto,
  ProductDto,
  ProductPayload,
} from '../../core/api.models';

type Tab = 'estabelecimento' | 'produtos' | 'estoque' | 'clientes' | 'pedidos' | 'integracoes';
type IntegrationMenu = 'ifood' | 'anotai' | 'ubereats' | '99food' | 'aiagents' | 'whatsapp';
type OrderStatus = 'pendente' | 'em_preparo' | 'em_entrega' | 'entregue' | 'cancelado';
type OrderSource = 'whatsapp' | 'ifood' | 'site';
type InventoryFilter = 'all' | 'low' | 'out' | 'untracked';
type InventoryMovementType = 'entrada' | 'perda' | 'ajuste';

interface Product extends ProductDto {
  image: string;
}

interface Client extends ClientDto {}

const PRODUCTS_PER_PAGE = 5;
const INVENTORY_PER_PAGE = 8;
const CLIENTS_PER_PAGE = 5;
const ORDERS_PER_PAGE = 5;

@Component({
  selector: 'app-admin',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly activeTab = signal<Tab>('estabelecimento');
  protected readonly activeIntegrationMenu = signal<IntegrationMenu>('ifood');
  protected readonly showProductForm = signal(false);
  protected readonly editingProductId = signal<string | null>(null);
  protected readonly editingProductName = signal<string | null>(null);
  protected readonly estSaved = signal(false);
  protected readonly prodSaved = signal(false);
  protected readonly inventorySaved = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isLoadingEstablishment = signal(false);
  protected readonly isLoadingProducts = signal(false);
  protected readonly isLoadingInventory = signal(false);
  protected readonly isLoadingInventoryMovements = signal(false);
  protected readonly isLoadingClients = signal(false);
  protected readonly isLoadingOrders = signal(false);

  protected readonly productsPage = signal(1);
  protected readonly inventoryPage = signal(1);
  protected readonly clientsPage = signal(1);
  protected readonly ordersPage = signal(1);
  protected readonly inventoryFilter = signal<InventoryFilter>('all');
  protected readonly showInventoryMovementForm = signal(false);
  protected readonly selectedInventoryProductName = signal<string | null>(null);

  protected readonly products = signal<Product[]>([]);
  protected readonly inventoryProducts = signal<InventoryProductDto[]>([]);
  protected readonly inventoryMovements = signal<InventoryMovementDto[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly orders = signal<OrderDto[]>([]);

  protected readonly totalProductPages = computed(() =>
    Math.max(1, Math.ceil(this.products().length / PRODUCTS_PER_PAGE)),
  );
  protected readonly paginatedProducts = computed(() => {
    const page = this.productsPage();
    return this.products().slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);
  });
  protected readonly productPageNumbers = computed(() =>
    Array.from({ length: this.totalProductPages() }, (_, i) => i + 1),
  );
  protected readonly productsRange = computed(() => {
    const total = this.products().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.productsPage();
    return {
      start: (page - 1) * PRODUCTS_PER_PAGE + 1,
      end: Math.min(page * PRODUCTS_PER_PAGE, total),
      total,
    };
  });

  protected readonly filteredInventoryProducts = computed(() => {
    const filter = this.inventoryFilter();
    const products = this.inventoryProducts();

    if (filter === 'low') {
      return products.filter((product) => product.stockStatus === 'low');
    }

    if (filter === 'out') {
      return products.filter((product) => product.stockStatus === 'out');
    }

    if (filter === 'untracked') {
      return products.filter((product) => product.stockStatus === 'untracked');
    }

    return products;
  });
  protected readonly trackedInventoryCount = computed(() =>
    this.inventoryProducts().filter((product) => product.trackInventory).length,
  );
  protected readonly lowInventoryCount = computed(() =>
    this.inventoryProducts().filter((product) => product.stockStatus === 'low').length,
  );
  protected readonly outInventoryCount = computed(() =>
    this.inventoryProducts().filter((product) => product.stockStatus === 'out').length,
  );
  protected readonly totalInventoryPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredInventoryProducts().length / INVENTORY_PER_PAGE)),
  );
  protected readonly paginatedInventoryProducts = computed(() => {
    const page = this.inventoryPage();
    return this.filteredInventoryProducts().slice((page - 1) * INVENTORY_PER_PAGE, page * INVENTORY_PER_PAGE);
  });
  protected readonly inventoryPageNumbers = computed(() =>
    Array.from({ length: this.totalInventoryPages() }, (_, i) => i + 1),
  );
  protected readonly inventoryRange = computed(() => {
    const total = this.filteredInventoryProducts().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.inventoryPage();
    return {
      start: (page - 1) * INVENTORY_PER_PAGE + 1,
      end: Math.min(page * INVENTORY_PER_PAGE, total),
      total,
    };
  });

  protected readonly totalClientPages = computed(() =>
    Math.max(1, Math.ceil(this.clients().length / CLIENTS_PER_PAGE)),
  );
  protected readonly paginatedClients = computed(() => {
    const page = this.clientsPage();
    return this.clients().slice((page - 1) * CLIENTS_PER_PAGE, page * CLIENTS_PER_PAGE);
  });
  protected readonly clientPageNumbers = computed(() =>
    Array.from({ length: this.totalClientPages() }, (_, i) => i + 1),
  );
  protected readonly clientsRange = computed(() => {
    const total = this.clients().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.clientsPage();
    return {
      start: (page - 1) * CLIENTS_PER_PAGE + 1,
      end: Math.min(page * CLIENTS_PER_PAGE, total),
      total,
    };
  });

  protected readonly filterDate = signal('');
  protected filterDateValue = '';
  protected readonly filteredOrders = computed(() => {
    return this.orders();
  });
  protected readonly totalOrderPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredOrders().length / ORDERS_PER_PAGE)),
  );
  protected readonly paginatedOrders = computed(() => {
    const page = this.ordersPage();
    return this.filteredOrders().slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);
  });
  protected readonly orderPageNumbers = computed(() =>
    Array.from({ length: this.totalOrderPages() }, (_, i) => i + 1),
  );
  protected readonly ordersRange = computed(() => {
    const total = this.filteredOrders().length;
    if (total === 0) return { start: 0, end: 0, total: 0 };
    const page = this.ordersPage();
    return {
      start: (page - 1) * ORDERS_PER_PAGE + 1,
      end: Math.min(page * ORDERS_PER_PAGE, total),
      total,
    };
  });
  protected readonly pendingOrdersCount = computed(() =>
    this.filteredOrders().filter((order) => this.normalizeStatus(order.status) === 'pendente').length,
  );
  protected readonly activeOrdersCount = computed(() =>
    this.filteredOrders().filter((order) => {
      const status = this.normalizeStatus(order.status);
      return status === 'em_preparo' || status === 'em_entrega';
    }).length,
  );
  protected readonly todayRevenue = computed(() =>
    this.filteredOrders()
      .filter((order) => this.normalizeStatus(order.status) === 'entregue')
      .reduce((sum, order) => sum + order.total, 0),
  );

  protected estForm: EstablishmentDto = {
    name: '',
    logoUrl: '',
    category: 'hamburgueria',
    address: '',
    whatsapp: '',
    openTime: '18:00',
    closeTime: '22:00',
  };

  protected prodForm = {
    name: '',
    description: '',
    price: 0,
    category: 'hamburguer',
    image: '',
    trackInventory: false,
    stockQuantity: 0,
    lowStockThreshold: 0,
  };

  protected inventoryForm = {
    productId: '',
    type: 'entrada' as InventoryMovementType,
    quantity: 0,
    newQuantity: 0,
    reason: '',
  };

  constructor() {
    this.loadEstablishment();
    this.loadProducts();
    this.loadInventory();
    this.loadInventoryMovements();
    this.loadClients();
    this.loadOrders();
  }

  protected setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  protected setIntegrationMenu(menu: IntegrationMenu): void {
    this.activeIntegrationMenu.set(menu);
  }

  protected setProductsPage(page: number): void {
    this.productsPage.set(page);
  }

  protected setInventoryPage(page: number): void {
    this.inventoryPage.set(page);
  }

  protected setInventoryFilter(filter: InventoryFilter): void {
    this.inventoryFilter.set(filter);
    this.inventoryPage.set(1);
  }

  protected setClientsPage(page: number): void {
    this.clientsPage.set(page);
  }

  protected clientInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected clientAvatarColor(name: string): string {
    const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
    return palette[name.charCodeAt(0) % palette.length];
  }

  protected saveEstablishment(): void {
    this.api.saveEstablishment(this.estForm).subscribe({
      next: (establishment) => {
        this.estForm = establishment;
        this.estSaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.estSaved.set(false), 3000);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar os dados do estabelecimento.'));
      },
    });
  }

  protected onEstablishmentLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Selecione um arquivo de imagem valido para a logo.');
      input.value = '';
      return;
    }

    this.api.uploadImage(file).subscribe({
      next: (response) => {
        this.estForm = { ...this.estForm, logoUrl: response.url };
        this.errorMessage.set('');
        input.value = '';
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel enviar a logo selecionada.'));
      },
    });
  }

  protected openAddProduct(): void {
    this.editingProductId.set(null);
    this.editingProductName.set(null);
    this.prodForm = {
      name: '',
      description: '',
      price: 0,
      category: 'hamburguer',
      image: '',
      trackInventory: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
    };
    this.showProductForm.set(true);
  }

  protected editProduct(product: Product): void {
    this.editingProductId.set(product.id);
    this.editingProductName.set(product.name);
    this.prodForm = {
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image,
      trackInventory: product.trackInventory,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
    };
    this.showProductForm.set(true);
  }

  protected saveProduct(): void {
    if (!this.prodForm.name.trim()) {
      return;
    }

    const payload: ProductPayload = {
      name: this.prodForm.name,
      description: this.prodForm.description,
      price: this.prodForm.price,
      category: this.prodForm.category,
      imageUrl: this.prodForm.image,
      trackInventory: this.prodForm.trackInventory,
      stockQuantity: Math.max(0, Number(this.prodForm.stockQuantity) || 0),
      lowStockThreshold: Math.max(0, Number(this.prodForm.lowStockThreshold) || 0),
    };

    const editingId = this.editingProductId();
    const request = editingId
      ? this.api.updateProduct(editingId, payload)
      : this.api.createProduct(payload);

    request.subscribe({
      next: () => {
        this.prodSaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.prodSaved.set(false), 3000);
        this.cancelProductForm();
        this.loadProducts();
        this.loadInventory();
        this.loadInventoryMovements();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar o produto.'));
      },
    });
  }

  protected onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Selecione um arquivo de imagem valido.');
      input.value = '';
      return;
    }

    this.api.uploadImage(file).subscribe({
      next: (response) => {
        this.prodForm.image = response.url;
        this.errorMessage.set('');
        input.value = '';
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel enviar a imagem selecionada.'));
      },
    });
  }

  protected deleteProduct(id: string): void {
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadProducts();
        this.loadInventory();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel excluir o produto.'));
      },
    });
  }

  protected cancelProductForm(): void {
    this.showProductForm.set(false);
    this.editingProductId.set(null);
    this.editingProductName.set(null);
  }

  protected openInventoryMovement(product: InventoryProductDto, type: InventoryMovementType = 'entrada'): void {
    if (!product.trackInventory) {
      this.errorMessage.set('Ative o controle de estoque no cadastro do produto antes de movimentar.');
      this.setTab('produtos');
      return;
    }

    this.selectedInventoryProductName.set(product.name);
    this.inventoryForm = {
      productId: product.id,
      type,
      quantity: type === 'ajuste' ? 0 : 1,
      newQuantity: product.stockQuantity,
      reason: '',
    };
    this.showInventoryMovementForm.set(true);
  }

  protected cancelInventoryMovementForm(): void {
    this.showInventoryMovementForm.set(false);
    this.selectedInventoryProductName.set(null);
    this.inventoryForm = { productId: '', type: 'entrada', quantity: 0, newQuantity: 0, reason: '' };
  }

  protected saveInventoryMovement(): void {
    if (!this.inventoryForm.productId) {
      this.errorMessage.set('Selecione um produto para movimentar.');
      return;
    }

    const payload: InventoryMovementPayload = {
      productId: this.inventoryForm.productId,
      type: this.inventoryForm.type,
      quantity: Math.max(0, Number(this.inventoryForm.quantity) || 0),
      newQuantity:
        this.inventoryForm.type === 'ajuste'
          ? Math.max(0, Number(this.inventoryForm.newQuantity) || 0)
          : null,
      reason: this.inventoryForm.reason,
    };

    this.api.createInventoryMovement(payload).subscribe({
      next: () => {
        this.inventorySaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.inventorySaved.set(false), 3000);
        this.cancelInventoryMovementForm();
        this.loadProducts();
        this.loadInventory();
        this.loadInventoryMovements();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel registrar a movimentacao.'));
      },
    });
  }

  protected setFilterDate(date: string): void {
    this.filterDate.set(date);
    this.ordersPage.set(1);
    this.loadOrders();
  }

  protected clearDateFilter(): void {
    this.filterDateValue = '';
    this.filterDate.set('');
    this.ordersPage.set(1);
    this.loadOrders();
  }

  protected setOrdersPage(page: number): void {
    this.ordersPage.set(page);
  }

  protected advanceOrderStatus(id: string): void {
    this.api.advanceOrderStatus(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadOrders();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel avancar o status do pedido.'));
      },
    });
  }

  protected cancelOrder(id: string): void {
    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadOrders();
        this.loadInventory();
        this.loadInventoryMovements();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel cancelar o pedido.'));
      },
    });
  }

  protected canAdvance(status: string): boolean {
    const normalizedStatus = this.normalizeStatus(status);
    return normalizedStatus === 'pendente' || normalizedStatus === 'em_preparo' || normalizedStatus === 'em_entrega';
  }

  protected canCancel(status: string): boolean {
    const normalizedStatus = this.normalizeStatus(status);
    return normalizedStatus === 'pendente' || normalizedStatus === 'em_preparo';
  }

  protected orderStatusLabel(status: string): string {
    const normalizedStatus = this.normalizeStatus(status);
    const labels: Record<OrderStatus, string> = {
      pendente: 'Pendente',
      em_preparo: 'Em Preparo',
      em_entrega: 'Em Entrega',
      entregue: 'Entregue',
      cancelado: 'Cancelado',
    };
    return labels[normalizedStatus];
  }

  protected nextStatusLabel(status: string): string {
    const normalizedStatus = this.normalizeStatus(status);
    const labels: Partial<Record<OrderStatus, string>> = {
      pendente: 'Iniciar Preparo',
      em_preparo: 'Saiu p/ Entrega',
      em_entrega: 'Confirmar Entrega',
    };
    return labels[normalizedStatus] ?? '';
  }

  protected orderStatusClass(status: string): string {
    return `order-status order-status--${this.normalizeStatus(status).replace(/_/g, '-')}`;
  }

  protected sourceBadgeClass(source: string): string {
    return `source-badge source-badge--${this.normalizeSource(source)}`;
  }

  protected sourceLabel(source: string): string {
    const normalizedSource = this.normalizeSource(source);
    const labels: Record<OrderSource, string> = {
      whatsapp: 'WhatsApp',
      ifood: 'iFood',
      site: 'Site',
    };
    return labels[normalizedSource];
  }

  protected sourceIcon(source: string): string {
    const normalizedSource = this.normalizeSource(source);
    const icons: Record<OrderSource, string> = {
      whatsapp: 'fa-brands fa-whatsapp',
      ifood: 'fa-utensils',
      site: 'fa-globe',
    };
    return icons[normalizedSource];
  }

  protected inventoryStatusLabel(status: string): string {
    const normalizedStatus = this.normalizeStockStatus(status);
    const labels: Record<string, string> = {
      untracked: 'Sem controle',
      available: 'Disponivel',
      low: 'Estoque baixo',
      out: 'Esgotado',
    };
    return labels[normalizedStatus];
  }

  protected inventoryStatusClass(status: string): string {
    const classes: Record<string, string> = {
      untracked: 'source-badge source-badge--site',
      available: 'order-status order-status--entregue',
      low: 'order-status order-status--pendente',
      out: 'order-status order-status--cancelado',
    };
    return classes[this.normalizeStockStatus(status)];
  }

  protected inventoryFilterClass(filter: InventoryFilter): string {
    return this.inventoryFilter() === filter ? 'inventory-filter inventory-filter--active' : 'inventory-filter';
  }

  protected movementTypeLabel(type: string): string {
    const normalizedType = type.toLowerCase();
    const labels: Record<string, string> = {
      entrada: 'Entrada',
      venda: 'Venda',
      cancelamento: 'Cancelamento',
      ajuste: 'Ajuste',
      perda: 'Perda',
    };
    return labels[normalizedType] ?? type;
  }

  protected movementTypeClass(type: string): string {
    const normalizedType = type.toLowerCase();

    if (normalizedType === 'entrada' || normalizedType === 'cancelamento') {
      return 'order-status order-status--entregue';
    }

    if (normalizedType === 'venda' || normalizedType === 'perda') {
      return 'order-status order-status--cancelado';
    }

    return 'order-status order-status--em-preparo';
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private loadEstablishment(): void {
    this.isLoadingEstablishment.set(true);

    this.api.getEstablishment().subscribe({
      next: (establishment) => {
        this.estForm = establishment;
        this.isLoadingEstablishment.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar o estabelecimento.'));
        this.isLoadingEstablishment.set(false);
      },
    });
  }

  private loadProducts(): void {
    this.isLoadingProducts.set(true);

    this.api.getProducts(1, 1000).subscribe({
      next: (result) => {
        this.products.set(
          result.items.map((product) => ({
            ...product,
            image: product.imageUrl,
          })),
        );
        this.productsPage.set(Math.min(this.productsPage(), Math.max(1, Math.ceil(result.items.length / PRODUCTS_PER_PAGE))));
        this.isLoadingProducts.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar os produtos.'));
        this.isLoadingProducts.set(false);
      },
    });
  }

  private loadInventory(): void {
    this.isLoadingInventory.set(true);

    this.api.getInventory(1, 1000).subscribe({
      next: (result) => {
        this.inventoryProducts.set(result.items);
        this.inventoryPage.set(
          Math.min(this.inventoryPage(), Math.max(1, Math.ceil(result.items.length / INVENTORY_PER_PAGE))),
        );
        this.isLoadingInventory.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar o estoque.'));
        this.isLoadingInventory.set(false);
      },
    });
  }

  protected loadInventoryMovements(): void {
    this.isLoadingInventoryMovements.set(true);

    this.api.getInventoryMovements(undefined, 1, 20).subscribe({
      next: (result) => {
        this.inventoryMovements.set(result.items);
        this.isLoadingInventoryMovements.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar as movimentacoes de estoque.'));
        this.isLoadingInventoryMovements.set(false);
      },
    });
  }

  private loadClients(): void {
    this.isLoadingClients.set(true);

    this.api.getClients(1, 1000).subscribe({
      next: (result) => {
        this.clients.set(result.items);
        this.clientsPage.set(Math.min(this.clientsPage(), Math.max(1, Math.ceil(result.items.length / CLIENTS_PER_PAGE))));
        this.isLoadingClients.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar os clientes.'));
        this.isLoadingClients.set(false);
      },
    });
  }

  private loadOrders(): void {
    this.isLoadingOrders.set(true);

    this.api.getOrders(1, 1000, this.filterDate() || undefined).subscribe({
      next: (result) => {
        this.orders.set(result.items);
        this.ordersPage.set(Math.min(this.ordersPage(), Math.max(1, Math.ceil(result.items.length / ORDERS_PER_PAGE))));
        this.isLoadingOrders.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar os pedidos.'));
        this.isLoadingOrders.set(false);
      },
    });
  }

  private normalizeStatus(status: string): OrderStatus {
    const normalized = status.toLowerCase();

    switch (normalized) {
      case 'empreparo':
        return 'em_preparo';
      case 'ementrega':
        return 'em_entrega';
      case 'entregue':
        return 'entregue';
      case 'cancelado':
        return 'cancelado';
      default:
        return 'pendente';
    }
  }

  private normalizeSource(source: string): OrderSource {
    const normalized = source.toLowerCase();

    switch (normalized) {
      case 'whatsapp':
        return 'whatsapp';
      case 'ifood':
        return 'ifood';
      default:
        return 'site';
    }
  }

  private normalizeStockStatus(status: string): string {
    const normalized = status.toLowerCase();
    return ['untracked', 'available', 'low', 'out'].includes(normalized) ? normalized : 'available';
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const details = this.getApiErrorDetails(error);

    if (!details) {
      return fallback;
    }

    return `${fallback} ${details}`;
  }

  private getApiErrorDetails(error: HttpErrorResponse): string {
    const payload = error.error as { error?: string; errors?: { propertyName?: string; errorMessage?: string }[] } | null;
    const backendMessage = payload?.error || this.getValidationErrorMessage(payload?.errors);

    if (error.status === 0) {
      return 'Status 0: nao foi possivel conectar na API. Verifique se o backend esta rodando e se o CORS permite esta origem.';
    }

    if (backendMessage) {
      return `Status ${error.status}: ${backendMessage}`;
    }

    const statusMessages: Record<number, string> = {
      400: 'requisicao invalida. Confira os dados enviados.',
      401: 'nao autorizado. Faca login novamente para enviar o token administrativo.',
      403: 'acesso negado para este usuario.',
      404: 'endpoint ou recurso nao encontrado. Verifique se a API foi reiniciada com a versao mais recente.',
      409: 'conflito de dados. Recarregue a tela e tente novamente.',
      422: 'regra de negocio recusou a operacao.',
      500: 'erro interno na API. Veja o log do backend para o detalhe tecnico.',
    };

    return `Status ${error.status}: ${(statusMessages[error.status] ?? error.statusText) || 'erro inesperado na API.'}`;
  }

  private getValidationErrorMessage(errors?: { propertyName?: string; errorMessage?: string }[]): string {
    if (!errors?.length) {
      return '';
    }

    return errors
      .map((item) => [item.propertyName, item.errorMessage].filter(Boolean).join(': '))
      .join('; ');
  }
}
