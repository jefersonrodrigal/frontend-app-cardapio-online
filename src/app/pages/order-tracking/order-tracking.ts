import { CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EstablishmentDto, OrderTrackingDto } from '../../core/api.models';
import {
  OrderStatusStep,
  isFinalOrderStatus,
  orderStatusIndex,
  orderStatusLabel,
  orderStatusSteps,
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

  protected readonly order = signal<OrderTrackingDto | null>(null);
  protected readonly establishment = signal<EstablishmentDto | null>(null);
  protected readonly orderId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isConfirmingDelivery = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly actionErrorMessage = signal('');
  protected readonly lastUpdated = signal('');

  constructor() {
    this.loadEstablishment();

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

  protected statusSteps(status: string): OrderStatusStep[] {
    return orderStatusSteps(status);
  }

  protected statusPillClass(status: string): string {
    if (status === 'Cancelado') {
      return 'status-pill status-pill--cancelled';
    }

    if (status === 'Entregue') {
      return 'status-pill status-pill--done';
    }

    if (status === 'EmAtraso') {
      return 'status-pill status-pill--delayed';
    }

    return 'status-pill';
  }

  protected stepClass(index: number): string {
    const status = this.order()?.status ?? '';

    if (status === 'Cancelado') {
      return index === 0 ? 'tracking-step tracking-step--cancelled' : 'tracking-step';
    }

    const currentIndex = orderStatusIndex(status, this.statusSteps(status));
    if (index < currentIndex) {
      return 'tracking-step tracking-step--done';
    }

    if (index === currentIndex && status === 'EmAtraso') {
      return 'tracking-step tracking-step--delayed';
    }

    if (index === currentIndex) {
      return 'tracking-step tracking-step--active';
    }

    return 'tracking-step';
  }

  protected canContactEstablishmentOnWhatsApp(): boolean {
    return this.order()?.status === 'EmAtraso' && !!this.establishmentWhatsApp();
  }

  protected confirmDelivery(): void {
    const order = this.order();

    if (!order?.canClientConfirmDelivery || this.isConfirmingDelivery()) {
      return;
    }

    this.isConfirmingDelivery.set(true);
    this.actionErrorMessage.set('');

    this.api.confirmOrderDelivered(order.id).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.isConfirmingDelivery.set(false);
        this.lastUpdated.set(this.formatTime(new Date()));
        this.stopPolling();
      },
      error: (error) => {
        this.isConfirmingDelivery.set(false);
        this.actionErrorMessage.set(error?.error?.error ?? 'Nao foi possivel marcar o pedido como entregue.');
      },
    });
  }

  protected contactEstablishmentOnWhatsApp(): void {
    const order = this.order();
    const phone = this.establishmentWhatsApp();

    if (!order || !phone) {
      return;
    }

    const message = encodeURIComponent(
      `Ola, estou acompanhando o pedido ${order.number} e ele aparece como em atraso. Poderiam me atualizar?`,
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener');
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
        this.actionErrorMessage.set('');
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

  private loadEstablishment(): void {
    this.api.getEstablishment().subscribe({
      next: (establishment) => {
        this.establishment.set(establishment);
      },
    });
  }

  private establishmentWhatsApp(): string {
    const rawPhone = this.establishment()?.whatsapp ?? '';
    const digits = rawPhone.replace(/\D/g, '');

    if (!digits) {
      return '';
    }

    return digits.startsWith('55') || digits.length > 11 ? digits : `55${digits}`;
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
