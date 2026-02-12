/**
 * React Hook：设备检测
 * 提供响应式的设备类型检测，窗口大小变化时自动更新
 */

import { useState, useEffect } from 'react';
import {
  isMobileDevice,
  isTabletDevice,
  getDeviceType,
  type DeviceType,
} from './device';

/**
 * 设备信息类型
 */
export interface DeviceInfo {
  /** 是否为移动设备（手机） */
  isMobile: boolean;
  /** 是否为平板设备 */
  isTablet: boolean;
  /** 是否为移动端或平板 */
  isMobileOrTablet: boolean;
  /** 设备类型 */
  deviceType: DeviceType;
  /** 屏幕宽度 */
  width: number;
  /** 屏幕高度 */
  height: number;
}

/**
 * 响应式设备检测 Hook
 * 
 * @param options 配置选项
 * @param options.mobileBreakpoint 移动端断点（默认 768px）
 * @param options.enableResizeListener 是否监听窗口大小变化（默认 true）
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMobile, deviceType } = useDevice();
 *   
 *   return (
 *     <div>
 *       {isMobile ? <MobileLayout /> : <DesktopLayout />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDevice(options?: {
  mobileBreakpoint?: number;
  enableResizeListener?: boolean;
}): DeviceInfo {
  const { mobileBreakpoint = 768, enableResizeListener = true } = options || {};

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const isMobileUA = isMobileDevice();
    const isTabletUA = isTabletDevice();
    const isMobileByWidth = width < mobileBreakpoint;

    return {
      isMobile: isMobileUA || (isMobileByWidth && !isTabletUA),
      isTablet: isTabletUA,
      isMobileOrTablet: isMobileUA || isTabletUA,
      deviceType: getDeviceType(),
      width,
      height,
    };
  });

  useEffect(() => {
    if (!enableResizeListener || typeof window === 'undefined') {
      return;
    }

    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileUA = isMobileDevice();
      const isTabletUA = isTabletDevice();
      const isMobileByWidth = width < mobileBreakpoint;

      setDeviceInfo({
        isMobile: isMobileUA || (isMobileByWidth && !isTabletUA),
        isTablet: isTabletUA,
        isMobileOrTablet: isMobileUA || isTabletUA,
        deviceType: getDeviceType(),
        width,
        height,
      });
    };

    // 使用防抖优化性能
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDeviceInfo, 150);
    };

    window.addEventListener('resize', handleResize);
    
    // 初始化时更新一次（处理 SSR 场景）
    updateDeviceInfo();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [mobileBreakpoint, enableResizeListener]);

  return deviceInfo;
}

/**
 * 简化的移动端检测 Hook（仅返回布尔值）
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMobile = useIsMobile();
 *   return isMobile ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
export function useIsMobile(): boolean {
  const { isMobile } = useDevice({ enableResizeListener: false });
  return isMobile;
}
