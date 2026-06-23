import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AppStateService, AppNotice } from '../services/app-state.service';
import { ApiService } from '../services/api.service';
import { TokenHelper } from '../helpers/token-helper';

// Single-flight refresh: concurrent 401s share one renew call. Resolves true (renewed)
// / false (refresh rejected with 401), or REJECTS when the renew call can't complete
// (offline / 404 / 5xx) — a rejection must NOT be read as an expired session.
let refreshInFlight: Promise<boolean> | null = null;
function refreshOnce(api: ApiService): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = api.renewAccessToken();
    refreshInFlight.finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// Auth endpoints must pass through untouched, otherwise a 401 here would recurse.
function isAuthEndpoint(url: string): boolean {
  return url.includes('/token/renew')
    || url.includes('/token/logout')
    || url.includes('/login/login');
}

// A connection failure / server-error response (not an auth problem).
function isConnectionError(err: HttpErrorResponse): boolean {
  return err.status === 0 || err.status === 404 || err.status >= 500;
}

// Classify the failure so the dialog can tell the user whether it's *their* network
// or the *server*, instead of always implying the backend is down.
function describeError(err: HttpErrorResponse): AppNotice {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (offline) {
    return {
      title: 'Network Problem',
      message: 'You appear to be offline. Please check your internet connection and try again.',
      icon: 'pi-wifi',
    };
  }
  if (err.status === 0) {
    // Network is up per the OS, but the request never reached the server — could be a
    // dropped connection or the server being unavailable. Stay neutral on the cause.
    return {
      title: 'Connection Problem',
      message: 'Couldn’t reach the server. Check your connection, or it may be temporarily unavailable — please try again.',
      icon: 'pi-exclamation-triangle',
    };
  }
  // The server responded but errored (404 / 5xx) — squarely a server-side problem.
  return {
    title: 'Server Problem',
    message: 'The server ran into a problem handling the request. Please try again shortly.',
    icon: 'pi-server',
  };
}

/**
 * 401 (access token expired) → renew + retry once. Only a renew that is itself
 * rejected with 401 (refresh token expired) drops the session and raises the login
 * dialog. Network / 4xx / 5xx errors — including a renew that can't reach the server
 * — keep the session and surface a persistent error dialog; they never log out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const state = inject(AppStateService);

  if (isAuthEndpoint(req.url)) return next(req);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Not an auth problem → surface it (dialog for unreachable/5xx), never log out.
      if (err.status !== 401) {
        if (isConnectionError(err)) state.notifyServerError(describeError(err));
        return throwError(() => err);
      }

      return from(refreshOnce(api)).pipe(
        switchMap(renewed => {
          if (renewed) {
            // Retry the original request once with the fresh access token.
            return next(req.clone({
              setHeaders: { Authorization: `Bearer ${TokenHelper.getToken()?.accessToken ?? ''}` },
            }));
          }
          // Renew returned false = refresh token expired/invalid → interactive login.
          TokenHelper.clearToken();
          state.requireLogin();
          return throwError(() => err);
        }),
        catchError((renewErr: unknown) => {
          // The renew call could not complete (offline / 404 / 5xx) — a server problem,
          // not an expired session. Keep the token, show the error dialog, no login.
          if (renewErr instanceof HttpErrorResponse && renewErr.status !== 401) {
            if (isConnectionError(renewErr)) state.notifyServerError(describeError(renewErr));
            return throwError(() => renewErr);
          }
          return throwError(() => err);
        }),
      );
    }),
  );
};
