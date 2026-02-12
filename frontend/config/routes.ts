/**
 * Umi 路由配置（树形菜单）
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './user/login',
      },
    ],
  },
  // 欢迎页（登录后/403 等跳转）
  {
    path: '/welcome',
    name: 'welcome',
    component: './Welcome',
    hideInMenu: true,
  },
  // 仪表盘（工作台为预留功能页）
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: 'DashboardOutlined',
    routes: [
      {
        path: '/dashboard/workspace',
        name: 'workspace',
        component: './Dashboard/Workspace',
      },
      {
        path: '/dashboard',
        redirect: '/dashboard/workspace',
      },
    ],
  },
  // 统计模块
  {
    path: '/statistics',
    name: 'statistics',
    icon: 'BarChartOutlined',
    routes: [
      {
        path: '/statistics/daily',
        name: 'daily',
        component: './Statistics/Daily',
      },
      {
        path: '/statistics/monthly',
        name: 'monthly',
        component: './Statistics/Monthly',
      },
      {
        path: '/statistics',
        redirect: '/statistics/daily',
      },
    ],
  },
  // 收入录入
  {
    path: '/income',
    name: 'income',
    icon: 'DollarOutlined',
    routes: [
      {
        path: '/income/entry',
        name: 'entry',
        component: './Income/Entry',
      },
      {
        path: '/income',
        redirect: '/income/entry',
      },
    ],
  },
  // 车队管理
  {
    path: '/fleet',
    name: 'fleet',
    icon: 'CarOutlined',
    routes: [
      {
        path: '/fleet/schedule',
        name: 'schedule',
        component: './Fleet/Schedule',
      },
      {
        path: '/fleet/staff-config',
        name: 'staff-config',
        component: './Fleet/StaffConfig',
      },
      {
        path: '/fleet/vehicles',
        name: 'vehicles',
        component: './Fleet/Vehicles',
      },
      {
        path: '/fleet',
        redirect: '/fleet/vehicles',
      },
    ],
  },
  {
    path: '/',
    redirect: '/welcome',
  },
  {
    path: '*',
    layout: false,
    component: './404',
  },
];
