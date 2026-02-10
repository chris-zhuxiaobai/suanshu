declare namespace API {
  interface CurrentUser {
    id: number;
    name: string;
    username: string;
    role: string;
    token_source?: string;
  }

  interface LoginResult {
    token: string;
    user: CurrentUser;
  }
}

// 允许导入静态资源（如 webp 图片）
declare module '*.webp' {
  const src: string;
  export default src;
}
