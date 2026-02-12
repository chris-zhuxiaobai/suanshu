<?php

namespace App\Http\Controllers;

use App\Models\ConductorSchedule;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ConductorScheduleController extends Controller
{
    /**
     * 排班列表（支持年月筛选）
     */
    public function index(Request $request): JsonResponse
    {
        $query = ConductorSchedule::with(['vehicle', 'conductor']);

        // 年份筛选
        if ($request->has('year') && $request->input('year')) {
            $query->where('year', $request->input('year'));
        }

        // 月份筛选
        if ($request->has('month') && $request->input('month')) {
            $query->where('month', $request->input('month'));
        }

        // 车辆筛选
        if ($request->has('vehicle_id') && $request->input('vehicle_id')) {
            $query->where('vehicle_id', $request->input('vehicle_id'));
        }

        // 售票员筛选
        if ($request->has('conductor_id') && $request->input('conductor_id')) {
            $query->where('conductor_id', $request->input('conductor_id'));
        }

        // 排序：按年月降序，再按车辆ID升序
        $query->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->orderBy('vehicle_id');

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
     * 获取指定年月的所有车辆售票员排班
     * 如果车辆没有排班记录，返回 null
     */
    public function getByMonth(int $year, int $month): JsonResponse
    {
        // 验证年月范围
        if ($year < 2000 || $year > 2100) {
            return response()->json([
                'code' => 422,
                'message' => '年份范围错误',
                'data' => null,
            ], 422);
        }

        if ($month < 1 || $month > 12) {
            return response()->json([
                'code' => 422,
                'message' => '月份范围错误',
                'data' => null,
            ], 422);
        }

        // 获取所有启用状态的车辆，按ID排序
        $vehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 获取该年月的排班记录
        $schedules = ConductorSchedule::where('year', $year)
            ->where('month', $month)
            ->pluck('conductor_id', 'vehicle_id')
            ->toArray();

        // 组装结果：每个车辆都有售票员配置（有记录用记录，无记录为 null）
        $result = $vehicles->map(function ($vehicle) use ($schedules) {
            return [
                'vehicle_id' => $vehicle->id,
                'conductor_id' => $schedules[$vehicle->id] ?? null,
                'has_schedule' => isset($schedules[$vehicle->id]),
            ];
        });

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => [
                'year' => $year,
                'month' => $month,
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
            $validated = $request->validate(ConductorSchedule::createRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 使用 updateOrCreate 避免重复
        $schedule = ConductorSchedule::updateOrCreate(
            [
                'year' => $validated['year'],
                'month' => $validated['month'],
                'vehicle_id' => $validated['vehicle_id'],
            ],
            [
                'conductor_id' => $validated['conductor_id'],
            ]
        );

        return response()->json([
            'code' => 200,
            'message' => '创建成功',
            'data' => $schedule->load(['vehicle', 'conductor']),
        ], 201);
    }

    /**
     * 批量创建/更新排班记录
     * 用于批量设置多个车辆的售票员配置
     */
    public function batchStore(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(ConductorSchedule::batchCreateRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        $year = $validated['year'];
        $month = $validated['month'];
        $schedules = $validated['schedules'];

        // 校验：售票员不能跟本车
        foreach ($schedules as $schedule) {
            if ($schedule['vehicle_id'] === $schedule['conductor_id']) {
                return response()->json([
                    'code' => 422,
                    'message' => sprintf('车辆 %s 的售票员不能是自身', $schedule['vehicle_id']),
                    'data' => null,
                ], 422);
            }
        }

        // 批量插入或更新
        $created = [];
        DB::transaction(function () use ($year, $month, $schedules, &$created) {
            foreach ($schedules as $schedule) {
                $created[] = ConductorSchedule::updateOrCreate(
                    [
                        'year' => $year,
                        'month' => $month,
                        'vehicle_id' => $schedule['vehicle_id'],
                    ],
                    [
                        'conductor_id' => $schedule['conductor_id'],
                    ]
                );
            }
        });

        return response()->json([
            'code' => 200,
            'message' => '批量保存成功',
            'data' => ConductorSchedule::where('year', $year)
                ->where('month', $month)
                ->with(['vehicle', 'conductor'])
                ->get(),
        ], 201);
    }

    /**
     * 显示单个排班记录
     */
    public function show(int $id): JsonResponse
    {
        $schedule = ConductorSchedule::with(['vehicle', 'conductor'])->find($id);

        if (! $schedule) {
            return response()->json([
                'code' => 404,
                'message' => '排班记录不存在',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $schedule,
        ]);
    }

    /**
     * 更新排班记录
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $schedule = ConductorSchedule::find($id);

        if (! $schedule) {
            return response()->json([
                'code' => 404,
                'message' => '排班记录不存在',
                'data' => null,
            ], 404);
        }

        try {
            $validated = $request->validate(ConductorSchedule::updateRules($id));
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 再次校验：售票员不能跟本车
        if ($validated['conductor_id'] === $schedule->vehicle_id) {
            return response()->json([
                'code' => 422,
                'message' => '售票员不能跟本车',
                'data' => null,
            ], 422);
        }

        $schedule->update($validated);

        return response()->json([
            'code' => 200,
            'message' => '更新成功',
            'data' => $schedule->fresh()->load(['vehicle', 'conductor']),
        ]);
    }

    /**
     * 删除排班记录
     */
    public function destroy(int $id): JsonResponse
    {
        $schedule = ConductorSchedule::find($id);

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
