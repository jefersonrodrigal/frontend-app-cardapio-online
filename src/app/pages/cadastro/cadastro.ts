import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ClientAuthService } from '../../core/client-auth.service';

@Component({
  selector: 'app-cadastro',
  imports: [FormsModule, RouterLink],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.css',
})
export class Cadastro {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly clientAuth = inject(ClientAuthService);
  private lastLookupCep = '';

  protected readonly isSubmitting = signal(false);
  protected readonly isLoadingCep = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected form = {
    name: '',
    email: '',
    phone: '',
    zipCode: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
    password: '',
  };

  protected onZipCodeInput(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    this.form.zipCode = this.formatZipCode(digits);

    if (digits.length !== 8 || digits === this.lastLookupCep) {
      return;
    }

    this.lastLookupCep = digits;
    this.isLoadingCep.set(true);
    this.errorMessage.set('');

    this.api.lookupAddressByCep(digits).subscribe({
      next: (response) => {
        this.isLoadingCep.set(false);

        if (response.erro) {
          this.lastLookupCep = '';
          this.errorMessage.set('CEP nao encontrado. Confira os numeros informados.');
          return;
        }

        this.form.street = response.logradouro ?? '';
        this.form.neighborhood = response.bairro ?? '';
        this.form.city = response.localidade ?? '';
        this.form.state = response.uf ?? '';
        this.form.complement = response.complemento ?? '';
      },
      error: () => {
        this.isLoadingCep.set(false);
        this.lastLookupCep = '';
        this.errorMessage.set('Nao foi possivel consultar o CEP informado.');
      },
    });
  }

  protected submit(): void {
    this.isSubmitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.api.createClient(this.form).subscribe({
      next: (session) => {
        this.isSubmitting.set(false);
        this.clientAuth.storeSession(session);
        this.successMessage.set('Cadastro realizado com sucesso. Seu acesso ja foi liberado.');
        this.form = {
          name: '',
          email: '',
          phone: '',
          zipCode: '',
          street: '',
          number: '',
          neighborhood: '',
          city: '',
          state: '',
          complement: '',
          password: '',
        };
        this.lastLookupCep = '';
        window.setTimeout(() => {
          void this.router.navigate(['/home']);
        }, 1200);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.error ?? 'Nao foi possivel concluir seu cadastro.');
      },
    });
  }

  private formatZipCode(value: string): string {
    if (value.length <= 5) {
      return value;
    }

    return `${value.slice(0, 5)}-${value.slice(5)}`;
  }
}
