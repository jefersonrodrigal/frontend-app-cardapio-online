import { HttpErrorResponse, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  function runInterceptor(
    request: HttpRequest<unknown>,
    next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>,
  ) {
    return TestBed.runInInjectionContext(() => authInterceptor(request, next));
  }

  it('anexa o token apenas em rotas protegidas da API', (done) => {
    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['token', 'isAuthenticated', 'logout']);
    authSpy.token.and.returnValue('secret-token');
    authSpy.isAuthenticated.and.returnValue(true);
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const protectedRequest = new HttpRequest('GET', 'http://localhost:5115/api/Clients?page=1');

    runInterceptor(protectedRequest, (handledRequest) => {
      expect(handledRequest.headers.get('Authorization')).toBe('Bearer secret-token');
      return of(new HttpResponse({ status: 200 }));
    }).subscribe({
      next: () => done(),
      error: done.fail,
    });
  });

  it('nao anexa o token em chamadas publicas ou externas', (done) => {
    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['token', 'isAuthenticated', 'logout']);
    authSpy.token.and.returnValue('secret-token');
    authSpy.isAuthenticated.and.returnValue(true);
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const publicRequests = [
      new HttpRequest('POST', 'http://localhost:5115/api/Clients/authenticate', null),
      new HttpRequest('POST', 'http://localhost:5115/api/Orders', null),
      new HttpRequest('GET', 'https://viacep.com.br/ws/01001000/json/'),
    ];

    let completedRequests = 0;

    publicRequests.forEach((request) => {
      runInterceptor(request, (handledRequest) => {
        expect(handledRequest.headers.has('Authorization')).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      }).subscribe({
        next: () => {
          completedRequests += 1;
          if (completedRequests === publicRequests.length) {
            done();
          }
        },
        error: done.fail,
      });
    });
  });

  it('encerra a sessao apenas quando um 401 vem de rota protegida', (done) => {
    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['token', 'isAuthenticated', 'logout']);
    authSpy.token.and.returnValue('secret-token');
    authSpy.isAuthenticated.and.returnValue(true);
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    const protectedRequest = new HttpRequest('GET', 'http://localhost:5115/api/Orders?page=1');
    const publicRequest = new HttpRequest('POST', 'http://localhost:5115/api/Clients/authenticate', null);
    const unauthorizedResponse = new HttpErrorResponse({ status: 401 });

    runInterceptor(protectedRequest, () => throwError(() => unauthorizedResponse)).subscribe({
      next: () => done.fail('Expected a 401 error for protected route'),
      error: () => {
        expect(authSpy.logout).toHaveBeenCalledTimes(1);
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);

        runInterceptor(publicRequest, () => throwError(() => unauthorizedResponse)).subscribe({
          next: () => done.fail('Expected a 401 error for public route'),
          error: () => {
            expect(authSpy.logout).toHaveBeenCalledTimes(1);
            done();
          },
        });
      },
    });
  });
});
