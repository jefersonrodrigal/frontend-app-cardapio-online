import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected credentials = {
    email: '',
    password: '',
  };

  protected login(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.api.login(this.credentials).subscribe({
      next: (response) => {
        this.auth.storeSession(response);
        this.isSubmitting.set(false);
        this.router.navigate(['/admin']);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('E-mail ou senha invalidos.');
      },
    });
  }
}
