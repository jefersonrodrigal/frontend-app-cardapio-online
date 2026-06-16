import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../core/cart.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);

  protected readonly cartCount = this.cartService.count;

  protected openCart(): void {
    if (this.router.url.startsWith('/home')) {
      this.cartService.open();
      return;
    }

    void this.router.navigate(['/home']).then((navigated) => {
      if (navigated) {
        this.cartService.open();
      }
    });
  }
}
