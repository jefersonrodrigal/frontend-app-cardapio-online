import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { ClientAuthService } from '../../core/client-auth.service';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let component: Home;

  beforeEach(async () => {
    const apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getEstablishment',
      'getProducts',
      'lookupAddressByCep',
      'createOrder',
    ]);
    apiSpy.getEstablishment.and.returnValue(
      of({
        name: 'Lanchonete',
        logoUrl: '',
        category: 'hamburgueria',
        address: 'Rua A',
        whatsapp: '5511999999999',
        openTime: '18:00',
        closeTime: '22:00',
      }),
    );
    apiSpy.getProducts.and.returnValue(
      of({
        items: [],
        page: 1,
        pageSize: 100,
        total: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      }),
    );

    const clientAuthSpy = jasmine.createSpyObj<ClientAuthService>('ClientAuthService', [
      'getSession',
      'storeSession',
      'clearSession',
      'isAuthenticated',
    ]);
    clientAuthSpy.getSession.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        CartService,
        { provide: ApiService, useValue: apiSpy },
        { provide: ClientAuthService, useValue: clientAuthSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    try {
      jasmine.clock().uninstall();
    } catch {
      // Clock is only installed in specific specs.
    }
  });

  it('considera aberto quando o horario cruza a meia-noite e ainda esta dentro da janela', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-16T01:30:00'));

    (component as any).establishment.set({
      name: 'Noturno',
      logoUrl: '',
      category: 'hamburgueria',
      address: 'Rua B',
      whatsapp: '5511999999999',
      openTime: '18:00',
      closeTime: '02:00',
    });

    expect((component as any).isRestaurantOpen()).toBeTrue();
  });

  it('considera fechado quando o horario cruza a meia-noite mas a hora atual esta fora da janela', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-16T15:00:00'));

    (component as any).establishment.set({
      name: 'Noturno',
      logoUrl: '',
      category: 'hamburgueria',
      address: 'Rua B',
      whatsapp: '5511999999999',
      openTime: '18:00',
      closeTime: '02:00',
    });

    expect((component as any).isRestaurantOpen()).toBeFalse();
  });
});
