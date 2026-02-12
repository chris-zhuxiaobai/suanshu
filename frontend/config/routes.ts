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
  // 仪表盘
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
    redirect: '/dashboard/workspace',
  },
  {
    path: '/welcome',
    redirect: '/dashboard/workspace',
  },
  {
    path: '*',
    layout: false,
    component: './404',
  },
];
