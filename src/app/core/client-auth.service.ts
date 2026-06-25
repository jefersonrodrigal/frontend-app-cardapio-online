import { Injectable } from '@angular/core';
import { ClientDto } from './api.models';

const STORAGE_KEY = 'cardapio_online_client_session';

@Injectable({ providedIn: 'root' })
export class ClientAuthService {
  getSession(): ClientDto | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ClientDto;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  storeSession(client: ClientDto): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(client));
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
}
