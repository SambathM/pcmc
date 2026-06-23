import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { AppStateService } from '../../libs/services/app-state.service';
import { ThemeSwitcherComponent } from '../../shared/theme-switcher/theme-switcher.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, ThemeSwitcherComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  constructor(
    readonly state: AppStateService,
  ) { }

  showNotificationDrawer = signal(false);

  readonly navItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'pi-gauge', badgeFn: () => 0 },
    { label: 'Telegram Accounts', route: '/telegram-accounts', icon: 'pi-send', badgeFn: () => this.state.connectedCount() },
    { label: 'Locations', route: '/locations', icon: 'pi-map-marker', badgeFn: () => 0 },
    { label: 'Units', route: '/units', icon: 'pi-th-large', badgeFn: () => 0 },
    { label: 'Residents', route: '/residents', icon: 'pi-users', badgeFn: () => 0 },
    { label: 'Services', route: '/services', icon: 'pi-briefcase', badgeFn: () => 0 },
    { label: 'Accounts Receivable', route: '/ar', icon: 'pi-credit-card', badgeFn: () => this.state.overdueCount() },
    { label: 'Reminder Scheduler', route: '/reminder-scheduler', icon: 'pi-clock', badgeFn: () => 0 },
    { label: 'Message Center', route: '/message-center', icon: 'pi-comment', badgeFn: () => this.state.pendingCount() },
    { label: 'Reports', route: '/reports', icon: 'pi-chart-bar', badgeFn: () => 0 },
    { label: 'Administration', route: '/administration', icon: 'pi-sliders-h', badgeFn: () => 0 },
  ];

  logout(): void {
    this.state.logout();
  }
}
