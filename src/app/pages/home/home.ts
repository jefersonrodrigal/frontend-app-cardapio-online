import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { ClientAuthService } from '../../core/client-auth.service';
import { ClientDto, CreateOrderPayload, EstablishmentDto, ProductDto } from '../../core/api.models';

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
  protected readonly burgersPage = signal(1);
  protected readonly drinksPage = signal(1);
  protected readonly burgers = computed(() =>
    this.products().filter((item) => item.category === 'hamburguer'),
  );
  protected readonly drinks = computed(() =>
    this.products().filter((item) => item.category === 'bebida'),
  );
  protected readonly totalBurgerPages = computed(() =>
    Math.max(1, Math.ceil(this.burgers().length / MENU_ITEMS_PER_PAGE)),
  );
  protected readonly totalDrinkPages = computed(() =>
    Math.max(1, Math.ceil(this.drinks().length / MENU_ITEMS_PER_PAGE)),
  );
  protected readonly paginatedBurgers = computed(() =>
    this.paginateItems(this.burgers(), this.burgersPage()),
  );
  protected readonly paginatedDrinks = computed(() =>
    this.paginateItems(this.drinks(), this.drinksPage()),
  );
  protected readonly burgerPageNumbers = computed(() =>
    this.visiblePageNumbers(this.burgersPage(), this.totalBurgerPages()),
  );
  protected readonly drinkPageNumbers = computed(() =>
    this.visiblePageNumbers(this.drinksPage(), this.totalDrinkPages()),
  );
  protected readonly isRestaurantOpen = computed(() => this.checkRestaurantOpen());
  protected readonly cartCount = this.cartService.count;
  protected readonly cartTotal = this.cartService.total;

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

  protected addToCart(item: ProductDto): void {
    this.cartService.add(item);
    this.showToast('Item adicionado ao carrinho.');
  }

  protected removeFromCart(productId: string): void {
    this.cartService.remove(productId);
  }

  protected incrementInCart(productId: string): void {
    const product = this.products().find((p) => p.id === productId);
    if (product) {
      this.cartService.add(product);
    }
  }

  protected deleteFromCart(productId: string): void {
    this.cartService.delete(productId);
  }

  protected setBurgersPage(page: number): void {
    this.burgersPage.set(this.clampPage(page, this.totalBurgerPages()));
  }

  protected setDrinksPage(page: number): void {
    this.drinksPage.set(this.clampPage(page, this.totalDrinkPages()));
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
      },
      error: () => {
        this.isSubmittingOrder.set(false);
        this.showToast('Nao foi possivel finalizar o pedido.', true);
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

    this.api.getEstablishment().subscribe({
      next: (establishment) => {
        this.establishment.set(establishment);
      },
      error: () => {
        this.loadError.set('Nao foi possivel carregar os dados do estabelecimento.');
        this.isLoading.set(false);
      },
    });

    this.api.getProducts(1, 100).subscribe({
      next: (result) => {
        this.products.set(result.items);
        this.burgersPage.set(1);
        this.drinksPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Nao foi possivel carregar o cardapio.');
        this.isLoading.set(false);
      },
    });
  }
}
