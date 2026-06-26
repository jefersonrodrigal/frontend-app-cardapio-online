import { CurrencyPipe, NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { ClientAuthService } from '../../core/client-auth.service';
import { CategoryDto, ClientDto, CreateOrderPayload, EstablishmentDto, ProductDto } from '../../core/api.models';

interface DeliveryAddressParts {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
}

const MENU_ITEMS_PER_PAGE = 6;

@Component({
  selector: 'app-home',
  imports: [CurrencyPipe, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly api = inject(ApiService);
  private readonly cartService = inject(CartService);
  private readonly clientAuth = inject(ClientAuthService);

  protected readonly establishment = signal<EstablishmentDto | null>(null);
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly products = signal<ProductDto[]>([]);
  protected readonly authenticatedClient = signal<ClientDto | null>(null);
  protected readonly cart = this.cartService.items;
  protected readonly isCartOpen = this.cartService.isOpen;
  protected readonly customerName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly deliveryZipCode = signal('');
  protected readonly deliveryNumber = signal('');
  protected readonly deliveryComplement = signal('');
  protected readonly cartStep = signal(1);
  protected readonly address = signal('');
  protected readonly showNameWarning = signal(false);
  protected readonly showPhoneWarning = signal(false);
  protected readonly showZipCodeWarning = signal(false);
  protected readonly showNumberWarning = signal(false);
  protected readonly showAddressWarning = signal(false);
  protected readonly isSubmittingOrder = signal(false);
  protected readonly isLoadingZipCode = signal(false);
  protected readonly toastMessage = signal('');
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  private lastDeliveryZipLookup = '';
  private deliveryAddressParts: DeliveryAddressParts | null = null;

  protected readonly categoryPages = signal<Record<string, number>>({});
  protected readonly categorySections = computed(() => {
    const categories = this.categories();
    const products = this.products();
    return categories
      .filter((cat) => products.some((p) => p.category === cat.slug))
      .map((cat) => ({
        category: cat,
        products: products.filter((p) => p.category === cat.slug),
      }));
  });

  protected readonly isRestaurantOpen = computed(() => this.checkRestaurantOpen());
  protected readonly cartCount = this.cartService.count;
  protected readonly cartTotal = this.cartService.total;
  protected readonly cartDeliveryFee = this.cartService.deliveryFee;
  protected readonly cartGrandTotal = this.cartService.grandTotal;
  protected readonly cartEyebrow = computed(() =>
    this.cartStep() === 1 ? 'Pedido' : 'Cliente e entrega',
  );
  protected readonly cartTitle = computed(() =>
    this.cartStep() === 1 ? 'Meu carrinho' : 'Seus dados',
  );
  protected readonly itemsStepClass = computed(() =>
    this.cartStep() === 1 ? 'cart-modal__step cart-modal__step--active' : 'cart-modal__step',
  );
  protected readonly dataStepClass = computed(() =>
    this.cartStep() === 2 ? 'cart-modal__step cart-modal__step--active' : 'cart-modal__step',
  );

  constructor() {
    effect(() => {
      if (!this.isCartOpen()) {
        return;
      }

      this.cartStep.set(1);
      this.syncAuthenticatedClientData();
    });

    this.restoreClientSession();
    this.loadData();
  }

  protected readonly isClientAuthenticated = computed(() => this.authenticatedClient() !== null);

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  protected addToCart(item: ProductDto): void {
    if (!this.cartService.add(item)) {
      this.showToast(this.stockLimitMessage(item), true);
      return;
    }

    this.showToast('Item adicionado ao carrinho.');
  }

  protected removeFromCart(productId: string): void {
    this.cartService.remove(productId);
  }

  protected incrementInCart(productId: string): void {
    const product = this.products().find((p) => p.id === productId);
    if (product) {
      if (!this.cartService.add(product)) {
        this.showToast(this.stockLimitMessage(product), true);
      }
    }
  }

  protected deleteFromCart(productId: string): void {
    this.cartService.delete(productId);
  }

  protected getCategoryPage(slug: string): number {
    return this.categoryPages()[slug] ?? 1;
  }

  protected getCategoryTotalPages(slug: string): number {
    const section = this.categorySections().find((s) => s.category.slug === slug);
    return section ? Math.max(1, Math.ceil(section.products.length / MENU_ITEMS_PER_PAGE)) : 1;
  }

  protected getCategoryPageNumbers(slug: string): number[] {
    return this.visiblePageNumbers(this.getCategoryPage(slug), this.getCategoryTotalPages(slug));
  }

  protected getPaginatedProducts(slug: string): ProductDto[] {
    const section = this.categorySections().find((s) => s.category.slug === slug);
    if (!section) return [];
    return this.paginateItems(section.products, this.getCategoryPage(slug));
  }

  protected setCategoryPage(slug: string, page: number): void {
    const total = this.getCategoryTotalPages(slug);
    this.categoryPages.update((pages) => ({ ...pages, [slug]: this.clampPage(page, total) }));
  }

  protected canAddProduct(item: ProductDto): boolean {
    return !item.trackInventory || item.stockQuantity > 0;
  }

  protected stockBadgeClass(item: ProductDto): string {
    return `menu-card__stock menu-card__stock--${this.normalizeStockStatus(item.stockStatus)}`;
  }

  protected stockLabel(item: ProductDto): string {
    const status = this.normalizeStockStatus(item.stockStatus);

    if (status === 'untracked') {
      return 'Disponivel';
    }

    if (status === 'out') {
      return 'Esgotado';
    }

    if (status === 'low') {
      return `Ultimas ${item.stockQuantity} un.`;
    }

    return `${item.stockQuantity} un.`;
  }

  protected isCartItemAtStockLimit(item: { trackInventory: boolean; stockQuantity: number; quantity: number }): boolean {
    return item.trackInventory && item.quantity >= item.stockQuantity;
  }

  protected openCart(): void {
    this.cartService.open();
  }

  protected closeCart(): void {
    this.cartStep.set(1);
    this.cartService.close();
  }

  protected goToCartStep(step: number): void {
    this.cartStep.set(step === 2 ? 2 : 1);
  }

  protected logoutClient(): void {
    this.clientAuth.clearSession();
    this.authenticatedClient.set(null);
    this.customerName.set('');
    this.customerPhone.set('');
    this.deliveryZipCode.set('');
    this.deliveryNumber.set('');
    this.deliveryComplement.set('');
    this.address.set('');
    this.showToast('Sessao do cliente encerrada.');
  }

  protected updateCustomerName(value: string): void {
    this.customerName.set(value);

    if (value.trim()) {
      this.showNameWarning.set(false);
    }
  }

  protected updateCustomerPhone(value: string): void {
    this.customerPhone.set(value);

    if (value.trim()) {
      this.showPhoneWarning.set(false);
    }
  }

  protected updateAddress(value: string): void {
    this.address.set(value);
    this.deliveryAddressParts = null;

    if (value.trim()) {
      this.showAddressWarning.set(false);
    }
  }

  protected updateDeliveryNumber(value: string): void {
    this.deliveryNumber.set(value);

    if (value.trim()) {
      this.showNumberWarning.set(false);
    }

    if (this.deliveryAddressParts) {
      this.address.set(this.formatDeliveryAddress(this.deliveryAddressParts, value));
      this.showAddressWarning.set(false);
    }
  }

  protected updateDeliveryComplement(value: string): void {
    this.deliveryComplement.set(value);

    if (this.deliveryAddressParts) {
      this.deliveryAddressParts = {
        ...this.deliveryAddressParts,
        complement: value,
      };
      this.address.set(this.formatDeliveryAddress(this.deliveryAddressParts, this.deliveryNumber()));
      this.showAddressWarning.set(false);
    }
  }

  protected updateDeliveryZipCode(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    this.deliveryZipCode.set(this.formatZipCode(digits));

    if (digits.length > 0) {
      this.showZipCodeWarning.set(false);
    }

    if (digits.length !== 8 || digits === this.lastDeliveryZipLookup) {
      return;
    }

    this.lastDeliveryZipLookup = digits;
    this.isLoadingZipCode.set(true);

    this.api.lookupAddressByCep(digits).subscribe({
      next: (response) => {
        this.isLoadingZipCode.set(false);

        if (response.erro) {
          this.lastDeliveryZipLookup = '';
          this.showToast('CEP nao encontrado. Confira os numeros informados.', true);
          return;
        }

        this.deliveryAddressParts = {
          street: response.logradouro ?? '',
          neighborhood: response.bairro ?? '',
          city: response.localidade ?? '',
          state: response.uf ?? '',
          zipCode: response.cep ?? this.deliveryZipCode(),
          complement: this.deliveryComplement().trim() || response.complemento || '',
        };
        this.deliveryComplement.set(this.deliveryAddressParts.complement);
        this.address.set(this.formatDeliveryAddress(this.deliveryAddressParts, this.deliveryNumber()));
        this.showAddressWarning.set(false);
      },
      error: () => {
        this.isLoadingZipCode.set(false);
        this.lastDeliveryZipLookup = '';
        this.showToast('Nao foi possivel consultar o CEP informado.', true);
      },
    });
  }

  protected checkout(): void {
    if (!this.isRestaurantOpen()) {
      this.showToast('O restaurante esta fechado no momento.', true);
      return;
    }

    if (this.cart().length === 0) {
      return;
    }

    const unavailableItem = this.cart().find((item) => item.trackInventory && item.quantity > item.stockQuantity);
    if (unavailableItem) {
      this.showToast(`Quantidade indisponivel para ${unavailableItem.name}.`, true);
      this.loadData();
      return;
    }

    const hasName = this.customerName().trim().length > 0;
    const hasPhone = this.customerPhone().trim().length > 0;
    const hasZipCode = this.deliveryZipCode().trim().length > 0;
    const hasNumber = this.deliveryNumber().trim().length > 0;
    const hasAddress = this.address().trim().length > 0;

    this.showNameWarning.set(!hasName);
    this.showPhoneWarning.set(!hasPhone);
    this.showZipCodeWarning.set(!hasZipCode);
    this.showNumberWarning.set(!hasNumber);
    this.showAddressWarning.set(!hasAddress);

    if (!hasName || !hasPhone || !hasZipCode || !hasNumber || !hasAddress) {
      return;
    }

    const payload: CreateOrderPayload = {
      clientName: this.customerName().trim(),
      clientPhone: this.customerPhone().trim(),
      address: this.address().trim(),
      source: 'site',
      orderType: 'Entrega',
      items: this.cart().map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    };

    this.isSubmittingOrder.set(true);

    this.api.createOrder(payload).subscribe({
      next: (order) => {
        this.isSubmittingOrder.set(false);
        this.cartService.clear();
        if (!this.authenticatedClient()) {
          this.customerName.set('');
          this.customerPhone.set('');
          this.deliveryZipCode.set('');
          this.deliveryNumber.set('');
          this.deliveryComplement.set('');
          this.address.set('');
          this.deliveryAddressParts = null;
        } else {
          this.deliveryZipCode.set(this.authenticatedClient()?.zipCode ?? '');
          this.deliveryNumber.set(this.authenticatedClient()?.number ?? '');
          this.deliveryComplement.set(this.authenticatedClient()?.complement ?? '');
          this.address.set(this.authenticatedClient()?.fullAddress ?? '');
          this.deliveryAddressParts = null;
        }
        this.showNameWarning.set(false);
        this.showPhoneWarning.set(false);
        this.showZipCodeWarning.set(false);
        this.showNumberWarning.set(false);
        this.showAddressWarning.set(false);
        this.closeCart();
        this.showToast(`Pedido ${order.number} enviado com sucesso.`);
        this.loadData();
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmittingOrder.set(false);
        this.showToast(this.getApiErrorMessage(error, 'Nao foi possivel finalizar o pedido.'), true);
        this.loadData();
      },
    });
  }

  private checkRestaurantOpen(): boolean {
    const establishment = this.establishment();
    if (!establishment) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMinute] = establishment.openTime.split(':').map(Number);
    const [closeHour, closeMinute] = establishment.closeTime.split(':').map(Number);
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    if (openMinutes === closeMinutes) {
      return true;
    }

    if (openMinutes < closeMinutes) {
      return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  private showToast(message: string, isError = false): void {
    this.toastMessage.set(message);
    document.documentElement.style.setProperty('--toast-color', isError ? '#b91c1c' : '#15803d');

    window.setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set('');
      }
    }, 3000);
  }

  private stockLimitMessage(item: ProductDto): string {
    if (item.trackInventory && item.stockQuantity <= 0) {
      return `${item.name} esta esgotado.`;
    }

    return `Estoque maximo atingido para ${item.name}.`;
  }

  private normalizeStockStatus(status: string): string {
    const normalized = status.toLowerCase();
    return ['untracked', 'out', 'low', 'available'].includes(normalized) ? normalized : 'available';
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const payload = error.error as { error?: string } | null;
    return payload?.error || fallback;
  }

  private restoreClientSession(): void {
    const client = this.clientAuth.getSession();
    if (!client) {
      return;
    }

    this.authenticatedClient.set(client);
    this.syncAuthenticatedClientData();
  }

  private syncAuthenticatedClientData(): void {
    const client = this.clientAuth.getSession();
    if (!client) {
      return;
    }

    this.authenticatedClient.set(client);
    this.customerName.set(client.name);
    this.customerPhone.set(client.phone);
    this.deliveryZipCode.set(client.zipCode);
    this.deliveryNumber.set(client.number);
    this.deliveryComplement.set(client.complement);
    this.address.set(client.fullAddress);
    this.deliveryAddressParts = null;
  }

  private formatZipCode(value: string): string {
    if (value.length <= 5) {
      return value;
    }

    return `${value.slice(0, 5)}-${value.slice(5)}`;
  }

  private formatDeliveryAddress(parts: DeliveryAddressParts, number: string): string {
    const formattedParts = [
      [parts.street, number.trim()].filter(Boolean).join(', '),
      parts.neighborhood,
      [parts.city, parts.state].filter(Boolean).join(' - '),
      parts.zipCode ? `CEP ${parts.zipCode}` : '',
    ].filter((part) => part.trim().length > 0);

    const address = formattedParts.join(', ');
    return parts.complement.trim() ? `${address} (${parts.complement.trim()})` : address;
  }

  private paginateItems(items: ProductDto[], page: number): ProductDto[] {
    const startIndex = (page - 1) * MENU_ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + MENU_ITEMS_PER_PAGE);
  }

  private clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(page, 1), totalPages);
  }

  private visiblePageNumbers(current: number, total: number): number[] {
    const delta = 2;
    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    let pending = 2;

    const done = () => {
      pending--;
      if (pending === 0) this.isLoading.set(false);
    };

    this.api.getEstablishment().subscribe({
      next: (establishment) => {
        this.establishment.set(establishment);
        this.cartService.deliveryFee.set(establishment.deliveryFee ?? 0);
      },
      error: () => {
        this.loadError.set('Nao foi possivel carregar os dados do estabelecimento.');
      },
    });

    this.api.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        done();
      },
      error: () => {
        this.loadError.set('Nao foi possivel carregar as categorias do cardapio.');
        done();
      },
    });

    this.api.getProducts(1, 100).subscribe({
      next: (result) => {
        this.products.set(result.items);
        done();
      },
      error: () => {
        this.loadError.set('Nao foi possivel carregar o cardapio.');
        done();
      },
    });
  }
}
