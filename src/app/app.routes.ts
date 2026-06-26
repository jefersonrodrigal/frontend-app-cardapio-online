import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'acesso-cliente',
    loadComponent: () => import('./pages/cliente-login/cliente-login').then((m) => m.ClienteLogin),
  },
  {
    path: 'my-orders',
    loadComponent: () => import('./pages/my-orders/my-orders').then((m) => m.MyOrders),
  },
  {
    path: 'order-tracking/:id',
    loadComponent: () => import('./pages/order-tracking/order-tracking').then((m) => m.OrderTracking),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./pages/cadastro/cadastro').then((m) => m.Cadastro),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
  },
];
