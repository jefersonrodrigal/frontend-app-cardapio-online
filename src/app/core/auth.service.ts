import { Injectable, computed, signal } from '@angular/core';
import { LoginResponse } from './api.models';

const TOKEN_KEY = 'cardapio_online_admin_token';
const TOKEN_EXPIRY_KEY = 'cardapio_online_admin_token_expiry';
const USER_EMAIL_KEY = 'cardapio_online_admin_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenState = signal(localStorage.getItem(TOKEN_KEY) ?? '');
  private readonly emailState = signal(localStorage.getItem(USER_EMAIL_KEY) ?? '');
  private readonly expiryState = signal(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '');

  private readonly hasValidToken = computed(() => {
    const token = this.tokenState();
    const expiry = this.expiryState();

    if (!token || !expiry) {
      return false;
    }

    return new Date(expiry).getTime() > Date.now();
  });

  isAuthenticated(): boolean {
    return this.hasValidToken();
  }

  token(): string {
    return this.hasValidToken() ? this.tokenState() : '';
  }

  storeSession(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, response.expiresAt);
    localStorage.setItem(USER_EMAIL_KEY, response.email);

    this.tokenState.set(response.token);
    this.expiryState.set(response.expiresAt);
    this.emailState.set(response.email);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);

    this.tokenState.set('');
    this.expiryState.set('');
    this.emailState.set('');
  }
}
