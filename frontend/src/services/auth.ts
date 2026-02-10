import { request } from '@umijs/max';
import { setAuthToken } from '../requestErrorConfig';

/** 当前用户信息 */
export async function queryCurrentUser(): Promise<API.CurrentUser | null> {
  const data = await request<API.CurrentUser>('/auth/me', { method: 'GET' });
  return data ?? null;
}

/** 登录，成功后写入 token，返回 user */
export async function login(
  body: { username: string; password: string }
): Promise<API.LoginResult> {
  const data = await request<API.LoginResult>('/auth/login', {
    method: 'POST',
    data: body,
  });
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data!;
}

/** 登出并撤销服务端 token */
export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}
