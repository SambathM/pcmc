import { Component, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AppStateService } from './libs/services/app-state.service';
import { LoginComponent } from './views/login/login.component';
import { ConnectionBannerComponent } from './shared/connection-banner/connection-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dialog, ButtonModule, ConnectionBannerComponent],
  providers: [DialogService],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  private loginRef: DynamicDialogRef | null = null;

  constructor(
    private readonly state: AppStateService,
    private readonly dialog: DialogService,
  ) {
    // Open / keep the login dialog whenever login is required, app-wide.
    effect(() => {
      if (this.state.loginRequired()) this.openLogin();
    });
  }

  private openLogin(): void {
    if (this.loginRef) return; // already showing — don't stack dialogs
    const ref = this.dialog.open(LoginComponent, {
      modal: true,
      closable: false,
      dismissableMask: false,
      closeOnEscape: false,
      showHeader: false,
      width: '26rem',
      styleClass: 'login-dialog',
      contentStyle: { padding: '0', overflow: 'visible' },
    });
    if (!ref) return;
    ref.onClose.subscribe(() => { this.loginRef = null; });
    this.loginRef = ref;
  }

  get isCheckingAuth() {
    return this.state.isCheckingAuth();
  }

  get serverError() {
    return this.state.serverError();
  }

  dismissError(): void {
    this.state.dismissServerError();
  }

  retry(): void {
    this.state.dismissServerError();
    window.location.reload();
  }
}
