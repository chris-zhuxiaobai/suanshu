<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API 路由（前缀 /api，无 session/CSRF，前端请求 /api/auth/*）
|--------------------------------------------------------------------------
*/

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/miniprogram/login', [AuthController::class, 'miniprogramLogin']);

Route::middleware(['auth:sanctum', 'token.fresh'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::middleware('can.enter.data')->group(function () {
        Route::get('/auth/can-enter', fn () => response()->json(['code' => 200, 'data' => ['ok' => true]]));
    });
});
