import { Injectable, computed, signal } from '@angular/core';
import { ProductDto } from './api.models';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>([]);
  readonly isOpen = signal(false);
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0));

  add(item: ProductDto): void {
    this.items.update((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
        );
      }

      return [...currentCart, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  remove(productId: string): void {
    this.items.update((currentCart) => {
      const item = currentCart.find((cartItem) => cartItem.id === productId);

      if (!item) {
        return currentCart;
      }

      if (item.quantity === 1) {
        return currentCart.filter((cartItem) => cartItem.id !== productId);
      }

      return currentCart.map((cartItem) =>
        cartItem.id === productId ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem,
      );
    });
  }

  delete(productId: string): void {
    this.items.update((currentCart) => currentCart.filter((item) => item.id !== productId));
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
