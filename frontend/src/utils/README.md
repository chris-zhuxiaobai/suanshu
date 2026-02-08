# API 客户端使用指南

## 概述

项目使用 **Axios** 作为 HTTP 客户端，并进行了统一封装，提供：

- ✅ **自动添加认证 token**（请求拦截器）
- ✅ **统一错误处理**（响应拦截器）
- ✅ **类型安全**（TypeScript 支持）
- ✅ **简洁的 API**（get/post/put/delete/upload）

## 为什么选择 Axios？

### 对比 Fetch

| 特性 | Fetch | Axios |
|------|-------|-------|
| 拦截器 | ❌ 不支持 | ✅ 支持 |
| 自动 JSON 解析 | ❌ 需手动 | ✅ 自动 |
| 请求取消 | ⚠️ 需 AbortController | ✅ 内置 |
| 错误处理 | ⚠️ 需手动检查 | ✅ 自动 |
| 超时设置 | ❌ 不支持 | ✅ 支持 |
| 上传进度 | ❌ 不支持 | ✅ 支持 |

**结论**：对于需要统一认证和错误处理的项目，Axios 更合适。

## 快速开始

### 1. 基础使用

```typescript
import api from '@/utils/api';

// GET 请求
const users = await api.get('/users', { page: 1, limit: 10 });

// POST 请求
const newUser = await api.post('/users', { name: 'John', email: 'john@example.com' });

// PUT 请求
const updatedUser = await api.put('/users/1', { name: 'Jane' });

// DELETE 请求
await api.delete('/users/1');
```

### 2. 类型安全

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// TypeScript 会自动推断返回类型
const user = await api.get<User>('/users/1');
// user 的类型是 User
```

### 3. 错误处理

```typescript
import api, { ApiError } from '@/utils/api';

try {
  const data = await api.get('/users');
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API 错误:', error.message);
    console.error('状态码:', error.status);
    console.error('错误码:', error.code);
    console.error('错误数据:', error.data);
  }
}
```

### 4. 认证 Token 管理

```typescript
import { setAuthToken, clearAuthToken, getAuthToken } from '@/utils/api';

// 登录后设置 token（持久化存储）
setAuthToken('your-token-here', true);

// 会话存储（关闭浏览器后失效）
setAuthToken('your-token-here', false);

// 获取当前 token
const token = getAuthToken();

// 登出时清除 token
clearAuthToken();
```

### 5. 文件上传

```typescript
import api from '@/utils/api';

const file = document.querySelector('input[type="file"]').files[0];

await api.upload(
  '/upload',
  file,
  (progress) => {
    console.log(`上传进度: ${progress}%`);
  }
);
```

## 自动功能

### 请求拦截器

自动执行：
1. ✅ 添加 `Authorization: Bearer {token}` header
2. ✅ 设置 `Content-Type: application/json`
3. ✅ 设置 `Accept: application/json`

### 响应拦截器

自动处理：
1. ✅ HTTP 错误状态码（401/403/404/500 等）
2. ✅ 业务错误码（如果后端返回 `{ code, message, data }`）
3. ✅ 网络错误和超时
4. ✅ 401 时自动清除 token（可扩展跳转登录）

## 配置说明

### 修改基础 URL

编辑 `src/utils/api.ts`：

```typescript
const API_BASE_URL = '/api'; // 修改为你的 API 基础路径
```

### 修改超时时间

```typescript
const apiClient: AxiosInstance = axios.create({
  timeout: 30000, // 修改为需要的超时时间（毫秒）
});
```

### 添加自定义 Header

在请求拦截器中添加：

```typescript
apiClient.interceptors.request.use((config) => {
  config.headers['X-Custom-Header'] = 'value';
  return config;
});
```

## 错误码处理

### HTTP 状态码

- `401` - 未授权，自动清除 token
- `403` - 禁止访问
- `404` - 资源不存在
- `500+` - 服务器错误

### 业务错误码

如果后端返回格式为：
```json
{
  "code": 1001,
  "message": "用户不存在",
  "data": null
}
```

响应拦截器会自动检查 `code` 字段，非 200/0 时抛出 `ApiError`。

## 完整示例

参考 `api.example.ts` 文件查看更多使用示例。
