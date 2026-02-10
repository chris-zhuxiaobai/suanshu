<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 确保当前 Sanctum Token 仍在允许的“空闲时间窗口”内。
 *
 * 设计：
 * - 空闲时间窗口默认 48 小时，可通过 env TOKEN_IDLE_MINUTES 调整。
 * - 每次请求若距离上次使用超过窗口，则视为过期：删除当前 token 并抛出 401。
 * - 每次请求会更新 token 的 last_used_at（带一个 5 分钟节流，避免高频写 DB）。
 *
 * 优点：
 * - 过期策略完全由后端控制，前端只需按 401 流程清 token + 跳登录。
 * - 不依赖浏览器存储策略（localStorage / sessionStorage），适配多终端。
 */
class EnsureTokenIsFresh
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if (! $user || ! $token) {
            throw new AuthenticationException('未授权');
        }

        $maxIdleMinutes = (int) (env('TOKEN_IDLE_MINUTES', 60 * 48));

        // Sanctum 默认提供 created_at / last_used_at 字段
        $lastActivity = $token->last_used_at ?: $token->created_at;

        if ($lastActivity && $lastActivity->lt(now()->subMinutes($maxIdleMinutes))) {
            $token->delete();

            throw new AuthenticationException('登录已过期，请重新登录。');
        }

        // 节流更新 last_used_at，避免每个请求都写库
        if (! $token->last_used_at || $token->last_used_at->lt(now()->subMinutes(5))) {
            $token->forceFill(['last_used_at' => now()])->save();
        }

        return $next($request);
    }
}

