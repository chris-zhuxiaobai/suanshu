/**
 * Umi Request 错误与响应处理
 * 与后端约定：{ code: 200, message, data }，401 清除 token 并跳转登录
 */
import { history } from '@umijs/max';

const AUTH_TOKEN_KEY = 'auth_token';
const loginPath = '/user/login';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string, persist = true): void {
  if (persist) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export const requestErrorConfig = {
  errorConfig: {
    errorHandler(error: any) {
      if (error?.response?.status === 401) {
        clearAuthToken();
        history.push(loginPath);
      }
    },
  },
  requestInterceptors: [
    (config: any) => {
      const token = getAuthToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
  ],
  responseInterceptors: [
    (response: any) => {
      const { data } = response;
      if (data && typeof data === 'object' && 'data' in data) {
        if (data.code !== undefined && data.code !== 200 && data.code !== 0) {
          const err: any = new Error(data.message || '请求失败');
          err.response = response;
          err.data = data;
          throw err;
        }
        response.data = data.data;
      }
      return response;
    },
  ],
};
