import { Component } from '@angular/core';
import { ConnectionService } from '../../libs/services/connection.service';

/** Sticky top warning strip driven by the central ConnectionService. */
@Component({
  selector: 'app-connection-banner',
  imports: [],
  templateUrl: './connection-banner.component.html',
  styleUrl: './connection-banner.component.scss',
})
export class ConnectionBannerComponent {
  constructor(private readonly connection: ConnectionService) { }

  get notice() {
    return this.connection.notice();
  }
}
