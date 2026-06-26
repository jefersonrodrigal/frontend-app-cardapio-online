import { CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { OrderTrackingDto } from '../../core/api.models';
import {
  ORDER_STATUS_STEPS,
  isFinalOrderStatus,
  orderStatusIndex,
  orderStatusLabel,
} from '../../core/order-status';

const TRACKING_REFRESH_MS = 8000;

@Component({
  selector: 'app-order-tracking',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.css',
})
export class OrderTracking implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private routeSubscription?: Subscription;
  private refreshHandle?: ReturnType<typeof setInterval>;

  protected readonly steps = ORDER_STATUS_STEPS;
  protected readonly order = signal<OrderTrackingDto | null>(null);
  protected readonly orderId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly lastUpdated = signal('');

  constructor() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      this.orderId.set(params.get('id') ?? '');
      this.loadOrder(true);
      this.restartPolling();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.stopPolling();
  }

  protected refresh(): void {
    this.loadOrder(false);
  }

  protected statusLabel(status: string): string {
    return orderStatusLabel(status);
  }

  protected statusPillClass(status: string): string {
    if (status === 'Cancelado') {
      return 'status-pill status-pill--cancelled';
    }

    if (status === 'Entregue') {
      return 'status-pill status-pill--done';
    }

    return 'status-pill';
  }

  protected stepClass(index: number): string {
    const status = this.order()?.status ?? '';

    if (status === 'Cancelado') {
      return index === 0 ? 'tracking-step tracking-step--cancelled' : 'tracking-step';
    }

    const currentIndex = orderStatusIndex(status);
    if (index < currentIndex) {
      return 'tracking-step tracking-step--done';
    }

    if (index === currentIndex) {
      return 'tracking-step tracking-step--active';
    }

    return 'tracking-step';
  }

  private loadOrder(showLoading: boolean): void {
    const id = this.orderId();
    if (!id) {
      this.isLoading.set(false);
      this.errorMessage.set('Pedido nao informado.');
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.api.getOrderTracking(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.errorMessage.set('');
        this.isLoading.set(false);
        this.lastUpdated.set(this.formatTime(new Date()));

        if (isFinalOrderStatus(order.status)) {
          this.stopPolling();
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.error ?? 'Nao foi possivel carregar o acompanhamento.');
      },
    });
  }

  private restartPolling(): void {
    this.stopPolling();
    this.refreshHandle = setInterval(() => {
      const status = this.order()?.status ?? '';
      if (isFinalOrderStatus(status)) {
        this.stopPolling();
        return;
      }

      this.loadOrder(false);
    }, TRACKING_REFRESH_MS);
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
