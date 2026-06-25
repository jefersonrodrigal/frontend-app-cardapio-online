import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  AiAgentsIntegrationDto,
  AnotaiIntegrationDto,
  ClientDto,
  EstablishmentDto,
  IFoodIntegrationDto,
  NinetyNineFoodIntegrationDto,
  OrderDto,
  ProductDto,
  ProductPayload,
  TakeBlipIntegrationDto,
  UberEatsIntegrationDto,
  WhatsAppIntegrationDto,
  ZenviaIntegrationDto,
} from '../../core/api.models';

type Tab = 'estabelecimento' | 'produtos' | 'clientes' | 'pedidos' | 'integracoes';
type IntegrationMenu = 'ifood' | 'anotai' | 'ubereats' | '99food' | 'aiagents' | 'whatsapp' | 'takeblip' | 'zenvia';
type OrderStatus = 'pendente' | 'em_preparo' | 'em_entrega' | 'entregue' | 'cancelado';
type OrderSource = 'whatsapp' | 'ifood' | 'site';

interface Product extends ProductDto {
  image: string;
}

interface Client extends ClientDto {}

const PRODUCTS_PER_PAGE = 5;
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
  protected readonly errorMessage = signal('');
  protected readonly isLoadingEstablishment = signal(false);
  protected readonly isLoadingProducts = signal(false);
  protected readonly isLoadingClients = signal(false);
  protected readonly isLoadingOrders = signal(false);
  protected readonly isLoadingIntegrations = signal(false);
  protected readonly integrationSaved = signal('');

  protected readonly productsPage = signal(1);
  protected readonly clientsPage = signal(1);
  protected readonly ordersPage = signal(1);

  protected readonly products = signal<Product[]>([]);
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
  };

  protected iFoodForm: IFoodIntegrationDto = {
    enabled: false,
    clientId: '',
    clientSecret: '',
    merchantId: '',
  };

  protected anotaiForm: AnotaiIntegrationDto = {
    enabled: false,
    apiToken: '',
    accountId: '',
    webhookUrl: '',
  };

  protected uberEatsForm: UberEatsIntegrationDto = {
    enabled: false,
    clientId: '',
    clientSecret: '',
    storeId: '',
    webhookSigningSecret: '',
  };

  protected ninetyNineFoodForm: NinetyNineFoodIntegrationDto = {
    enabled: false,
    clientId: '',
    clientSecret: '',
    storeId: '',
    webhookUrl: '',
  };

  protected aiAgentsForm: AiAgentsIntegrationDto = {
    enabled: false,
    provider: '',
    apiKey: '',
    model: '',
    assistantId: '',
    webhookUrl: '',
  };

  protected whatsAppForm: WhatsAppIntegrationDto = {
    enabled: false,
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    appSecret: '',
    verifyToken: '',
  };

  protected takeBlipForm: TakeBlipIntegrationDto = {
    enabled: false,
    botShortName: '',
    authorizationKey: '',
    webhookUrl: '',
  };

  protected zenviaForm: ZenviaIntegrationDto = {
    enabled: false,
    apiToken: '',
    channelId: '',
    webhookUrl: '',
  };

  constructor() {
    this.loadEstablishment();
    this.loadProducts();
    this.loadClients();
    this.loadOrders();
    this.loadIntegrations();
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
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar os dados do estabelecimento.');
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
      error: () => {
        this.errorMessage.set('Nao foi possivel enviar a logo selecionada.');
      },
    });
  }

  protected openAddProduct(): void {
    this.editingProductId.set(null);
    this.editingProductName.set(null);
    this.prodForm = { name: '', description: '', price: 0, category: 'hamburguer', image: '' };
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
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar o produto.');
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
      error: () => {
        this.errorMessage.set('Nao foi possivel enviar a imagem selecionada.');
      },
    });
  }

  protected deleteProduct(id: string): void {
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadProducts();
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel excluir o produto.');
      },
    });
  }

  protected cancelProductForm(): void {
    this.showProductForm.set(false);
    this.editingProductId.set(null);
    this.editingProductName.set(null);
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
      error: () => {
        this.errorMessage.set('Nao foi possivel avancar o status do pedido.');
      },
    });
  }

  protected cancelOrder(id: string): void {
    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadOrders();
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel cancelar o pedido.');
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

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  protected saveIFood(): void {
    this.api.saveIFoodIntegration(this.iFoodForm).subscribe({
      next: (result) => {
        this.iFoodForm = result;
        this.showIntegrationSaved('ifood');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao iFood.');
      },
    });
  }

  protected saveAnotai(): void {
    this.api.saveAnotaiIntegration(this.anotaiForm).subscribe({
      next: (result) => {
        this.anotaiForm = result;
        this.showIntegrationSaved('anotai');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao Anotai.');
      },
    });
  }

  protected saveUberEats(): void {
    this.api.saveUberEatsIntegration(this.uberEatsForm).subscribe({
      next: (result) => {
        this.uberEatsForm = result;
        this.showIntegrationSaved('ubereats');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao Uber Eats.');
      },
    });
  }

  protected saveNinetyNineFood(): void {
    this.api.saveNinetyNineFoodIntegration(this.ninetyNineFoodForm).subscribe({
      next: (result) => {
        this.ninetyNineFoodForm = result;
        this.showIntegrationSaved('99food');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao 99Food.');
      },
    });
  }

  protected saveAiAgents(): void {
    this.api.saveAiAgentsIntegration(this.aiAgentsForm).subscribe({
      next: (result) => {
        this.aiAgentsForm = result;
        this.showIntegrationSaved('aiagents');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao Agents de IA.');
      },
    });
  }

  protected saveWhatsApp(): void {
    this.api.saveWhatsAppIntegration(this.whatsAppForm).subscribe({
      next: (result) => {
        this.whatsAppForm = result;
        this.showIntegrationSaved('whatsapp');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao WhatsApp.');
      },
    });
  }

  protected saveTakeBlip(): void {
    this.api.saveTakeBlipIntegration(this.takeBlipForm).subscribe({
      next: (result) => {
        this.takeBlipForm = result;
        this.showIntegrationSaved('takeblip');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao Take Blip.');
      },
    });
  }

  protected saveZenvia(): void {
    this.api.saveZenviaIntegration(this.zenviaForm).subscribe({
      next: (result) => {
        this.zenviaForm = result;
        this.showIntegrationSaved('zenvia');
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel salvar a integracao Zenvia.');
      },
    });
  }

  private showIntegrationSaved(key: string): void {
    this.integrationSaved.set(key);
    this.errorMessage.set('');
    window.setTimeout(() => {
      if (this.integrationSaved() === key) {
        this.integrationSaved.set('');
      }
    }, 3000);
  }

  private loadIntegrations(): void {
    this.isLoadingIntegrations.set(true);

    this.api.getIntegrations().subscribe({
      next: (result) => {
        this.iFoodForm = result.iFood;
        this.anotaiForm = result.anotai;
        this.uberEatsForm = result.uberEats;
        this.ninetyNineFoodForm = result.ninetyNineFood;
        this.aiAgentsForm = result.aiAgents;
        this.whatsAppForm = result.whatsApp;
        this.takeBlipForm = result.takeBlip;
        this.zenviaForm = result.zenvia;
        this.isLoadingIntegrations.set(false);
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar as integracoes.');
        this.isLoadingIntegrations.set(false);
      },
    });
  }

  private loadEstablishment(): void {
    this.isLoadingEstablishment.set(true);

    this.api.getEstablishment().subscribe({
      next: (establishment) => {
        this.estForm = establishment;
        this.isLoadingEstablishment.set(false);
      },
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar o estabelecimento.');
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
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar os produtos.');
        this.isLoadingProducts.set(false);
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
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar os clientes.');
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
      error: () => {
        this.errorMessage.set('Nao foi possivel carregar os pedidos.');
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
}
