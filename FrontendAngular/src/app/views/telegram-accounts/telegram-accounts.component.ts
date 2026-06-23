import { Component, OnInit, OnDestroy, signal, ViewEncapsulation } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { SignalrService, TgEvent, QrChangePayload } from '../../libs/services/signalr.service';
import { TelegramAccount, TelegramSession, TgQrCodeResponse, Location, CountryEntry } from '../../libs/models/types';
import { SharedModules } from '../../libs/modules/shared-modules';
import { COUNTRIES } from '../../data/initial-data';

function sessionToAccount(session: TelegramSession): TelegramAccount {
  const rawName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim();
  const name = rawName || session.userName || `Account ${session.id}`;
  const username = session.userName
    ? (session.userName.startsWith('@') ? session.userName : '@' + session.userName)
    : '';
  return {
    id: String(session.id),
    name,
    username,
    phone: session.phoneNumber ?? '',
    status: session.isAuthorized ? 'Connected' : 'Disconnected',
    isDefault: true,
    logo: session.profilePhoto,
  };
}


const GRADIENTS = [
  'tg-grad-indigo',
  'tg-grad-emerald',
  'tg-grad-purple',
  'tg-grad-amber',
  'tg-grad-blue',
];

@Component({
  selector: 'app-telegram-accounts',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './telegram-accounts.component.html',
  styleUrl: './telegram-accounts.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class TelegramAccountsComponent implements OnInit, OnDestroy {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
    private readonly signalr: SignalrService,

  ) { }

  accounts = signal<TelegramAccount[]>([]);

  searchQuery = '';
  isLoadingAccounts = true;
  showConnectModal = false;
  connectSuccess = false;
  loginTab: 'qr' | 'phone' = 'phone';
  qrData: TgQrCodeResponse | null = null;
  qrDataUrl = '';
  isLoadingQr = false;
  phoneStep: 'idle' | 'code' | '2fa' = 'idle';
  verificationCode = '';
  twoFaPassword = '';
  connectError = '';
  isConnecting = false;
  qrStep: 'qr' | 'password' = 'qr';
  qrPassword = '';
  newAccountName = '';
  newAccountPhone = '';

  // Multi-session: the id of the CURRENT login attempt (QR or phone). Success/2FA is resolved
  // against this specific instance, never against the global "current session".
  currentInstanceId: string | null = null;
  attachedLocationsModal: { accountName: string; locationsList: Location[] } | null = null;

  readonly countries = COUNTRIES;
  selectedCountry: CountryEntry = this.countries.find(c => c.default === true) ?? this.countries[0];
  keepSignedIn = true;

  private qrPollRef: ReturnType<typeof setInterval> | null = null;

  get filteredAccounts(): TelegramAccount[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.accounts();
    return this.accounts().filter(
      (a) => a.name.toLowerCase().includes(q) || a.phone.toLowerCase().includes(q),
    );
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  getGradient(name: string): string {
    return GRADIENTS[name.length % GRADIENTS.length];
  }

  getAttachedLocs(acc: TelegramAccount): Location[] {
    return this.state
      .locations()
      .filter(
        (l) =>
          l.assignedTelegramSession?.userName === acc.username ||
          l.assignedTelegramSession?.phoneNumber === acc.phone,
      );
  }

  private onQrChange = (payload: QrChangePayload) => {
    if (this.qrData) {
      this.qrData = { ...this.qrData, qrCode: payload.qrCode };
      void this.generateQrDataUrl(payload.qrCode);
    }
    this.connectError = '';
  };

  private onQrTimeout = () => {
    this.stopQrPoll();
    this.connectError = 'QR code expired. Click "Refresh QR" to generate a new one.';
  };

  private onPasswordState = () => {
    this.qrStep = 'password';
  };

  private onLoggedIn = (session: TelegramSession) => {
    this.stopQrPoll();
    const acc = sessionToAccount(session);
    this.accounts.update((prev) => [acc, ...prev.filter((a) => a.id !== acc.id)]);
    this.state.telegramSessions.update((prev) => [
      session,
      ...prev.filter((s) => s.id !== session.id),
    ]);
    this.connectSuccess = true;
    this.showConnectModal = true;
    setTimeout(() => {
      this.showConnectModal = false;
      this.connectSuccess = false;
    }, 1400);
    this.state.addActivity(
      'Telegram Account Connected',
      `Connected ${acc.name} (${acc.phone}) as active collection operator.`,
      'success',
    );
  };

  private onDisconnected = () => {
    this.accounts.update((prev) => prev.map((a) => ({ ...a, status: 'Disconnected' as const })));
    this.state.addActivity('Telegram Disconnected', 'Session disconnected by server.', 'warning');
  };

  ngOnInit(): void {
    this.isLoadingAccounts = true;
    this.api
      .sessions()
      .then((sessions) => {
        this.accounts.set(sessions.map(sessionToAccount));
        this.state.telegramSessions.set(sessions);
      })
      .catch(() => {
        this.accounts.set([]);
        this.state.telegramSessions.set([]);
      })
      .finally(() => {
        this.isLoadingAccounts = false;
      });

    this.api
      .clientId()
      .then((groupName) => this.signalr.connect(groupName))
      .catch(() => { });

    const off = this.signalr.off.bind(this.signalr) as (
      e: string,
      cb: (...a: unknown[]) => void,
    ) => void;
    void off; // referenced below in ngOnDestroy via same pattern for on()
    this.signalr.on<QrChangePayload>(TgEvent.QrChange, this.onQrChange);
    this.signalr.on(TgEvent.QrTimeout, this.onQrTimeout as (...a: unknown[]) => void);
    this.signalr.on(TgEvent.PasswordState, this.onPasswordState as (...a: unknown[]) => void);
    this.signalr.on<TelegramSession>(TgEvent.LoggedIn, this.onLoggedIn);
    this.signalr.on<TelegramSession>(TgEvent.Authorized, this.onLoggedIn);
    this.signalr.on(TgEvent.Disconnected, this.onDisconnected as (...a: unknown[]) => void);
  }

  ngOnDestroy(): void {
    this.stopQrPoll();
    const off = (e: string, cb: unknown) =>
      this.signalr.off(e, cb as (...a: unknown[]) => void);
    off(TgEvent.QrChange, this.onQrChange);
    off(TgEvent.QrTimeout, this.onQrTimeout);
    off(TgEvent.PasswordState, this.onPasswordState);
    off(TgEvent.LoggedIn, this.onLoggedIn);
    off(TgEvent.Authorized, this.onLoggedIn);
    off(TgEvent.Disconnected, this.onDisconnected);
    this.signalr.disconnect();
    this.revokeQrUrl();
  }

  handleSetDefault(id: string): void {
    const target = this.accounts().find((a) => a.id === id);
    this.accounts.update((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    if (target) {
      this.state.addActivity(
        'Default Telegram Account Set',
        `Collection broadcasts defaulted to ${target.name} (${target.username})`,
        'info',
      );
    }
  }

  handleDisconnect(id: string): void {
    const target = this.accounts().find((a) => a.id === id);
    this.api.disconnect().catch(() => { });
    this.accounts.update((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Disconnected' as const, isDefault: false } : a)),
    );
    if (target) {
      this.state.addActivity(
        'Telegram Disconnected',
        `Severed active API session link for ${target.name}`,
        'warning',
      );
    }
  }

  startConnectNew(): void {
    this.newAccountName = '';
    this.newAccountPhone = '';
    this.loginTab = 'phone';
    this.phoneStep = 'idle';
    this.verificationCode = '';
    this.twoFaPassword = '';
    this.connectError = '';
    this.qrData = null;
    this.qrDataUrl = '';
    this.qrStep = 'qr';
    this.qrPassword = '';
    this.currentInstanceId = null;
    this.connectSuccess = false;
    this.showConnectModal = true;
  }

  handleModalClose(): void {
    this.stopQrPoll();
    this.currentInstanceId = null;
    this.showConnectModal = false;
    this.connectSuccess = false;
  }

  onDialogHide(): void {
    this.stopQrPoll();
    this.currentInstanceId = null;
    this.connectSuccess = false;
  }

  switchToQrTab(): void {
    this.loginTab = 'qr';
    this.connectError = '';
    if (!this.qrData) void this.handleFetchQrCode();
  }

  async handleFetchQrCode(): Promise<void> {
    this.isLoadingQr = true;
    this.connectError = '';
    this.qrStep = 'qr';
    this.qrPassword = '';
    try {
      const data = await this.api.qrCode();
      this.qrData = data;
      this.currentInstanceId = data.instanceId;
      await this.generateQrDataUrl(data.qrCode);
      this.stopQrPoll();
      this.qrPollRef = setInterval(() => {
        // Poll THIS attempt's instance only — never the global current session.
        if (!this.currentInstanceId) return;
        this.api
          .loginStatus(this.currentInstanceId)
          .then((session) => {
            if (session?.isAuthorized) {
              this.stopQrPoll();
              this.handleConnectSuccess(session);
            }
          })
          .catch(() => { });
      }, 3000);
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : 'Failed to load QR code';
    } finally {
      this.isLoadingQr = false;
    }
  }

  async handlePhoneSubmit(): Promise<void> {
    const localNum = this.newAccountPhone.replace(/\D/g, '');
    if (!localNum) {
      this.connectError = 'Phone number is required';
      return;
    }
    const phone = this.selectedCountry.code + localNum;
    this.isConnecting = true;
    this.connectError = '';
    try {
      const state = await this.api.loginPhone(phone);
      // Backend returns this attempt's instance id in `message` on the WAIT_FOR_SERVER path.
      if (state.message) this.currentInstanceId = state.message;
      this.phoneStep = state.state === 1 ? '2fa' : 'code';
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : 'Failed to send code';
    } finally {
      this.isConnecting = false;
    }
  }

  async handleCodeSubmit(): Promise<void> {
    if (!this.verificationCode.trim()) {
      this.connectError = 'Verification code is required';
      return;
    }
    if (!this.currentInstanceId) {
      this.connectError = 'Login session expired. Please start again.';
      return;
    }
    this.isConnecting = true;
    this.connectError = '';
    try {
      const res = await this.api.submitPhoneCode(this.verificationCode, this.currentInstanceId);
      if (res.status) {
        const session = this.currentInstanceId ? await this.api.loginStatus(this.currentInstanceId) : null;
        if (session?.isAuthorized) {
          this.handleConnectSuccess(session);
        } else {
          this.phoneStep = '2fa';
        }
      } else {
        this.connectError = res.message || 'Invalid code';
      }
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : 'Failed to verify code';
    } finally {
      this.isConnecting = false;
    }
  }

  async handle2faSubmit(): Promise<void> {
    if (!this.twoFaPassword.trim()) {
      this.connectError = 'Password is required';
      return;
    }
    if (!this.currentInstanceId) {
      this.connectError = 'Login session expired. Please start again.';
      return;
    }
    this.isConnecting = true;
    this.connectError = '';
    try {
      const res = await this.api.submitPhonePassword(this.twoFaPassword, this.currentInstanceId);
      if (res.status) {
        const session = this.currentInstanceId ? await this.api.loginStatus(this.currentInstanceId) : null;
        if (session) this.handleConnectSuccess(session);
      } else {
        this.connectError = res.message || 'Invalid password';
      }
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : 'Failed to verify password';
    } finally {
      this.isConnecting = false;
    }
  }

  async handleQrPasswordSubmit(): Promise<void> {
    if (!this.qrPassword.trim()) {
      this.connectError = 'Password is required';
      return;
    }
    if (!this.qrData) return;
    this.isConnecting = true;
    this.connectError = '';
    try {
      const res = await this.api.submitQrPassword(this.qrPassword, this.qrData.instanceId);
      if (res.status) {
        const session = await this.api.loginStatus(this.qrData.instanceId);
        if (session) this.handleConnectSuccess(session);
      } else {
        this.connectError = res.message || 'Invalid password';
      }
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : 'Failed to submit password';
    } finally {
      this.isConnecting = false;
    }
  }

  private handleConnectSuccess(session: TelegramSession): void {
    this.stopQrPoll();
    this.currentInstanceId = null;
    const acc = sessionToAccount(session);
    if (this.newAccountName.trim()) acc.name = this.newAccountName.trim();
    this.accounts.update((prev) => [acc, ...prev.filter((a) => a.id !== acc.id)]);
    this.state.telegramSessions.update((prev) => [
      session,
      ...prev.filter((s) => s.id !== session.id),
    ]);
    this.connectSuccess = true;
    setTimeout(() => {
      this.showConnectModal = false;
      this.connectSuccess = false;
    }, 1400);
    this.state.addActivity(
      'Telegram Account Connected',
      `Registered ${acc.name} (${acc.phone}) as active collection operator.`,
      'success',
    );
  }

  private stopQrPoll(): void {
    if (this.qrPollRef) {
      clearInterval(this.qrPollRef);
      this.qrPollRef = null;
    }
  }

  private async generateQrDataUrl(qrCode: string): Promise<void> {
    try {
      const { default: QRCodeStyling } = await import('qr-code-styling');
      // Telegram-style: rounded module dots, light colour, transparent background so the
      // purple glass shows through, and the Telegram logo baked into the centre with a
      // cleared halo. Level 'H' keeps it scannable despite the centre logo.
      const styled = new QRCodeStyling({
        width: 320,
        height: 320,
        type: 'canvas',
        data: qrCode,
        margin: 6,
        qrOptions: { errorCorrectionLevel: 'H' },
        image: '/logos/telegram.svg',
        imageOptions: { crossOrigin: 'anonymous', hideBackgroundDots: true, imageSize: 0.22, margin: 4 },
        dotsOptions: { type: 'rounded', color: '#f5f3ff' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#f5f3ff' },
        cornersDotOptions: { type: 'dot', color: '#f5f3ff' },
        backgroundOptions: { color: 'transparent' },
      });
      const blob = (await styled.getRawData('png')) as Blob | null;
      this.revokeQrUrl();
      this.qrDataUrl = blob ? URL.createObjectURL(blob) : '';
    } catch {
      this.revokeQrUrl();
      this.qrDataUrl = '';
    }
  }

  private revokeQrUrl(): void {
    if (this.qrDataUrl.startsWith('blob:')) URL.revokeObjectURL(this.qrDataUrl);
  }
}
