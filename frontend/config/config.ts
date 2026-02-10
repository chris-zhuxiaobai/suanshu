// https://umijs.org/config/
import path from 'node:path';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';

const { UMI_ENV = 'dev', APP_NAME } = process.env;
const appName = APP_NAME || '算数平台';

export default defineConfig({
  hash: true,
  publicPath: '/',
  alias: {
    '@': path.resolve(__dirname, '../src'),
  },
  routes,
  theme: {
    '@primary-color': '#1677ff',
  },
  ignoreMomentLocale: true,
  proxy: proxy[UMI_ENV as keyof typeof proxy] || {},
  fastRefresh: true,

  model: {},
  initialState: {},
  // 页面默认标题统一从 APP_NAME 读取（并通过 define 注入到客户端）
  title: appName,
  define: {
    APP_NAME: appName,
  },
  layout: {
    locale: true,
    ...defaultSettings,
  },
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration'],
  },
  locale: {
    default: 'zh-CN',
    antd: true,
    baseNavigator: true,
  },
  antd: {
    configProvider: {
      theme: {
        token: {
          borderRadius: 6,
          colorPrimary: '#1677ff',
        },
      },
    },
  },
  request: {},
  access: {},
  presets: ['umi-presets-pro'],
});
