import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { login } from '@/services/auth';

// APP_NAME 由 Umi config.define 注入，已在常量处解析好
declare const APP_NAME: string;

type InitialStateShape = {
  currentUser?: API.CurrentUser;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
  settings?: {
    title?: string;
    [key: string]: unknown;
  };
};

type LoginFormValues = { username: string; password: string };

type ApiErrorLike = {
  response?: { data?: { message?: string; data?: Record<string, unknown> } };
  message?: string;
};

export default function LoginPage() {
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState') as {
    initialState?: InitialStateShape;
    setInitialState: (
      s:
        | InitialStateShape
        | ((prev: InitialStateShape | undefined) => InitialStateShape),
    ) => Promise<void> | void;
  };
  const appTitle = initialState?.settings?.title || APP_NAME;

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const result = await login({
        username: values.username,
        password: values.password,
      });
      message.success(`欢迎，${result.user.name}`);
      await setInitialState((prev) => ({
        ...(prev || {}),
        currentUser: result.user,
      }));
      const urlParams = new URL(window.location.href).searchParams.get('redirect');
      history.push(urlParams || '/welcome');
    } catch (error: unknown) {
      // Laravel ValidationException：{ code: 422, message, data: { field: [msg] } }
      const err = error as ApiErrorLike;
      const resp = err.response?.data as
        | { message?: string; data?: Record<string, unknown> }
        | undefined;
      const errors =
        resp?.data && typeof resp.data === 'object' ? resp.data : null;
      const firstError = errors
        ? (Object.values(errors).flat().find(Boolean) as string | undefined)
        : undefined;
      message.error(firstError || resp?.message || err.message || '登录失败');
      // 不再 rethrow，避免 dev overlay 报 “no stack trace”
      return;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: 360,
          borderRadius: 16,
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Typography.Title
          level={4}
          style={{ textAlign: 'center', marginBottom: 24 }}
        >
          登录 {appTitle}
        </Typography.Title>

        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
          layout="vertical"
          initialValues={{ username: 'pyh66' }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#64748b' }} />}
              placeholder="请输入用户名"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#64748b' }} />}
              placeholder="请输入密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              style={{
                fontWeight: 600,
              }}
            >
              进入系统
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
