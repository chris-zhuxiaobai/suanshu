<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RestrictExportAdminToStatistics
{
    /**
     * 允许 admin / daily_admin 访问所有受保护路由；
     * 仅允许 export_admin 访问配置中的统计相关路径前缀，其余返回 403。
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'code' => 403,
                'message' => '未登录或 token 无效',
                'data' => null,
            ], 403);
        }

        // admin / daily_admin 可访问全部
        if ($user->canEnterData()) {
            return $next($request);
        }

        // export_admin 仅可访问统计相关接口
        if ($user->isExportAdmin()) {
            $path = $request->path();
            $prefixes = config('access.export_admin_allowed_path_prefixes', ['api/daily-statistics']);

            foreach ($prefixes as $prefix) {
                if (str_starts_with($path, $prefix)) {
                    return $next($request);
                }
            }

            return response()->json([
                'code' => 403,
                'message' => '当前角色仅可访问统计相关接口',
                'data' => null,
            ], 403);
        }

        // viewer 等其它角色不允许访问本组路由（Web 端本不应持 token 进入此处，防御性返回）
        return response()->json([
            'code' => 403,
            'message' => '没有访问权限',
            'data' => null,
        ], 403);
    }
}
