/**
 * 权限定义
 * 用于控制不同角色的访问权限
 */
export default function access(initialState: { currentUser?: API.CurrentUser }) {
  const { currentUser } = initialState || {};
  
  // 是否为统计管理员（export_admin）
  const isExportAdmin = currentUser?.role === 'export_admin';
  
  // 是否为管理员或日常管理员（可访问所有功能）
  const canEnterData = currentUser?.role === 'admin' || currentUser?.role === 'daily_admin';
  
  return {
    // 统计管理员只能访问欢迎页和统计模块
    canAccessWelcome: true, // 所有登录用户都可以访问欢迎页
    canAccessStatistics: true, // 所有登录用户都可以访问统计模块
    canAccessDashboard: !isExportAdmin, // 统计管理员不能访问工作台
    canAccessIncome: !isExportAdmin, // 统计管理员不能访问收入录入
    canAccessFleet: !isExportAdmin, // 统计管理员不能访问车队管理
    
    // 是否允许录入数据
    canEnterData,
  };
}
