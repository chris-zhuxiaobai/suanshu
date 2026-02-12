<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Models\VehicleSchedule;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VehicleScheduleController extends Controller
{
    /**
     * 排班列表（支持日期范围、车辆筛选）
     */
    public function index(Request $request): JsonResponse
    {
        $query = VehicleSchedule::with('vehicle');

        // 日期范围筛选
        if ($request->has('start_date') && $request->input('start_date')) {
            $query->where('date', '>=', $request->input('start_date'));
        }
        if ($request->has('end_date') && $request->input('end_date')) {
            $query->where('date', '<=', $request->input('end_date'));
        }

        // 单日期查询
        if ($request->has('date') && $request->input('date')) {
            $query->where('date', $request->input('date'));
        }

        // 车辆筛选
        if ($request->has('vehicle_id') && $request->input('vehicle_id')) {
            $query->where('vehicle_id', $request->input('vehicle_id'));
        }

        // 状态筛选
        if ($request->has('status') && $request->input('status')) {
            $query->where('status', $request->input('status'));
        }

        // 排序：按日期降序，再按车辆ID排序
        $query->orderBy('date', 'desc')->orderBy('vehicle_id');

        // 分页
        $perPage = $request->input('per_page', 15);
        $schedules = $query->paginate($perPage);

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $schedules,
        ]);
    }

    /**
     * 获取指定日期的所有车辆排班
     * 如果车辆没有排班记录，默认返回营运状态
     */
    public function getByDate(string $date): JsonResponse
    {
        // 验证日期格式
        try {
            $dateObj = Carbon::parse($date);
        } catch (\Exception $e) {
            return response()->json([
                'code' => 422,
                'message' => '日期格式错误',
                'data' => null,
            ], 422);
        }

        // 获取所有启用状态的车辆，按ID排序
        $vehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 获取该日期的排班记录
        $schedules = VehicleSchedule::where('date', $date)
            ->pluck('status', 'vehicle_id')
            ->toArray();

        // 组装结果：每个车辆都有排班状态（有记录用记录，无记录默认营运）
        $result = $vehicles->map(function ($vehicle) use ($schedules) {
            return [
                'vehicle_id' => $vehicle->id,
                'status' => $schedules[$vehicle->id] ?? VehicleSchedule::STATUS_OPERATE,
                'has_schedule' => isset($schedules[$vehicle->id]),
            ];
        });

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => [
                'date' => $date,
                'vehicles' => $result,
            ],
        ]);
    }

    /**
     * 创建单个排班记录
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(VehicleSchedule::createRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 检查日期范围：只能配置当天开始到往后最多一个月
        $date = Carbon::parse($validated['date']);
        $today = Carbon::today();
        $maxDate = $today->copy()->addMonth();

        if ($date->lt($today)) {
            return response()->json([
                'code' => 422,
                'message' => '排班日期不能早于今天',
                'data' => null,
            ], 422);
        }

        if ($date->gt($maxDate)) {
            return response()->json([
                'code' => 422,
                'message' => '排班日期不能超过今天起一个月',
                'data' => null,
            ], 422);
        }

        // 使用 updateOrCreate 避免重复
        $schedule = VehicleSchedule::updateOrCreate(
            [
                'date' => $validated['date'],
                'vehicle_id' => $validated['vehicle_id'],
            ],
            [
                'status' => $validated['status'],
            ]
        );

        return response()->json([
            'code' => 200,
            'message' => '创建成功',
            'data' => $schedule->load('vehicle'),
        ], 201);
    }

    /**
     * 批量创建排班记录
     * 用于批量设置多个车辆在同一日期的排班状态
     */
    public function batchStore(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(VehicleSchedule::batchCreateRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 检查日期范围
        $date = Carbon::parse($validated['date']);
        $today = Carbon::today();
        $maxDate = $today->copy()->addMonth();

        if ($date->lt($today)) {
            return response()->json([
                'code' => 422,
                'message' => '排班日期不能早于今天',
                'data' => null,
            ], 422);
        }

        if ($date->gt($maxDate)) {
            return response()->json([
                'code' => 422,
                'message' => '排班日期不能超过今天起一个月',
                'data' => null,
            ], 422);
        }

        // 批量插入或更新
        $schedules = [];
        DB::transaction(function () use ($validated, &$schedules) {
            foreach ($validated['vehicle_ids'] as $vehicleId) {
                $schedule = VehicleSchedule::updateOrCreate(
                    [
                        'date' => $validated['date'],
                        'vehicle_id' => $vehicleId,
                    ],
                    [
                        'status' => $validated['status'],
                    ]
                );
                $schedules[] = $schedule;
            }
        });

        return response()->json([
            'code' => 200,
            'message' => '批量创建成功',
            'data' => VehicleSchedule::where('date', $validated['date'])
                ->whereIn('vehicle_id', $validated['vehicle_ids'])
                ->with('vehicle')
                ->get(),
        ], 201);
    }

    /**
     * 更新排班状态
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $schedule = VehicleSchedule::find($id);

        if (! $schedule) {
            return response()->json([
                'code' => 404,
                'message' => '排班记录不存在',
                'data' => null,
            ], 404);
        }

        try {
            $validated = $request->validate(VehicleSchedule::updateRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        $schedule->update($validated);

        return response()->json([
            'code' => 200,
            'message' => '更新成功',
            'data' => $schedule->fresh()->load('vehicle'),
        ]);
    }

    /**
     * 删除排班记录
     */
    public function destroy(int $id): JsonResponse
    {
        $schedule = VehicleSchedule::find($id);

        if (! $schedule) {
            return response()->json([
                'code' => 404,
                'message' => '排班记录不存在',
                'data' => null,
            ], 404);
        }

        $schedule->delete();

        return response()->json([
            'code' => 200,
            'message' => '删除成功',
            'data' => null,
        ]);
    }
}
