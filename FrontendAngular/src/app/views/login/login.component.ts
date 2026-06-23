import { Component, Optional, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ApiService } from '../../libs/services/api.service';
import { AppStateService } from '../../libs/services/app-state.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  // Rendered as a global DynamicDialog; the ref is present when opened that way.
  constructor(
    private readonly api: ApiService,
    private readonly stateService: AppStateService,
    @Optional() private readonly dialogRef: DynamicDialogRef,
    @Optional() private readonly config: DynamicDialogRef,
  ) {
    // Support being opened without the DialogService (e.g. directly via router) for dev/testing.
  }


  username = '';
  password = '';
  error = signal('');
  loading = signal(false);
  showPassword = signal(false);

  async handleSubmit(): Promise<void> {
    if (!this.username.trim()) { this.error.set('Username is required.'); return; }
    if (!this.password) { this.error.set('Password is required.'); return; }
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await this.api.login(this.username, this.password);
      if (result.status) {
        this.stateService.onLoggedIn();
        this.dialogRef?.close(true);
      } else {
        this.error.set(result.message || 'Invalid username or password.');
      }
    } catch {
      this.error.set('Cannot reach the server. Check your connection or contact IT support.');
    } finally {
      this.loading.set(false);
    }
  }
}
