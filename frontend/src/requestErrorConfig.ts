/**
 * Umi Request 错误与响应处理
 * 与后端约定：{ code: 200, message, data }，401 清除 token 并跳转登录，403 统一提示并跳转欢迎页
 */
import { message } from 'antd';
import { history } from '@umijs/max';

const AUTH_TOKEN_KEY = 'auth_token';
const loginPath = '/user/login';
const welcomePath = '/welcome';

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
      const status = error?.response?.status;
      if (status === 401) {
        clearAuthToken();
        history.push(loginPath);
        return;
      }
      if (status === 403) {
        const msg = error?.response?.data?.message || error?.message || '没有访问权限';
        message.error(msg);
        history.push(welcomePath);
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
      // 4xx 若仍进入成功回调，在此统一 403 提示、跳转欢迎页并抛出
      if (response?.status === 403) {
        const msg = response?.data?.message || '没有访问权限';
        message.error(msg);
        history.push(welcomePath);
        const err: any = new Error(msg);
        err.response = response;
        err.data = response?.data;
        throw err;
      }
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
    // 第二个拦截器会收到上一拦截器的返回值：成功时为 response，失败时为 thrown error。
    // 仅当收到错误对象（带 response 属性）时按错误处理并 throw，否则透传成功响应，避免登录等成功请求被误判失败。
    (errorOrResponse: any) => {
      if (errorOrResponse?.response != null) {
        const status = errorOrResponse.response.status;
        if (status === 403) {
          const msg = errorOrResponse.response?.data?.message || errorOrResponse?.message || '没有访问权限';
          message.error(msg);
          history.push(welcomePath);
        }
        throw errorOrResponse;
      }
      return errorOrResponse;
    },
  ],
};
