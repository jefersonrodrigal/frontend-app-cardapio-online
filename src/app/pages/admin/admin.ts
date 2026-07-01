import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  AdditionalGroupDto,
  AdditionalGroupPayload,
  AdditionalItemDto,
  AdditionalItemPayload,
  AiAgentsIntegrationDto,
  AnotaiIntegrationDto,
  CategoryDto,
  CategoryPayload,
  ClientDto,
  CreateOrderPayload,
  EstablishmentDto,
  IFoodIntegrationDto,
  InventoryMovementDto,
  InventoryMovementPayload,
  InventoryProductDto,
  NeighborhoodDeliveryFeeDto,
  NeighborhoodDeliveryFeePayload,
  NinetyNineFoodIntegrationDto,
  OrderDto,
  ProductDto,
  ProductPayload,
  TakeBlipIntegrationDto,
  UberEatsIntegrationDto,
  WhatsAppIntegrationDto,
  ZenviaIntegrationDto,
} from '../../core/api.models';

type Tab = 'estabelecimento' | 'produtos' | 'categorias' | 'estoque' | 'clientes' | 'pedidos' | 'integracoes';
type IntegrationMenu = 'ifood' | 'anotai' | 'ubereats' | '99food' | 'aiagents' | 'whatsapp' | 'takeblip' | 'zenvia';
type OrderStatus = 'pendente' | 'em_preparo' | 'em_entrega' | 'em_atraso' | 'entregue' | 'cancelado';
type OrderSource = 'whatsapp' | 'ifood' | 'site' | 'interno';
type InternalOrderType = 'ConsumoLocal' | 'Retirada' | 'Entrega';
type OrderType = 'consumolocal' | 'retirada' | 'entrega';
type InventoryFilter = 'all' | 'low' | 'out' | 'untracked';
type InventoryMovementType = 'entrada' | 'perda' | 'ajuste';

interface Product extends ProductDto {
  image: string;
}

interface Client extends ClientDto {}

interface InternalOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  trackInventory: boolean;
  stockQuantity: number;
}

const PRODUCTS_PER_PAGE = 5;
const INVENTORY_PER_PAGE = 8;
const CLIENTS_PER_PAGE = 5;
const ORDERS_PER_PAGE = 5;
const ORDERS_AUTO_REFRESH_MS = 10000;

