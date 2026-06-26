import { CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ClientDto, OrderDto } from '../../core/api.models';
import { ClientAuthService } from '../../core/client-auth.service';
import {
  ORDER_STATUS_STEPS,
  orderStatusIndex,
  orderStatusLabel,
} from '../../core/order-status';

const ORDERS_REFRESH_MS = 10000;

@Component({
  selector: 'app-my-orders',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrders implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly clientAuth = inject(ClientAuthService);
  private readonly route = inject(ActivatedRoute);
  private routeSubscription?: Subscription;
  private refreshHandle?: ReturnType<typeof setInterval>;

  protected readonly steps = ORDER_STATUS_STEPS;
  protected readonly client = signal<ClientDto | null>(this.clientAuth.getSession());
  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly selectedOrderId = signal('');
  protected readonly lastUpdated = signal('');

  constructor() {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.selectedOrderId.set(params.get('order') ?? '');
    });

    this.loadOrders(true);
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.stopPolling();
  }

  protected refresh(): void {
    this.loadOrders(false);
  }

  protected goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages());
    if (nextPage === this.page()) {
      return;
    }

    this.page.set(nextPage);
    this.loadOrders(true);
  }

  protected statusLabel(status: string): string {
    return orderStatusLabel(status);
  }

  protected statusPillClass(status: string): string {
    if (status === 'Cancelado') {
      return 'order-status order-status--cancelled';
    }

    if (status === 'Entregue') {
      return 'order-status order-status--done';
    }

    return 'order-status';
  }

  protected orderCardClass(order: OrderDto): string {
    return order.id === this.selectedOrderId()
      ? 'order-card order-card--selected'
      : 'order-card';
  }

  protected stepClass(order: OrderDto, index: number): string {
    if (order.status === 'Cancelado') {
      return index === 0 ? 'order-step order-step--cancelled' : 'order-step';
    }

    const currentIndex = orderStatusIndex(order.status);
    if (index < currentIndex) {
      return 'order-step order-step--done';
    }

    if (index === currentIndex) {
      return 'order-step order-step--active';
    }

    return 'order-step';
  }

  private loadOrders(showLoading: boolean): void {
    const currentClient = this.client();
    if (!currentClient) {
      this.isLoading.set(false);
      this.errorMessage.set('');
      return;
    }

    if (!this.clientAuth.token()) {
      this.errorMessage.set('Entre novamente para consultar seus pedidos.');
      this.isLoading.set(false);
      this.stopPolling();
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.api.getClientOrders(this.page(), 10).subscribe({
      next: (result) => {
        this.orders.set(result.items);
        this.totalPages.set(Math.max(1, result.totalPages));
        this.errorMessage.set('');
        this.isLoading.set(false);
        this.lastUpdated.set(this.formatTime(new Date()));
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.error ?? 'Nao foi possivel carregar seus pedidos.');

        if (error?.status === 401) {
          this.clientAuth.clearSession();
          this.client.set(null);
          this.stopPolling();
        }
      },
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.refreshHandle = setInterval(() => {
      if (!this.client() || !this.clientAuth.token()) {
        this.stopPolling();
        return;
      }

      this.loadOrders(false);
    }, ORDERS_REFRESH_MS);
  }

  private stopPolling(): void {
    if (this.refreshHandle) {
      clearInterval(this.refreshHandle);
      this.refreshHandle = undefined;
    }
  }

  private formatTime(value: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(value);
  }
}
