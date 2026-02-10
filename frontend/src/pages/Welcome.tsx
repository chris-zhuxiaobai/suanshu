import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { Button, Card, Flex, Space, Typography } from 'antd';
import { clearAuthToken } from '../requestErrorConfig';
import { logout } from '../services/auth';

export default function WelcomePage() {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const appName = process.env.APP_NAME || '算数平台';
  const roleText =
    user?.role === 'admin'
      ? '常驻管理员'
      : user?.role === 'daily_admin'
        ? '日常管理员'
        : '查看者';

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearAuthToken();
      history.push('/user/login');
    }
  };

  return (
    <Flex vertical align="center" style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            欢迎使用{appName}
          </Typography.Title>
          <Button
            type="primary"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出登录
          </Button>
        </Flex>
        {user && (
          <Space size="middle" style={{ marginTop: 24 }}>
            <UserOutlined
              style={{ fontSize: 18, color: 'var(--ant-color-primary)' }}
            />
            <Typography.Text strong style={{ fontSize: 16 }}>
              {user.name}
            </Typography.Text>
            <Typography.Text type="secondary">
              （{user.username} · {roleText}）
            </Typography.Text>
          </Space>
        )}
      </Card>
    </Flex>
  );
}
