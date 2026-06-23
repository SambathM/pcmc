import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./views/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'telegram-accounts', loadComponent: () => import('./views/telegram-accounts/telegram-accounts.component').then(m => m.TelegramAccountsComponent) },
      { path: 'locations', loadComponent: () => import('./views/locations/locations.component').then(m => m.LocationsComponent) },
      { path: 'residents', loadComponent: () => import('./views/residents/residents.component').then(m => m.ResidentsComponent) },
      { path: 'services', loadComponent: () => import('./views/services/services.component').then(m => m.ServicesComponent) },
      { path: 'units', loadComponent: () => import('./views/units/units.component').then(m => m.UnitsComponent) },
      { path: 'ar', loadComponent: () => import('./views/ar/ar.component').then(m => m.ArComponent) },
      { path: 'reminder-scheduler', loadComponent: () => import('./views/reminder-scheduler/reminder-scheduler.component').then(m => m.ReminderSchedulerComponent) },
      { path: 'message-center', loadComponent: () => import('./views/message-center/message-center.component').then(m => m.MessageCenterComponent) },
      { path: 'reports', loadComponent: () => import('./views/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'administration', loadComponent: () => import('./views/administration/administration.component').then(m => m.AdministrationComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
