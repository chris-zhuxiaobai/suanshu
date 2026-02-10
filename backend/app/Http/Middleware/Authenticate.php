<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

/**
 * 认证中间件（覆盖框架默认行为）
 *
 * - 对 `api/*`：未登录时不做 302 跳转，直接走 401（由全局异常处理统一输出 JSON）
 * - 对 Web：本项目无 Laravel 自带登录页，交由前端路由处理，默认跳到 `/`
 */
class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            return null;
        }

        return '/';
    }
}

