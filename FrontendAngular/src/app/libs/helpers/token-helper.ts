import { environment } from "../../../environments/environment";
import { IApiToken } from "../models/types";

class InternalTokenHelper {
  getToken(): IApiToken | null {
    const str = localStorage.getItem(environment.keys.apiToken);
    if (!str) return null;
    try {
      const token = JSON.parse(str) as IApiToken;
      if (token.accessToken && token.refreshToken) {
        return token;
      }
      return null;
    } catch {
      return null;
    }
  }

  setToken(token: IApiToken | null) {
    if (token) {
      localStorage.setItem(environment.keys.apiToken, JSON.stringify(token));
    } else {
      localStorage.removeItem(environment.keys.apiToken);
    }
  }

  clearToken() {
    localStorage.removeItem(environment.keys.apiToken);
  }
}

export const TokenHelper = new InternalTokenHelper();
