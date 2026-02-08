/**
 * API 客户端封装
 * 基于 axios，提供统一的请求/响应处理和错误处理
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = '/api';

/**
 * API 响应数据结构
 */
export interface ApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data: T;
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number | string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 创建 axios 实例
 * 注意：响应拦截器会直接返回数据，而不是 AxiosResponse
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * 请求拦截器 - 统一添加认证信息
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 或 sessionStorage 获取 token
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    // 如果存在 token，添加到请求头
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 可以在这里添加其他通用 header
    // 例如：CSRF token、API 版本等
    // config.headers['X-CSRF-TOKEN'] = getCsrfToken();
    // config.headers['X-API-Version'] = 'v1';

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器 - 统一处理响应和错误
 */
apiClient.interceptors.response.use(
  (response) => {
    const { data } = response;

    // 如果后端返回的数据结构是 { code, message, data }
    // 可以根据实际后端格式调整
    if (data && typeof data === 'object' && 'code' in data) {
      // 如果后端定义了业务错误码（非 200）
      if (data.code !== undefined && data.code !== 200 && data.code !== 0) {
        throw new ApiError(
          data.message || '请求失败',
          response.status,
          data.code,
          data.data
        );
      }
      // 返回 data 字段
      return data.data !== undefined ? data.data : data;
    }

    // 直接返回数据
    return data;
  },
  (error: AxiosError) => {
    // 处理 HTTP 错误
    if (error.response) {
      const { status, data } = error.response;

      // 401 未授权 - 清除 token 并跳转登录
      if (status === 401) {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        // 可以在这里触发登录跳转
        // window.location.href = '/login';
      }

      // 403 禁止访问
      if (status === 403) {
        throw new ApiError(
          '没有权限访问该资源',
          status,
          'FORBIDDEN',
          data
        );
      }

      // 404 未找到
      if (status === 404) {
        throw new ApiError(
          '请求的资源不存在',
          status,
          'NOT_FOUND',
          data
        );
      }

      // 500 服务器错误
      if (status >= 500) {
        throw new ApiError(
          '服务器内部错误，请稍后重试',
          status,
          'SERVER_ERROR',
          data
        );
      }

      // 其他 HTTP 错误
      const errorData = data as { message?: string; code?: number | string } | null;
      throw new ApiError(
        errorData?.message || error.message || `HTTP ${status} 错误`,
        status,
        errorData?.code || status,
        errorData
      );
    }

    // 网络错误或请求超时
    if (error.request) {
      if (error.code === 'ECONNABORTED') {
        throw new ApiError('请求超时，请检查网络连接', 0, 'TIMEOUT');
      }
      throw new ApiError('网络连接失败，请检查网络', 0, 'NETWORK_ERROR');
    }

    // 其他错误
    throw new ApiError(
      error.message || '未知错误',
      0,
      'UNKNOWN_ERROR'
    );
  }
);

/**
 * API 请求方法封装
 */
export const api = {
  /**
   * GET 请求
   */
  get<T = unknown>(url: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return apiClient.get<T>(url, { params }) as Promise<T>;
  },

  /**
   * POST 请求
   */
  post<T = unknown>(url: string, data?: unknown): Promise<T> {
    return apiClient.post<T>(url, data) as Promise<T>;
  },

  /**
   * PUT 请求
   */
  put<T = unknown>(url: string, data?: unknown): Promise<T> {
    return apiClient.put<T>(url, data) as Promise<T>;
  },

  /**
   * PATCH 请求
   */
  patch<T = unknown>(url: string, data?: unknown): Promise<T> {
    return apiClient.patch<T>(url, data) as Promise<T>;
  },

  /**
   * DELETE 请求
   */
  delete<T = unknown>(url: string): Promise<T> {
    return apiClient.delete<T>(url) as Promise<T>;
  },

  /**
   * 上传文件
   */
  upload<T = unknown>(
    url: string,
    file: File | FormData,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const formData = file instanceof FormData ? file : new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    }

    return apiClient.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }) as Promise<T>;
  },
};

/**
 * 设置认证 token
 */
export function setAuthToken(token: string, persist: boolean = true): void {
  if (persist) {
    localStorage.setItem('auth_token', token);
  } else {
    sessionStorage.setItem('auth_token', token);
  }
}

/**
 * 清除认证 token
 */
export function clearAuthToken(): void {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
}

/**
 * 获取认证 token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

export default api;
