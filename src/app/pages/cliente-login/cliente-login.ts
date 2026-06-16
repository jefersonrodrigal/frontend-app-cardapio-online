import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ClientAuthService } from '../../core/client-auth.service';

@Component({
  selector: 'app-cliente-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './cliente-login.html',
  styleUrl: './cliente-login.css',
})
export class ClienteLogin {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly clientAuth = inject(ClientAuthService);

  protected readonly isSubmitting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected credentials = {
    email: '',
    password: '',
  };

  protected login(): void {
    this.isSubmitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.api.authenticateClient(this.credentials).subscribe({
      next: (client) => {
        this.clientAuth.storeSession(client);
        this.isSubmitting.set(false);
        this.successMessage.set('Acesso liberado. Redirecionando para o cardapio...');
        window.setTimeout(() => {
          void this.router.navigate(['/home']);
        }, 800);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.error ?? 'Nao foi possivel autenticar seu acesso.');
      },
    });
  }
}
