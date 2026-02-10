import '@ant-design/v5-patch-for-react-19';
import type { ReactNode } from 'react';
import { history } from '@umijs/max';
import { App as AntdApp } from 'antd';
import defaultSettings from '../config/defaultSettings';
import { clearAuthToken, requestErrorConfig } from './requestErrorConfig';
import { queryCurrentUser } from './services/auth';

const loginPath = '/user/login';

type InitialState = {
  currentUser?: API.CurrentUser;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
  settings?: Partial<typeof defaultSettings>;
};

export async function getInitialState(): Promise<InitialState> {
  const fetchUserInfo = async () => {
    try {
      const user = await queryCurrentUser();
      return user ?? undefined;
    } catch {
      clearAuthToken();
      history.push(loginPath);
      return undefined;
    }
  };

  const { pathname } = window.location;
  if (pathname !== loginPath) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser: currentUser ?? undefined,
      settings: defaultSettings as InitialState['settings'],
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as InitialState['settings'],
  };
}

export const layout = ({ initialState }: { initialState?: InitialState }) => {
  return {
    avatarProps: {
      title: initialState?.currentUser?.name,
      render: (_: unknown, avatarChildren: ReactNode) => avatarChildren,
    },
    onPageChange: () => {
      const { pathname } = window.location;
      if (!initialState?.currentUser && pathname !== loginPath) {
        history.push(loginPath);
      }
    },
    ...initialState?.settings,
  };
};

export const request = {
  baseURL: '/api',
  timeout: 30000,
  ...requestErrorConfig,
};

/**
 * 给整个应用注入 antd App 上下文，避免 message/notification 在动态主题下的告警
 */
export function rootContainer(container: ReactNode) {
  return <AntdApp>{container}</AntdApp>;
}
