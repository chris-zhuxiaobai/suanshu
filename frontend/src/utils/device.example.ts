/**
 * 设备检测工具使用示例
 */

import { isMobile, isMobileDevice, getDeviceType, isIOS, isAndroid, isWeChatBrowser } from './device';
import { useDevice, useIsMobile } from './useDevice';

// ========== 方式一：直接使用工具函数（适合非 React 组件） ==========

// 检测是否为移动设备
if (isMobile()) {
  console.log('当前是移动设备');
}

// 检测是否为移动设备（仅 User Agent）
if (isMobileDevice()) {
  console.log('User Agent 显示为移动设备');
}

// 获取设备类型
const deviceType = getDeviceType(); // 'mobile' | 'tablet' | 'desktop'
console.log('设备类型:', deviceType);

// 检测具体平台
if (isIOS()) {
  console.log('iOS 设备');
}

if (isAndroid()) {
  console.log('Android 设备');
}

if (isWeChatBrowser()) {
  console.log('微信浏览器');
}

// ========== 方式二：在 React 组件中使用 Hook（推荐） ==========

// 示例 1：完整设备信息
function MyComponent() {
  const { isMobile, isTablet, deviceType, width, height } = useDevice();

  return (
    <div>
      {isMobile ? (
        <div>移动端布局</div>
      ) : isTablet ? (
        <div>平板布局</div>
      ) : (
        <div>桌面端布局</div>
      )}
      
      <p>设备类型: {deviceType}</p>
      <p>屏幕尺寸: {width} x {height}</p>
    </div>
  );
}

// 示例 2：仅检测移动端（性能更好）
function SimpleComponent() {
  const isMobile = useIsMobile();

  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}

// 示例 3：自定义断点
function CustomBreakpointComponent() {
  const { isMobile } = useDevice({ 
    mobileBreakpoint: 1024, // 自定义断点为 1024px
    enableResizeListener: true // 监听窗口大小变化
  });

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

// ========== 方式三：在登录页面中使用 ==========

function LoginPage() {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? 'mobile-login' : 'desktop-login'}>
      <h1>登录</h1>
      {/* 移动端和桌面端可以使用不同的布局 */}
    </div>
  );
}

// ========== 方式四：条件渲染不同组件 ==========

function ResponsiveComponent() {
  const { isMobile, deviceType } = useDevice();

  if (isMobile) {
    return <MobileOnlyComponent />;
  }

  return <DesktopComponent />;
}

// ========== 方式五：在 API 请求中发送设备信息 ==========

import api from './api';

async function sendDeviceInfo() {
  const deviceType = getDeviceType();
  
  await api.post('/api/user/device-info', {
    device_type: deviceType,
    is_mobile: isMobile(),
    user_agent: navigator.userAgent,
  });
}
