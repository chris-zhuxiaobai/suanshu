import '@ant-design/v5-patch-for-react-19';
import { LogoutOutlined, CalculatorOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { history } from '@umijs/max';
import { App as AntdApp, Dropdown, Button, Space } from 'antd';
import type { MenuProps } from 'antd';
import { useState } from 'react';
import defaultSettings from '../config/defaultSettings';
import { clearAuthToken, requestErrorConfig } from './requestErrorConfig';
import { logout } from './services/auth';
import { queryCurrentUser } from './services/auth';
import CalculatorModal from './components/CalculatorModal';
import access from './access';

const loginPath = '/user/login';
const welcomePath = '/welcome';

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

// 稳定的退出登录处理函数，避免每次 layout 调用时创建新函数
const handleLogout = async () => {
  try {
    await logout();
  } catch (error) {
    // 即使 API 调用失败，也清除本地 token
  } finally {
    clearAuthToken();
    history.push(loginPath);
  }
};

// 稳定的菜单项配置
const menuItems: MenuProps['items'] = [
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    onClick: handleLogout,
  },
];

// 头像区域包装组件（用于使用 hooks）
function AvatarRenderWrapper({ children }: { children: ReactNode }) {
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  return (
    <>
      <Space size="middle">
        <Button
          type="text"
          icon={<CalculatorOutlined />}
          onClick={() => setCalculatorOpen(true)}
          title="计算器"
        />
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          {children}
        </Dropdown>
      </Space>
      <CalculatorModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
    </>
  );
}

export const layout = ({ initialState }: { initialState?: InitialState }) => {
  const isExportAdmin = initialState?.currentUser?.role === 'export_admin';

  // 检查路径是否允许访问
  const canAccessPath = (pathname: string): boolean => {
    // 登录页和欢迎页始终可访问
    if (pathname === loginPath || pathname === welcomePath) {
      return true;
    }

    // 统计管理员只能访问欢迎页和统计模块
    if (isExportAdmin) {
      return pathname.startsWith('/statistics');
    }

    // 其他角色可以访问所有页面
    return true;
  };

  return {
    avatarProps: {
      title: initialState?.currentUser?.name,
      render: (_: unknown, avatarChildren: ReactNode) => {
        return <AvatarRenderWrapper>{avatarChildren}</AvatarRenderWrapper>;
      },
    },
    onPageChange: () => {
      const { pathname } = window.location;
      
      // 未登录用户跳转到登录页
      if (!initialState?.currentUser && pathname !== loginPath) {
        history.push(loginPath);
        return;
      }

      // 已登录用户检查权限
      if (initialState?.currentUser) {
        // 非统计管理员访问欢迎页时，自动跳转到工作台
        if (pathname === welcomePath && !isExportAdmin) {
          history.push('/dashboard/workspace');
          return;
        }

        // 检查访问权限
        if (!canAccessPath(pathname)) {
          // 统计管理员访问未授权页面时跳转到欢迎页
          history.push(welcomePath);
        }
      }
    },
    // 菜单数据渲染，过滤掉统计管理员不能访问的菜单
    menuDataRender: (menuData: any[]) => {
      if (!isExportAdmin) {
        return menuData;
      }
      
      // 统计管理员只能看到统计模块
      return menuData.filter((item) => {
        // 保留统计模块
        if (item.path?.startsWith('/statistics')) {
          return true;
        }
        // 过滤掉其他模块
        return false;
      });
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
