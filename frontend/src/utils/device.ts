/**
 * 设备检测工具
 * 提供移动端、平板、桌面端的检测能力
 */

/**
 * 移动端 User Agent 正则表达式
 * 覆盖主流移动设备：iOS、Android、Windows Phone、BlackBerry 等
 */
const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;

/**
 * 平板设备 User Agent 正则表达式
 */
const TABLET_REGEX = /iPad|Android(?=.*\bMobile\b)(?=.*\b(?!Mobile)\w+\b)|Tablet|PlayBook|Silk/i;

/**
 * 通过 User Agent 检测是否为移动设备
 * 这是最可靠的方法，因为不依赖屏幕尺寸（平板横屏时可能被误判）
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return MOBILE_REGEX.test(navigator.userAgent);
}

/**
 * 通过 User Agent 检测是否为平板设备
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return TABLET_REGEX.test(navigator.userAgent);
}

/**
 * 检测是否为移动端或平板设备
 */
export function isMobileOrTablet(): boolean {
  return isMobileDevice() || isTabletDevice();
}

/**
 * 通过屏幕宽度检测是否为移动端（响应式检测）
 * 注意：这种方法可能不够准确，因为：
 * 1. 桌面浏览器窗口缩小会被误判
 * 2. 平板横屏时可能被误判为桌面
 * 建议结合 User Agent 使用
 */
export function isMobileByWidth(breakpoint: number = 768): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth < breakpoint;
}

/**
 * 检测是否支持触摸事件
 * 移动设备通常支持触摸，但某些 Windows 设备也支持触摸
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 综合检测：是否为移动端
 * 优先使用 User Agent（最可靠），其次考虑屏幕宽度
 */
export function isMobile(): boolean {
  // 优先使用 User Agent 检测（最可靠）
  if (isMobileDevice()) {
    return true;
  }
  
  // 如果 User Agent 无法确定，且屏幕宽度小于 768px，且支持触摸，则认为是移动端
  // 这可以处理某些特殊场景，但主要依赖 User Agent
  return isMobileByWidth(768) && isTouchDevice();
}

/**
 * 设备类型
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * 获取设备类型
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function getDeviceType(): DeviceType {
  if (isMobileDevice()) {
    return 'mobile';
  }
  if (isTabletDevice()) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * 获取 User Agent 字符串（用于调试或日志）
 */
export function getUserAgent(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return navigator.userAgent;
}

/**
 * 检测是否为 iOS 设备
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

/**
 * 检测是否为 Android 设备
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

/**
 * 检测是否为微信浏览器
 */
export function isWeChatBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return /MicroMessenger/i.test(navigator.userAgent);
}
