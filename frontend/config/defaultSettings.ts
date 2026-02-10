import type { ProLayoutProps } from '@ant-design/pro-layout';

const appName = process.env.APP_NAME || '算数平台';

const Settings: ProLayoutProps & { pwa?: boolean; logo?: string } = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  // 统一使用在 Node 侧解析好的 appName，这样生成的前端 bundle 里也是同一字符串
  title: appName,
  pwa: false,
  logo: undefined,
  iconfontUrl: '',
};

export default Settings;
