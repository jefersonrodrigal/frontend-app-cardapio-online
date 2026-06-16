import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Navbar } from './shared/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  private isPublicRoute(): boolean {
    const url = this.router.url;
    return url.startsWith('/home') || url.startsWith('/cadastro') || url.startsWith('/acesso-cliente');
  }

  protected readonly showNavbar = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.isPublicRoute()),
    ),
    { initialValue: this.isPublicRoute() },
  );
}
