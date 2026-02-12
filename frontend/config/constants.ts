/**
 * 应用级全局常量
 * 修改此处即可全局生效
 */
const DEFAULT_APP_NAME = '黄桥车队账目管理系统';

/**
 * 应用名称：有环境变量 APP_NAME 则用环境变量，否则用默认值
 * 仅在此处做一次判断，其余地方直接使用 APP_NAME 即可
 */
export const APP_NAME = process.env.APP_NAME || DEFAULT_APP_NAME;
