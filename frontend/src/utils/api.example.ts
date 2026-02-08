/**
 * API 使用示例
 * 展示如何使用统一的 API 客户端
 * 
 * 注意：此文件仅作为示例，不会被编译到生产代码中
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck

import api, { ApiError, setAuthToken, clearAuthToken } from './api';

// ========== 基础使用 ==========

// GET 请求
async function getUserList() {
  try {
    const users = await api.get('/users', { page: 1, limit: 10 });
    console.log('用户列表:', users);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('获取用户列表失败:', error.message, error.status);
    }
  }
}

// POST 请求
async function createUser(userData: { name: string; email: string }) {
  try {
    const newUser = await api.post('/users', userData);
    console.log('创建用户成功:', newUser);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('创建用户失败:', error.message);
    }
  }
}

// PUT 请求
async function updateUser(userId: number, userData: Partial<{ name: string; email: string }>) {
  try {
    const updatedUser = await api.put(`/users/${userId}`, userData);
    console.log('更新用户成功:', updatedUser);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('更新用户失败:', error.message);
    }
  }
}

// DELETE 请求
async function deleteUser(userId: number) {
  try {
    await api.delete(`/users/${userId}`);
    console.log('删除用户成功');
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('删除用户失败:', error.message);
    }
  }
}

// ========== 认证相关 ==========

// 登录后设置 token
function handleLogin(token: string) {
  // 持久化存储（刷新页面后仍然有效）
  setAuthToken(token, true);
  
  // 或者会话存储（关闭浏览器后失效）
  // setAuthToken(token, false);
}

// 登出时清除 token
function handleLogout() {
  clearAuthToken();
}

// ========== 文件上传 ==========

async function uploadFile(file: File) {
  try {
    const result = await api.upload(
      '/upload',
      file,
      (progress) => {
        console.log(`上传进度: ${progress}%`);
      }
    );
    console.log('上传成功:', result);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('上传失败:', error.message);
    }
  }
}

// ========== 错误处理示例 ==========

async function exampleWithErrorHandling() {
  try {
    const data = await api.get('/some-endpoint');
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      // 根据状态码进行不同处理
      switch (error.status) {
        case 401:
          // 未授权，跳转登录
          console.log('需要登录');
          // window.location.href = '/login';
          break;
        case 403:
          // 无权限
          console.log('没有权限');
          break;
        case 404:
          // 资源不存在
          console.log('资源不存在');
          break;
        case 500:
          // 服务器错误
          console.log('服务器错误，请稍后重试');
          break;
        default:
          console.log('其他错误:', error.message);
      }
    } else {
      // 非 API 错误（如网络错误）
      console.error('网络错误:', error);
    }
    throw error; // 重新抛出，让调用者处理
  }
}
