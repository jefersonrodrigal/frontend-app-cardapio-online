import { Injectable, signal } from '@angular/core';
import { ClientAuthResponse, ClientDto } from './api.models';

const STORAGE_KEY = 'cardapio_online_client_session';

interface StoredClientSession {
  client: ClientDto;
  token: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class ClientAuthService {
  private readonly sessionState = signal<StoredClientSession | null>(this.readStoredSession());

  getSession(): ClientDto | null {
    return this.sessionState()?.client ?? null;
  }

  token(): string {
    const session = this.sessionState();
    if (!session?.token || !session.expiresAt) {
      return '';
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.clearSession();
      return '';
    }

    return session.token;
  }

  storeSession(response: ClientAuthResponse): void {
    const session: StoredClientSession = {
      client: response.client,
      token: response.token,
      expiresAt: response.expiresAt,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionState.set(session);
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionState.set(null);
  }

  isAuthenticated(): boolean {
    return this.token().length > 0;
  }

  private readStoredSession(): StoredClientSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredClientSession | ClientDto;

      if (this.isStoredClientSession(parsed)) {
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }

        return parsed;
      }

      localStorage.removeItem(STORAGE_KEY);
      return null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private isStoredClientSession(value: StoredClientSession | ClientDto): value is StoredClientSession {
    return 'client' in value && 'token' in value && 'expiresAt' in value;
  }

}
