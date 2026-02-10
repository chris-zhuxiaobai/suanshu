<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserCanEnterData
{
    /**
     * 仅允许 admin / daily_admin 访问（录入相关路由使用）。
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->canEnterData()) {
            return response()->json([
                'code' => 403,
                'message' => '没有录入权限',
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
