import type { ProLayoutProps } from '@ant-design/pro-layout';
import { APP_NAME } from './constants';

const Settings: ProLayoutProps & { pwa?: boolean; logo?: string } = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: APP_NAME,
  pwa: false,
  logo: undefined,
  iconfontUrl: '',
};

export default Settings;
