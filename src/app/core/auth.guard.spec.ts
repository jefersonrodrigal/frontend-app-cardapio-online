import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { adminAuthGuard } from './auth.guard';

describe('adminAuthGuard', () => {
  it('permite acesso quando o admin esta autenticado', () => {
    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    authSpy.isAuthenticated.and.returnValue(true);
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => adminAuthGuard(null as never, null as never));

    expect(result).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redireciona para login quando o admin nao esta autenticado', () => {
    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    authSpy.isAuthenticated.and.returnValue(false);
    const loginTree = {} as ReturnType<Router['createUrlTree']>;
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(loginTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const result = TestBed.runInInjectionContext(() => adminAuthGuard(null as never, null as never));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(loginTree);
  });
});