@Component({
  selector: 'app-admin',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private ordersAutoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private ordersFilterTimer: ReturnType<typeof setTimeout> | null = null;

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
  protected readonly isRefreshingOrders = signal(false);
  protected readonly isLoadingIntegrations = signal(false);
  protected readonly integrationSaved = signal('');
  protected readonly isSavingInternalOrder = signal(false);
  protected readonly internalOrderType = signal<InternalOrderType>('ConsumoLocal');

  protected readonly productsPage = signal(1);
  protected readonly inventoryPage = signal(1);
  protected readonly clientsPage = signal(1);
  protected readonly ordersPage = signal(1);
  protected readonly inventoryFilter = signal<InventoryFilter>('all');
  protected readonly showInventoryMovementForm = signal(false);
  protected readonly showInternalOrderForm = signal(false);
  protected readonly selectedInventoryProductName = signal<string | null>(null);
  protected readonly internalOrderError = signal('');
  protected readonly orderSaved = signal(false);

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly showCategoryForm = signal(false);
  protected readonly editingCategoryId = signal<number | null>(null);
  protected readonly editingCategoryName = signal<string | null>(null);
  protected readonly catSaved = signal(false);
  protected catForm: CategoryPayload = { name: '', sortOrder: 1 };

  protected readonly neighborhoodFees = signal<NeighborhoodDeliveryFeeDto[]>([]);
  protected readonly showNeighborhoodFeeForm = signal(false);
  protected readonly editingNeighborhoodFeeId = signal<number | null>(null);
  protected readonly neighborhoodFeeSaved = signal(false);
  protected neighborhoodFeeForm: NeighborhoodDeliveryFeePayload = { neighborhood: '', fee: 0, isActive: true };

  protected readonly products = signal<Product[]>([]);
  protected readonly inventoryProducts = signal<InventoryProductDto[]>([]);
  protected readonly inventoryMovements = signal<InventoryMovementDto[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly internalOrderItems = signal<InternalOrderItem[]>([]);

  protected readonly additionalGroups = signal<AdditionalGroupDto[]>([]);
  protected readonly isLoadingAdditionalGroups = signal(false);
  protected readonly showGroupForm = signal(false);
  protected readonly editingGroupId = signal<string | null>(null);
  protected readonly showItemForm = signal<string | null>(null); // groupId
  protected readonly editingItemId = signal<string | null>(null);
  protected readonly groupFormError = signal('');

  protected groupForm: AdditionalGroupPayload = { name: '', minSelections: 0, maxSelections: 1, sortOrder: 0 };
  protected itemForm: AdditionalItemPayload = { name: '', price: 0, isAvailable: true, sortOrder: 0 };

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

    if (filter === 'low') return products.filter((p) => p.stockStatus === 'low');
    if (filter === 'out') return products.filter((p) => p.stockStatus === 'out');
    if (filter === 'untracked') return products.filter((p) => p.stockStatus === 'untracked');
    return products;
  });
  protected readonly trackedInventoryCount = computed(() =>
    this.inventoryProducts().filter((p) => p.trackInventory).length,
  );
  protected readonly lowInventoryCount = computed(() =>
    this.inventoryProducts().filter((p) => p.stockStatus === 'low').length,
  );
  protected readonly outInventoryCount = computed(() =>
    this.inventoryProducts().filter((p) => p.stockStatus === 'out').length,
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
  protected readonly orderSearch = signal('');
  protected readonly activeOrdersOnly = signal(false);
  protected readonly ordersLastUpdatedAt = signal('');
  protected filterDateValue = '';
  protected orderSearchValue = '';
  protected readonly filteredOrders = computed(() => this.orders());
  protected readonly hasOrderFilters = computed(() =>
    Boolean(this.filterDate() || this.orderSearch().trim() || this.activeOrdersOnly()),
  );
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
    this.filteredOrders().filter((o) => this.normalizeStatus(o.status) === 'pendente').length,
  );
  protected readonly activeOrdersCount = computed(() =>
    this.filteredOrders().filter((o) => {
      const s = this.normalizeStatus(o.status);
      return s === 'em_preparo' || s === 'em_entrega' || s === 'em_atraso';
    }).length,
  );
  protected readonly todayRevenue = computed(() =>
    this.filteredOrders()
      .filter((o) => this.normalizeStatus(o.status) === 'entregue')
      .reduce((sum, o) => sum + o.total, 0),
  );
  protected readonly internalOrderSubtotal = computed(() =>
    this.internalOrderItems().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  protected readonly internalOrderDeliveryFee = computed(() => 0);
  protected readonly internalOrderTotal = computed(
    () => this.internalOrderSubtotal() + this.internalOrderDeliveryFee(),
  );

  protected estForm: EstablishmentDto = {
    name: '',
    logoUrl: '',
    category: 'hamburgueria',
    address: '',
    whatsapp: '',
    openTime: '18:00',
    closeTime: '22:00',
    sendOrderTrackingViaWhatsApp: false,
    preparationTimeMinutes: 30,
    deliverySafetyMarginMinutes: 10,
    instagramUrl: '',
    facebookUrl: '',
    tikTokUrl: '',
    twitterUrl: '',
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
    isOnPromotion: false,
    promotionalPrice: 0,
    discountPercent: 0,
  };

  protected inventoryForm = {
    productId: '',
    type: 'entrada' as InventoryMovementType,
    quantity: 0,
    newQuantity: 0,
    reason: '',
  };

  protected internalOrderForm = {
    clientName: 'Cliente interno',
    clientPhone: '',
    type: 'ConsumoLocal' as InternalOrderType,
    table: '',
    address: '',
    note: '',
    productId: '',
    quantity: 1,
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
    this.loadCategories();
    this.loadNeighborhoodFees();
    this.loadProducts();
    this.loadInventory();
    this.loadInventoryMovements();
    this.loadClients();
    this.loadOrders();
    this.startOrdersAutoRefresh();
    this.loadIntegrations();
  }

  ngOnDestroy(): void {
    if (this.ordersAutoRefreshTimer) {
      clearInterval(this.ordersAutoRefreshTimer);
    }

    if (this.ordersFilterTimer) {
      clearTimeout(this.ordersFilterTimer);
    }
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

  protected openClientRegistration(): void {
    void this.router.navigate(['/cadastro']);
  }

  protected openOrderRegistration(): void {
    this.resetInternalOrderForm();
    this.showInternalOrderForm.set(true);
  }

  protected cancelInternalOrderForm(): void {
    this.showInternalOrderForm.set(false);
    this.internalOrderError.set('');
  }

  protected addInternalOrderItem(): void {
    const product = this.products().find((item) => item.id === this.internalOrderForm.productId);
    const quantity = Math.max(1, Number(this.internalOrderForm.quantity) || 1);

    if (!product) {
      this.internalOrderError.set('Selecione um produto para adicionar ao pedido.');
      return;
    }

    if (!this.canAddInternalOrderQuantity(product, quantity)) {
      this.internalOrderError.set(`Quantidade indisponivel para ${product.name}.`);
      return;
    }

    this.internalOrderItems.update((items) => {
      const existingItem = items.find((item) => item.productId === product.id);

      if (existingItem) {
        return items.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [
        ...items,
        {
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: product.price,
          trackInventory: product.trackInventory,
          stockQuantity: product.stockQuantity,
        },
      ];
    });

    this.internalOrderForm.productId = '';
    this.internalOrderForm.quantity = 1;
    this.internalOrderError.set('');
  }

  protected incrementInternalOrderItem(productId: string): void {
    const product = this.products().find((item) => item.id === productId);

    if (!product || !this.canAddInternalOrderQuantity(product, 1)) {
      this.internalOrderError.set(
        product ? `Estoque maximo atingido para ${product.name}.` : 'Produto nao encontrado.',
      );
      return;
    }

    this.internalOrderItems.update((items) =>
      items.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)),
    );
    this.internalOrderError.set('');
  }

  protected decrementInternalOrderItem(productId: string): void {
    this.internalOrderItems.update((items) =>
      items
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
    this.internalOrderError.set('');
  }

  protected removeInternalOrderItem(productId: string): void {
    this.internalOrderItems.update((items) => items.filter((item) => item.productId !== productId));
    this.internalOrderError.set('');
  }

  protected canUseProductInInternalOrder(product: Product): boolean {
    return !product.trackInventory || product.stockQuantity > 0;
  }

  protected saveInternalOrder(): void {
    if (this.internalOrderItems().length === 0) {
      this.internalOrderError.set('Adicione pelo menos um produto ao pedido.');
      return;
    }

    if (this.internalOrderType() === 'Entrega' && !this.internalOrderForm.address.trim()) {
      this.internalOrderError.set('Informe o endereco para pedidos de entrega.');
      return;
    }

    const clientName = this.internalOrderForm.clientName.trim() || 'Cliente interno';
    const payload: CreateOrderPayload = {
      clientName,
      clientPhone: this.internalOrderForm.clientPhone.trim() || this.generateInternalOrderPhone(),
      address: this.internalOrderAddress(),
      source: 'interno',
      items: this.internalOrderItems().map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      note: this.internalOrderNote(),
      orderType: this.internalOrderType(),
      trackingBaseUrl: globalThis.location?.origin ?? null,
    };

    this.isSavingInternalOrder.set(true);
    this.internalOrderError.set('');

    this.api.createOrder(payload).subscribe({
      next: () => {
        this.isSavingInternalOrder.set(false);
        this.showInternalOrderForm.set(false);
        this.orderSaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.orderSaved.set(false), 3000);
        this.resetInternalOrderForm();
        this.loadOrders();
        this.loadProducts();
        this.loadInventory();
        this.loadInventoryMovements();
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingInternalOrder.set(false);
        this.internalOrderError.set(this.getApiErrorMessage(error, 'Nao foi possivel cadastrar o pedido.'));
      },
    });
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

    if (!file) return;

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

  protected getCategoryName(slug: string): string {
    return this.categories().find((c) => c.slug === slug)?.name ?? slug;
  }

  protected openAddCategory(): void {
    this.editingCategoryId.set(null);
    this.editingCategoryName.set(null);
    const nextOrder =
      this.categories().length > 0 ? Math.max(...this.categories().map((c) => c.sortOrder)) + 1 : 1;
    this.catForm = { name: '', sortOrder: nextOrder };
    this.showCategoryForm.set(true);
  }

  protected editCategory(cat: CategoryDto): void {
    this.editingCategoryId.set(cat.id);
    this.editingCategoryName.set(cat.name);
    this.catForm = { name: cat.name, sortOrder: cat.sortOrder };
    this.showCategoryForm.set(true);
  }

  protected cancelCategoryForm(): void {
    this.showCategoryForm.set(false);
    this.editingCategoryId.set(null);
    this.editingCategoryName.set(null);
  }

  protected saveCategory(): void {
    if (!this.catForm.name.trim()) return;

    const editingId = this.editingCategoryId();
    const request = editingId
      ? this.api.updateCategory(editingId, this.catForm)
      : this.api.createCategory(this.catForm);

    request.subscribe({
      next: () => {
        this.catSaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.catSaved.set(false), 3000);
        this.cancelCategoryForm();
        this.loadCategories();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a categoria.'));
      },
    });
  }

  protected deleteCategoryById(id: number): void {
    this.api.deleteCategory(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadCategories();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel excluir a categoria.'));
      },
    });
  }

  protected onPromotionalPriceChange(raw: string): void {
    const promo = parseFloat(raw);
    const price = Number(this.prodForm.price);
    this.prodForm.promotionalPrice = isNaN(promo) ? 0 : promo;
    if (price > 0 && promo > 0 && promo < price) {
      this.prodForm.discountPercent = Math.round((1 - promo / price) * 1000) / 10;
    } else {
      this.prodForm.discountPercent = 0;
    }
  }

  protected onDiscountPercentChange(raw: string): void {
    const pct = parseFloat(raw);
    const price = Number(this.prodForm.price);
    this.prodForm.discountPercent = isNaN(pct) ? 0 : pct;
    if (price > 0 && pct > 0 && pct < 100) {
      this.prodForm.promotionalPrice = Math.round(price * (1 - pct / 100) * 100) / 100;
    } else {
      this.prodForm.promotionalPrice = 0;
    }
  }

  protected openAddProduct(): void {
    const firstSlug = this.categories()[0]?.slug ?? 'outro';
    this.editingProductId.set(null);
    this.editingProductName.set(null);
    this.prodForm = {
      name: '',
      description: '',
      price: 0,
      category: firstSlug,
      image: '',
      trackInventory: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
      isOnPromotion: false,
      promotionalPrice: 0,
      discountPercent: 0,
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
      isOnPromotion: product.isOnPromotion,
      promotionalPrice: product.promotionalPrice ?? 0,
      discountPercent: (() => {
        const p = product.price;
        const promo = product.promotionalPrice;
        return p > 0 && promo && promo < p ? Math.round((1 - promo / p) * 1000) / 10 : 0;
      })(),
    };
    this.showProductForm.set(true);
    this.loadAdditionalGroups();
  }

  protected saveProduct(): void {
    if (!this.prodForm.name.trim()) return;

    const payload: ProductPayload = {
      name: this.prodForm.name,
      description: this.prodForm.description,
      price: this.prodForm.price,
      category: this.prodForm.category,
      imageUrl: this.prodForm.image,
      trackInventory: this.prodForm.trackInventory,
      stockQuantity: Math.max(0, Number(this.prodForm.stockQuantity) || 0),
      lowStockThreshold: Math.max(0, Number(this.prodForm.lowStockThreshold) || 0),
      isOnPromotion: this.prodForm.isOnPromotion,
      promotionalPrice: this.prodForm.isOnPromotion
        ? Math.max(0, Number(this.prodForm.promotionalPrice) || 0)
        : null,
    };

    const editingId = this.editingProductId();
    const request = editingId ? this.api.updateProduct(editingId, payload) : this.api.createProduct(payload);

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

    if (!file) return;

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
    this.additionalGroups.set([]);
    this.showGroupForm.set(false);
    this.showItemForm.set(null);
    this.editingGroupId.set(null);
    this.editingItemId.set(null);
    this.groupFormError.set('');
  }

  protected loadAdditionalGroups(): void {
    const productId = this.editingProductId();
    if (!productId) return;
    this.isLoadingAdditionalGroups.set(true);
    this.api.getAdditionalGroups(productId).subscribe({
      next: (groups) => {
        this.additionalGroups.set(groups);
        this.isLoadingAdditionalGroups.set(false);
      },
      error: () => { this.isLoadingAdditionalGroups.set(false); },
    });
  }

  protected openAddGroup(): void {
    this.editingGroupId.set(null);
    this.groupForm = { name: '', minSelections: 0, maxSelections: 1, sortOrder: this.additionalGroups().length };
    this.showGroupForm.set(true);
    this.groupFormError.set('');
  }

  protected editGroup(group: AdditionalGroupDto): void {
    this.editingGroupId.set(group.id);
    this.groupForm = { name: group.name, minSelections: group.minSelections, maxSelections: group.maxSelections, sortOrder: group.sortOrder };
    this.showGroupForm.set(true);
    this.groupFormError.set('');
  }

  protected cancelGroupForm(): void {
    this.showGroupForm.set(false);
    this.editingGroupId.set(null);
    this.groupFormError.set('');
  }

  protected saveGroup(): void {
    const productId = this.editingProductId();
    if (!productId || !this.groupForm.name.trim()) return;

    const editingId = this.editingGroupId();
    const request = editingId
      ? this.api.updateAdditionalGroup(productId, editingId, this.groupForm)
      : this.api.createAdditionalGroup(productId, this.groupForm);

    request.subscribe({
      next: () => {
        this.cancelGroupForm();
        this.loadAdditionalGroups();
        this.groupFormError.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.groupFormError.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar o grupo.'));
      },
    });
  }

  protected deleteGroup(groupId: string): void {
    const productId = this.editingProductId();
    if (!productId) return;
    this.api.deleteAdditionalGroup(productId, groupId).subscribe({
      next: () => { this.loadAdditionalGroups(); },
      error: (error: HttpErrorResponse) => {
        this.groupFormError.set(this.getApiErrorMessage(error, 'Nao foi possivel excluir o grupo.'));
      },
    });
  }

  protected openAddItem(groupId: string): void {
    const group = this.additionalGroups().find(g => g.id === groupId);
    this.editingItemId.set(null);
    this.itemForm = { name: '', price: 0, isAvailable: true, sortOrder: group?.items.length ?? 0 };
    this.showItemForm.set(groupId);
    this.groupFormError.set('');
  }

  protected editItem(groupId: string, item: AdditionalItemDto): void {
    this.editingItemId.set(item.id);
    this.itemForm = { name: item.name, price: item.price, isAvailable: item.isAvailable, sortOrder: item.sortOrder };
    this.showItemForm.set(groupId);
    this.groupFormError.set('');
  }

  protected cancelItemForm(): void {
    this.showItemForm.set(null);
    this.editingItemId.set(null);
    this.groupFormError.set('');
  }

  protected saveItem(): void {
    const productId = this.editingProductId();
    const groupId = this.showItemForm();
    if (!productId || !groupId || !this.itemForm.name.trim()) return;

    const editingId = this.editingItemId();
    const request = editingId
      ? this.api.updateAdditionalItem(productId, groupId, editingId, this.itemForm)
      : this.api.createAdditionalItem(productId, groupId, this.itemForm);

    request.subscribe({
      next: () => {
        this.cancelItemForm();
        this.loadAdditionalGroups();
      },
      error: (error: HttpErrorResponse) => {
        this.groupFormError.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar o item.'));
      },
    });
  }

  protected deleteItem(groupId: string, itemId: string): void {
    const productId = this.editingProductId();
    if (!productId) return;
    this.api.deleteAdditionalItem(productId, groupId, itemId).subscribe({
      next: () => { this.loadAdditionalGroups(); },
      error: (error: HttpErrorResponse) => {
        this.groupFormError.set(this.getApiErrorMessage(error, 'Nao foi possivel excluir o item.'));
      },
    });
  }

  protected toggleItemAvailability(groupId: string, item: AdditionalItemDto): void {
    const productId = this.editingProductId();
    if (!productId) return;
    this.api.updateAdditionalItem(productId, groupId, item.id, { ...item, isAvailable: !item.isAvailable }).subscribe({
      next: () => { this.loadAdditionalGroups(); },
      error: (error: HttpErrorResponse) => {
        this.groupFormError.set(this.getApiErrorMessage(error, 'Nao foi possivel atualizar a disponibilidade.'));
      },
    });
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

  protected setOrderSearch(search: string): void {
    this.orderSearch.set(search);
    this.ordersPage.set(1);
    this.scheduleOrdersReload();
  }

  protected clearOrderSearch(): void {
    this.orderSearchValue = '';
    this.orderSearch.set('');
    this.ordersPage.set(1);
    this.loadOrders();
  }

  protected setActiveOrdersOnly(activeOnly: boolean): void {
    this.activeOrdersOnly.set(activeOnly);
    this.ordersPage.set(1);
    this.loadOrders();
  }

  protected clearDateFilter(): void {
    this.filterDateValue = '';
    this.filterDate.set('');
    this.ordersPage.set(1);
    this.loadOrders();
  }

  protected clearOrderFilters(): void {
    this.filterDateValue = '';
    this.orderSearchValue = '';
    this.filterDate.set('');
    this.orderSearch.set('');
    this.activeOrdersOnly.set(false);
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
        this.loadOrders({ silent: true });
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel avancar o status do pedido.'));
      },
    });
  }

  protected markOrderDelayed(id: string): void {
    this.api.markOrderDelayed(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadOrders({ silent: true });
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel marcar o pedido como atrasado.'));
      },
    });
  }

  protected cancelOrder(id: string): void {
    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadOrders({ silent: true });
        this.loadInventory();
        this.loadInventoryMovements();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel cancelar o pedido.'));
      },
    });
  }

  protected canAdvance(status: string): boolean {
    const s = this.normalizeStatus(status);
    return s === 'pendente' || s === 'em_preparo' || s === 'em_entrega' || s === 'em_atraso';
  }

  protected canMarkDelayed(status: string): boolean {
    const s = this.normalizeStatus(status);
    return s === 'pendente' || s === 'em_preparo' || s === 'em_entrega';
  }

  protected canCancel(status: string): boolean {
    const s = this.normalizeStatus(status);
    return s === 'pendente' || s === 'em_preparo' || s === 'em_atraso';
  }

  protected orderStatusLabel(status: string): string {
    const labels: Record<OrderStatus, string> = {
      pendente: 'Pendente',
      em_preparo: 'Em Preparo',
      em_entrega: 'Em Entrega',
      em_atraso: 'Em Atraso',
      entregue: 'Entregue',
      cancelado: 'Cancelado',
    };
    return labels[this.normalizeStatus(status)];
  }

  protected nextStatusLabel(status: string): string {
    const labels: Partial<Record<OrderStatus, string>> = {
      pendente: 'Iniciar Preparo',
      em_preparo: 'Saiu p/ Entrega',
      em_entrega: 'Confirmar Entrega',
      em_atraso: 'Confirmar Entrega',
    };
    return labels[this.normalizeStatus(status)] ?? '';
  }

  protected orderStatusClass(status: string): string {
    return `order-status order-status--${this.normalizeStatus(status).replace(/_/g, '-')}`;
  }

  protected sourceBadgeClass(source: string): string {
    return `source-badge source-badge--${this.normalizeSource(source)}`;
  }

  protected sourceLabel(source: string): string {
    const labels: Record<OrderSource, string> = {
      whatsapp: 'WhatsApp',
      ifood: 'iFood',
      site: 'Site',
      interno: 'Interno',
    };
    return labels[this.normalizeSource(source)];
  }

  protected sourceIcon(source: string): string {
    const icons: Record<OrderSource, string> = {
      whatsapp: 'fa-brands fa-whatsapp',
      ifood: 'fa-utensils',
      site: 'fa-globe',
      interno: 'fa-store',
    };
    return icons[this.normalizeSource(source)];
  }

  protected orderTypeBadgeClass(orderType: string): string {
    return `order-type-badge order-type-badge--${this.normalizeOrderType(orderType).replace('local', '-local')}`;
  }

  protected orderTypeLabel(orderType: string): string {
    const labels: Record<OrderType, string> = {
      consumolocal: 'Consumo local',
      retirada: 'Retirada',
      entrega: 'Entrega',
    };
    return labels[this.normalizeOrderType(orderType)];
  }

  protected orderTypeIcon(orderType: string): string {
    const icons: Record<OrderType, string> = {
      consumolocal: 'fa-chair',
      retirada: 'fa-bag-shopping',
      entrega: 'fa-motorcycle',
    };
    return icons[this.normalizeOrderType(orderType)];
  }

  protected inventoryStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      untracked: 'Sem controle',
      available: 'Disponivel',
      low: 'Estoque baixo',
      out: 'Esgotado',
    };
    return labels[this.normalizeStockStatus(status)];
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
    const labels: Record<string, string> = {
      entrada: 'Entrada',
      venda: 'Venda',
      cancelamento: 'Cancelamento',
      ajuste: 'Ajuste',
      perda: 'Perda',
    };
    return labels[type.toLowerCase()] ?? type;
  }

  protected movementTypeClass(type: string): string {
    const normalized = type.toLowerCase();

    if (normalized === 'entrada' || normalized === 'cancelamento') {
      return 'order-status order-status--entregue';
    }

    if (normalized === 'venda' || normalized === 'perda') {
      return 'order-status order-status--cancelado';
    }

    return 'order-status order-status--em-preparo';
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  protected saveIFood(): void {
    this.api.saveIFoodIntegration(this.iFoodForm).subscribe({
      next: (result) => {
        this.iFoodForm = result;
        this.showIntegrationSaved('ifood');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao iFood.'));
      },
    });
  }

  protected saveAnotai(): void {
    this.api.saveAnotaiIntegration(this.anotaiForm).subscribe({
      next: (result) => {
        this.anotaiForm = result;
        this.showIntegrationSaved('anotai');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao Anotai.'));
      },
    });
  }

  protected saveUberEats(): void {
    this.api.saveUberEatsIntegration(this.uberEatsForm).subscribe({
      next: (result) => {
        this.uberEatsForm = result;
        this.showIntegrationSaved('ubereats');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao Uber Eats.'));
      },
    });
  }

  protected saveNinetyNineFood(): void {
    this.api.saveNinetyNineFoodIntegration(this.ninetyNineFoodForm).subscribe({
      next: (result) => {
        this.ninetyNineFoodForm = result;
        this.showIntegrationSaved('99food');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao 99Food.'));
      },
    });
  }

  protected saveAiAgents(): void {
    this.api.saveAiAgentsIntegration(this.aiAgentsForm).subscribe({
      next: (result) => {
        this.aiAgentsForm = result;
        this.showIntegrationSaved('aiagents');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao Agents de IA.'));
      },
    });
  }

  protected saveWhatsApp(): void {
    this.api.saveWhatsAppIntegration(this.whatsAppForm).subscribe({
      next: (result) => {
        this.whatsAppForm = result;
        this.showIntegrationSaved('whatsapp');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao WhatsApp.'));
      },
    });
  }

  protected saveTakeBlip(): void {
    this.api.saveTakeBlipIntegration(this.takeBlipForm).subscribe({
      next: (result) => {
        this.takeBlipForm = result;
        this.showIntegrationSaved('takeblip');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao Take Blip.'));
      },
    });
  }

  protected saveZenvia(): void {
    this.api.saveZenviaIntegration(this.zenviaForm).subscribe({
      next: (result) => {
        this.zenviaForm = result;
        this.showIntegrationSaved('zenvia');
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a integracao Zenvia.'));
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
        this.errorMessage.set(
          this.getApiErrorMessage(error, 'Nao foi possivel carregar as movimentacoes de estoque.'),
        );
        this.isLoadingInventoryMovements.set(false);
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

  private resetInternalOrderForm(): void {
    this.internalOrderType.set('ConsumoLocal');
    this.internalOrderForm = {
      clientName: 'Cliente interno',
      clientPhone: '',
      type: 'ConsumoLocal',
      table: '',
      address: '',
      note: '',
      productId: '',
      quantity: 1,
    };
    this.internalOrderItems.set([]);
    this.internalOrderError.set('');
    this.isSavingInternalOrder.set(false);
  }

  private canAddInternalOrderQuantity(product: Product, quantityToAdd: number): boolean {
    if (!product.trackInventory) return true;

    const quantityInOrder =
      this.internalOrderItems().find((item) => item.productId === product.id)?.quantity ?? 0;

    return quantityInOrder + quantityToAdd <= product.stockQuantity;
  }

  private internalOrderAddress(): string {
    const table = this.internalOrderForm.table.trim();

    if (this.internalOrderType() === 'Entrega') {
      return this.internalOrderForm.address.trim();
    }

    if (this.internalOrderType() === 'Retirada') {
      return 'Retirada no balcao';
    }

    return table ? `Mesa ${table}` : 'Consumo no estabelecimento';
  }

  private internalOrderNote(): string | null {
    const note = this.internalOrderForm.note.trim();
    return note || null;
  }

  private generateInternalOrderPhone(): string {
    return `INT-${Date.now().toString().slice(-12)}`;
  }

  protected openAddNeighborhoodFee(): void {
    this.editingNeighborhoodFeeId.set(null);
    this.neighborhoodFeeForm = { neighborhood: '', fee: 0, isActive: true };
    this.showNeighborhoodFeeForm.set(true);
  }

  protected editNeighborhoodFee(nf: NeighborhoodDeliveryFeeDto): void {
    this.editingNeighborhoodFeeId.set(nf.id);
    this.neighborhoodFeeForm = { neighborhood: nf.neighborhood, fee: nf.fee, isActive: nf.isActive };
    this.showNeighborhoodFeeForm.set(true);
  }

  protected cancelNeighborhoodFeeForm(): void {
    this.showNeighborhoodFeeForm.set(false);
    this.editingNeighborhoodFeeId.set(null);
  }

  protected saveNeighborhoodFee(): void {
    if (!this.neighborhoodFeeForm.neighborhood.trim()) return;

    const editingId = this.editingNeighborhoodFeeId();
    const request = editingId !== null
      ? this.api.updateNeighborhoodDeliveryFee(editingId, this.neighborhoodFeeForm)
      : this.api.createNeighborhoodDeliveryFee(this.neighborhoodFeeForm);

    request.subscribe({
      next: () => {
        this.neighborhoodFeeSaved.set(true);
        this.errorMessage.set('');
        window.setTimeout(() => this.neighborhoodFeeSaved.set(false), 3000);
        this.cancelNeighborhoodFeeForm();
        this.loadNeighborhoodFees();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel salvar a taxa de bairro.'));
      },
    });
  }

  protected deleteNeighborhoodFee(id: number): void {
    this.api.deleteNeighborhoodDeliveryFee(id).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.loadNeighborhoodFees();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel excluir a taxa de bairro.'));
      },
    });
  }

  private loadNeighborhoodFees(): void {
    this.api.getNeighborhoodDeliveryFees().subscribe({
      next: (fees) => this.neighborhoodFees.set(fees),
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar as taxas por bairro.'));
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
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar o estabelecimento.'));
        this.isLoadingEstablishment.set(false);
      },
    });
  }

  private loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar as categorias.'));
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
        this.productsPage.set(
          Math.min(this.productsPage(), Math.max(1, Math.ceil(result.items.length / PRODUCTS_PER_PAGE))),
        );
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

  private loadClients(): void {
    this.isLoadingClients.set(true);

    this.api.getClients(1, 1000).subscribe({
      next: (result) => {
        this.clients.set(result.items);
        this.clientsPage.set(
          Math.min(this.clientsPage(), Math.max(1, Math.ceil(result.items.length / CLIENTS_PER_PAGE))),
        );
        this.isLoadingClients.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar os clientes.'));
        this.isLoadingClients.set(false);
      },
    });
  }

  private loadOrders(options: { silent?: boolean } = {}): void {
    const silent = options.silent ?? false;

    if (silent) {
      this.isRefreshingOrders.set(true);
    } else {
      this.isLoadingOrders.set(true);
    }

    this.api.getOrders(
      1,
      1000,
      this.filterDate() || undefined,
      this.orderSearch() || undefined,
      this.activeOrdersOnly(),
    ).subscribe({
      next: (result) => {
        this.orders.set(result.items);
        this.ordersPage.set(
          Math.min(this.ordersPage(), Math.max(1, Math.ceil(result.items.length / ORDERS_PER_PAGE))),
        );
        this.ordersLastUpdatedAt.set(this.formatRefreshTime());
        this.isLoadingOrders.set(false);
        this.isRefreshingOrders.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (!silent) {
          this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar os pedidos.'));
        }

        this.isLoadingOrders.set(false);
        this.isRefreshingOrders.set(false);
      },
    });
  }

  private scheduleOrdersReload(): void {
    if (this.ordersFilterTimer) {
      clearTimeout(this.ordersFilterTimer);
    }

    this.ordersFilterTimer = setTimeout(() => this.loadOrders(), 350);
  }

  private startOrdersAutoRefresh(): void {
    this.ordersAutoRefreshTimer = setInterval(() => {
      this.loadOrders({ silent: true });
    }, ORDERS_AUTO_REFRESH_MS);
  }

  private formatRefreshTime(): string {
    return new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getApiErrorMessage(error, 'Nao foi possivel carregar as integracoes.'));
        this.isLoadingIntegrations.set(false);
      },
    });
  }

  private normalizeStatus(status: string): OrderStatus {
    switch (status.toLowerCase()) {
      case 'empreparo':
        return 'em_preparo';
      case 'ementrega':
        return 'em_entrega';
      case 'ematraso':
      case 'em_atraso':
        return 'em_atraso';
      case 'entregue':
        return 'entregue';
      case 'cancelado':
        return 'cancelado';
      default:
        return 'pendente';
    }
  }

  private normalizeSource(source: string): OrderSource {
    switch (source.toLowerCase()) {
      case 'whatsapp':
        return 'whatsapp';
      case 'ifood':
        return 'ifood';
      case 'interno':
        return 'interno';
      default:
        return 'site';
    }
  }

  private normalizeOrderType(orderType: string): OrderType {
    switch (orderType.toLowerCase()) {
      case 'consumolocal':
      case 'consumo_local':
        return 'consumolocal';
      case 'retirada':
        return 'retirada';
      default:
        return 'entrega';
    }
  }

  private normalizeStockStatus(status: string): string {
    const normalized = status.toLowerCase();
    return ['untracked', 'available', 'low', 'out'].includes(normalized) ? normalized : 'available';
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const details = this.getApiErrorDetails(error);
    return details ? `${fallback} ${details}` : fallback;
  }

  private getApiErrorDetails(error: HttpErrorResponse): string {
    const payload = error.error as {
      error?: string;
      errors?: { propertyName?: string; errorMessage?: string }[];
    } | null;
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
    if (!errors?.length) return '';

    return errors
      .map((item) => [item.propertyName, item.errorMessage].filter(Boolean).join(': '))
      .join('; ');
  }
}
