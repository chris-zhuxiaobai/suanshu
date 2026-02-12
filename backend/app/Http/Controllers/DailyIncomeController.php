<?php

namespace App\Http\Controllers;

use App\Models\DailyIncome;
use App\Models\Vehicle;
use App\Models\VehicleSchedule;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DailyIncomeController extends Controller
{
    /**
     * 收入列表（支持日期范围、车辆筛选）
     */
    public function index(Request $request): JsonResponse
    {
        $query = DailyIncome::with(['vehicle', 'conductor']);

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

        // 售票员筛选
        if ($request->has('conductor_id') && $request->input('conductor_id')) {
            $query->where('conductor_id', $request->input('conductor_id'));
        }

        // 操作员筛选
        if ($request->has('operator_name') && $request->input('operator_name')) {
            $query->where('operator_name', 'like', '%'.$request->input('operator_name').'%');
        }

        // 加班筛选
        if ($request->has('is_overtime') && $request->input('is_overtime') !== '') {
            $query->where('is_overtime', $request->input('is_overtime'));
        }

        // 排序：按日期降序，再按车辆ID升序
        $query->orderBy('date', 'desc')->orderBy('vehicle_id');

        // 分页
        $perPage = $request->input('per_page', 15);
        $incomes = $query->paginate($perPage);

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $incomes,
        ]);
    }

    /**
     * 获取指定日期的所有车辆收入
     * 如果车辆没有收入记录，返回 null
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

        // 获取该日期的收入记录
        $incomes = DailyIncome::where('date', $date)
            ->with(['vehicle', 'conductor'])
            ->get()
            ->keyBy('vehicle_id');

        // 获取该日期的车辆排班（用于判断是否休息）
        $schedules = VehicleSchedule::where('date', $date)
            ->pluck('status', 'vehicle_id')
            ->toArray();

        // 组装结果：每个车辆都有收入记录（有记录用记录，无记录为 null）
        $result = $vehicles->map(function ($vehicle) use ($incomes, $schedules) {
            $income = $incomes->get($vehicle->id);
            $isRest = ($schedules[$vehicle->id] ?? VehicleSchedule::STATUS_OPERATE) === VehicleSchedule::STATUS_REST;

            if ($income) {
                return [
                    'vehicle_id' => $vehicle->id,
                    'has_income' => true,
                    'income' => $income,
                    'is_rest' => $isRest,
                ];
            }

            return [
                'vehicle_id' => $vehicle->id,
                'has_income' => false,
                'income' => null,
                'is_rest' => $isRest,
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
     * 创建单个收入记录
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(DailyIncome::createRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 检查是否已存在该日期该车辆的收入记录
        $existing = DailyIncome::where('date', $validated['date'])
            ->where('vehicle_id', $validated['vehicle_id'])
            ->first();

        if ($existing) {
            return response()->json([
                'code' => 422,
                'message' => '该日期该车辆的收入记录已存在，请使用更新接口',
                'data' => null,
            ], 422);
        }

        // 判断是否加班（如果车辆当天是休息状态）
        if (! isset($validated['is_overtime'])) {
            $schedule = VehicleSchedule::where('date', $validated['date'])
                ->where('vehicle_id', $validated['vehicle_id'])
                ->first();
            $validated['is_overtime'] = $schedule && $schedule->status === VehicleSchedule::STATUS_REST;
        }

        // 设置操作员
        $validated['operator_name'] = $request->user()->name;

        // 设置默认值
        $validated['wechat_amount'] = $validated['wechat_amount'] ?? 0;
        $validated['fuel_subsidy'] = $validated['fuel_subsidy'] ?? 0;
        $validated['reward_penalty'] = $validated['reward_penalty'] ?? 0;

        $income = DailyIncome::create($validated);

        return response()->json([
            'code' => 200,
            'message' => '创建成功',
            'data' => $income->load(['vehicle', 'conductor']),
        ], 201);
    }

    /**
     * 批量创建/更新收入记录
     */
    public function batchStore(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(DailyIncome::batchCreateRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        $date = $validated['date'];
        $incomes = $validated['incomes'];
        $operatorName = $request->user()->name;

        // 获取该日期的车辆排班（用于判断是否加班）
        $schedules = VehicleSchedule::where('date', $date)
            ->pluck('status', 'vehicle_id')
            ->toArray();

        // 批量插入或更新
        $created = [];
        DB::transaction(function () use ($date, $incomes, $operatorName, $schedules, &$created) {
            foreach ($incomes as $incomeData) {
                // 判断是否加班
                if (! isset($incomeData['is_overtime'])) {
                    $incomeData['is_overtime'] = ($schedules[$incomeData['vehicle_id']] ?? VehicleSchedule::STATUS_OPERATE) === VehicleSchedule::STATUS_REST;
                }

                // 设置操作员和日期
                $incomeData['date'] = $date;
                $incomeData['operator_name'] = $operatorName;

                // 设置默认值
                $incomeData['wechat_amount'] = $incomeData['wechat_amount'] ?? 0;
                $incomeData['fuel_subsidy'] = $incomeData['fuel_subsidy'] ?? 0;
                $incomeData['reward_penalty'] = $incomeData['reward_penalty'] ?? 0;

                $income = DailyIncome::updateOrCreate(
                    [
                        'date' => $date,
                        'vehicle_id' => $incomeData['vehicle_id'],
                    ],
                    $incomeData
                );
                $created[] = $income;
            }
        });

        return response()->json([
            'code' => 200,
            'message' => '批量保存成功',
            'data' => DailyIncome::where('date', $date)
                ->with(['vehicle', 'conductor'])
                ->get(),
        ], 201);
    }

    /**
     * 显示单个收入记录
     */
    public function show(int $id): JsonResponse
    {
        $income = DailyIncome::with(['vehicle', 'conductor'])->find($id);

        if (! $income) {
            return response()->json([
                'code' => 404,
                'message' => '收入记录不存在',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $income,
        ]);
    }

    /**
     * 更新收入记录
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $income = DailyIncome::find($id);

        if (! $income) {
            return response()->json([
                'code' => 404,
                'message' => '收入记录不存在',
                'data' => null,
            ], 404);
        }

        // 验证：只能修改当月的记录
        $currentMonth = Carbon::now()->startOfMonth();
        $incomeMonth = Carbon::parse($income->date)->startOfMonth();

        if (! $incomeMonth->isSameMonth($currentMonth)) {
            return response()->json([
                'code' => 422,
                'message' => '只能修改当月的收入记录',
                'data' => null,
            ], 422);
        }

        try {
            $validated = $request->validate(DailyIncome::updateRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        // 更新操作员
        $validated['operator_name'] = $request->user()->name;

        // 设置默认值（如果字段存在但值为 null，保持原值）
        if (isset($validated['wechat_amount']) && $validated['wechat_amount'] === null) {
            $validated['wechat_amount'] = $income->wechat_amount ?? 0;
        } else {
            $validated['wechat_amount'] = $validated['wechat_amount'] ?? 0;
        }

        if (isset($validated['fuel_subsidy']) && $validated['fuel_subsidy'] === null) {
            $validated['fuel_subsidy'] = $income->fuel_subsidy ?? 0;
        } else {
            $validated['fuel_subsidy'] = $validated['fuel_subsidy'] ?? 0;
        }

        if (isset($validated['reward_penalty']) && $validated['reward_penalty'] === null) {
            $validated['reward_penalty'] = $income->reward_penalty ?? 0;
        } else {
            $validated['reward_penalty'] = $validated['reward_penalty'] ?? 0;
        }

        $income->update($validated);

        return response()->json([
            'code' => 200,
            'message' => '更新成功',
            'data' => $income->fresh()->load(['vehicle', 'conductor']),
        ]);
    }

    /**
     * 删除收入记录（不允许删除）
     */
    public function destroy(int $id): JsonResponse
    {
        return response()->json([
            'code' => 403,
            'message' => '不允许删除收入记录，只能修改',
            'data' => null,
        ], 403);
    }
}
