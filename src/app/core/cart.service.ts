import { Injectable, computed, signal } from '@angular/core';
import { ProductDto } from './api.models';

export interface CartItemAdditional {
  additionalItemId: string;
  groupName: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  cartKey: string;
  productId: string;
  name: string;
  price: number;
  originalPrice: number;
  isOnPromotion: boolean;
  additionalsPrice: number;
  additionals: CartItemAdditional[];
  quantity: number;
  trackInventory: boolean;
  stockQuantity: number;
}

function buildCartKey(productId: string, additionals: CartItemAdditional[]): string {
  if (additionals.length === 0) return productId;
  const parts = additionals
    .map(a => `${a.additionalItemId}:${a.quantity}`)
    .sort()
    .join(',');
  return `${productId}|${parts}`;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>([]);
  readonly isOpen = signal(false);
  readonly deliveryFee = signal(0);
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + (item.price + item.additionalsPrice) * item.quantity, 0),
  );
  readonly grandTotal = computed(() =>
    this.items().length > 0 ? this.total() + this.deliveryFee() : 0,
  );

  add(item: ProductDto, additionals: CartItemAdditional[] = []): boolean {
    if (item.trackInventory && item.stockQuantity <= 0) {
      return false;
    }

    const effectivePrice =
      item.isOnPromotion && item.promotionalPrice ? item.promotionalPrice : item.price;
    const additionalsPrice = additionals.reduce((sum, a) => sum + a.price * a.quantity, 0);
    const cartKey = buildCartKey(item.id, additionals);

    let added = false;

    this.items.update((currentCart) => {
      const existingItem = currentCart.find((ci) => ci.cartKey === cartKey);

      if (existingItem) {
        if (item.trackInventory && existingItem.quantity >= item.stockQuantity) {
          return currentCart;
        }

        added = true;
        return currentCart.map((ci) =>
          ci.cartKey === cartKey
            ? { ...ci, quantity: ci.quantity + 1, trackInventory: item.trackInventory, stockQuantity: item.stockQuantity }
            : ci,
        );
      }

      added = true;
      return [
        ...currentCart,
        {
          cartKey,
          productId: item.id,
          name: item.name,
          price: effectivePrice,
          originalPrice: item.price,
          isOnPromotion: item.isOnPromotion && !!item.promotionalPrice,
          additionalsPrice,
          additionals,
          quantity: 1,
          trackInventory: item.trackInventory,
          stockQuantity: item.stockQuantity,
        },
      ];
    });

    return added;
  }

  incrementByKey(cartKey: string, stockLimit: number, trackInventory: boolean): boolean {
    let added = false;
    this.items.update((currentCart) => {
      const item = currentCart.find((ci) => ci.cartKey === cartKey);
      if (!item) return currentCart;
      if (trackInventory && item.quantity >= stockLimit) return currentCart;

      added = true;
      return currentCart.map((ci) =>
        ci.cartKey === cartKey ? { ...ci, quantity: ci.quantity + 1 } : ci,
      );
    });
    return added;
  }

  remove(cartKey: string): void {
    this.items.update((currentCart) => {
      const item = currentCart.find((ci) => ci.cartKey === cartKey);
      if (!item) return currentCart;
      if (item.quantity === 1) return currentCart.filter((ci) => ci.cartKey !== cartKey);
      return currentCart.map((ci) =>
        ci.cartKey === cartKey ? { ...ci, quantity: ci.quantity - 1 } : ci,
      );
    });
  }

  delete(cartKey: string): void {
    this.items.update((currentCart) => currentCart.filter((ci) => ci.cartKey !== cartKey));
  }

  clear(): void {
    this.items.set([]);
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
