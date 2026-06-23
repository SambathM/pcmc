import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MenuItem } from 'primeng/api';
import { PanelMenuModule } from 'primeng/panelmenu';
import { AdminBillRulesComponent } from './sub-views/admin-bill-rules/admin-bill-rules.component';
import { AdminSystemInfoComponent } from './sub-views/admin-system-info/admin-system-info.component';

// Maps each view key to the label of its parent group.
// Used to auto-expand the correct accordion panel when navigating.
const VIEW_GROUP: Record<string, string> = {
  'bill-rules': 'Bill Management',
  'users': 'User Management',
  'user-roles': 'User Management',
  'system-info': 'System',
};

@Component({
  selector: 'app-administration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelMenuModule, AdminBillRulesComponent, AdminSystemInfoComponent],
  templateUrl: './administration.component.html',
  styleUrl: './administration.component.scss',
})
export class AdministrationComponent {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.activeView.set(params.get('view') ?? '');
    });
  }

  activeView = signal('');

  readonly menu = computed<MenuItem[]>(() => {
    const view = this.activeView();
    const activeGroup = VIEW_GROUP[view] ?? '';

    const leaf = (label: string, icon: string, viewKey: string): MenuItem => ({
      label,
      icon,
      styleClass: viewKey === view ? 'adm-item--active' : '',
      command: () => this.navigate(viewKey),
    });

    return [
      {
        label: 'Bill Management',
        icon: 'pi pi-credit-card',
        // Default to open when no view is selected yet
        expanded: activeGroup === 'Bill Management' || view === '',
        items: [
          leaf('Bill Rules', 'pi pi-sliders-v', 'bill-rules'),
        ],
      },
      {
        label: 'User Management',
        icon: 'pi pi-users',
        expanded: activeGroup === 'User Management',
        items: [
          leaf('Users', 'pi pi-user', 'users'),
          leaf('User Roles', 'pi pi-shield', 'user-roles'),
        ],
      },
      {
        label: 'System',
        icon: 'pi pi-desktop',
        expanded: activeGroup === 'System',
        items: [
          leaf('System Info', 'pi pi-info-circle', 'system-info'),
        ],
      },
    ];
  });

  private navigate(view: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
    });
  }
}
