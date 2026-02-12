<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConductorScheduleController;
use App\Http\Controllers\DailyIncomeController;
use App\Http\Controllers\DailyStatisticsController;
use App\Http\Controllers\MonthlyStatisticsController;
use App\Http\Controllers\PaymentBalanceController;
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

    // 受保护业务路由：admin/daily_admin 全部可访问，export_admin 仅可访问统计相关（见 config/access.php）
    Route::middleware('restrict.export.admin')->group(function () {
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

        // 每日统计（export_admin 可访问，新增统计接口时在 config/access.php 追加路径前缀）
        Route::get('/daily-statistics/by-date/{date}', [DailyStatisticsController::class, 'getByDate']);
        Route::post('/daily-statistics/recalculate/{date}', [DailyStatisticsController::class, 'recalculate']);
        Route::get('/daily-statistics', [DailyStatisticsController::class, 'index']);

        // 每月统计（export_admin 可访问）
        Route::get('/monthly-statistics/by-month/{year}/{month}', [MonthlyStatisticsController::class, 'getByMonth']);
        Route::get('/monthly-statistics/vehicle/{vehicle_id}/by-month/{year}/{month}', [MonthlyStatisticsController::class, 'getVehicleDetailByMonth']);
        Route::get('/monthly-statistics/revenue-matrix/{year}/{month}', [MonthlyStatisticsController::class, 'getRevenueMatrix']);

        // 收付平衡：GET 接口（export_admin 可访问，用于查看和导出）
        Route::get('/payment-balance/by-month/{year}/{month}', [PaymentBalanceController::class, 'getByMonth']);
    });

        // 收付平衡：POST 接口（仅 admin/daily_admin 可访问，export_admin 不可访问）
        Route::middleware('restrict.export.admin')->group(function () {
            Route::post('/payment-balance/preview', [PaymentBalanceController::class, 'preview']);
            Route::post('/payment-balance', [PaymentBalanceController::class, 'store']);
        });
});
