<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConductorScheduleController;
use App\Http\Controllers\DailyIncomeController;
use App\Http\Controllers\DailyStatisticsController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\VehicleScheduleController;
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

        // 车辆管理
        Route::apiResource('vehicles', VehicleController::class);

        // 车辆排班
        Route::get('/vehicle-schedules/by-date/{date}', [VehicleScheduleController::class, 'getByDate']);
        Route::post('/vehicle-schedules/batch', [VehicleScheduleController::class, 'batchStore']);
        Route::apiResource('vehicle-schedules', VehicleScheduleController::class);

        // 售票员排班
        Route::get('/conductor-schedules/by-month/{year}/{month}', [ConductorScheduleController::class, 'getByMonth']);
        Route::post('/conductor-schedules/batch', [ConductorScheduleController::class, 'batchStore']);
        Route::apiResource('conductor-schedules', ConductorScheduleController::class);

        // 每日收入
        Route::get('/daily-incomes/by-date/{date}', [DailyIncomeController::class, 'getByDate']);
        Route::post('/daily-incomes/batch', [DailyIncomeController::class, 'batchStore']);
        Route::apiResource('daily-incomes', DailyIncomeController::class);

        // 每日统计
        Route::get('/daily-statistics/by-date/{date}', [DailyStatisticsController::class, 'getByDate']);
        Route::post('/daily-statistics/recalculate/{date}', [DailyStatisticsController::class, 'recalculate']);
        Route::get('/daily-statistics', [DailyStatisticsController::class, 'index']);
    });
});
