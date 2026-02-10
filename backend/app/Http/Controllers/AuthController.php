<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Web 登录：username + password，仅 admin / daily_admin。
     * 签发 token 的 name 固定为 'web'，便于统计与审计。
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->input('username'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['用户名或密码错误'],
            ]);
        }

        if (! $user->canLoginWeb()) {
            throw ValidationException::withMessages([
                'username' => [__('该账号不允许通过 Web 登录。')],
            ]);
        }

        $user->tokens()->where('name', 'web')->delete();
        $plainTextToken = $user->createToken('web')->plainTextToken;

        return $this->tokenResponse($user, $plainTextToken);
    }

    /**
     * 小程序登录（预留）：code 换 openid/unionid，查绑定表得 user，签发 token name 'miniprogram'。
     */
    public function miniprogramLogin(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        // TODO: 调用微信 code2session，得到 openid/unionid；查 user_wechat_bindings 得 user_id；
        // 若未绑定则按策略拒绝或由管理员在 Web 先建 viewer 再绑定。此处仅占位返回 501。
        return response()->json([
            'code' => 501,
            'message' => '小程序登录尚未实现',
            'data' => null,
        ], 501);
    }

    /**
     * 登出：撤销当前请求使用的 token。
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => null,
        ]);
    }

    /**
     * 当前登录用户信息（含 token 来源，供前端/统计使用）。
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role,
            'token_source' => $user->tokenSource(),
        ];

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $data,
        ]);
    }

    private function tokenResponse(User $user, string $plainTextToken): JsonResponse
    {
        $data = [
            'token' => $plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
            ],
        ];

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $data,
        ]);
    }
}
