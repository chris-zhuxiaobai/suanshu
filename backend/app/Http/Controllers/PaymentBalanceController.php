<?php

namespace App\Http\Controllers;

use App\Helpers\AmountHelper;
use App\Models\DailyIncome;
use App\Models\DailyStatistics;
use App\Models\PaymentBalanceSnapshot;
use App\Models\SystemSetting;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PaymentBalanceController extends Controller
{
    /**
     * 获取指定月份的收付平衡数据
     * 如果存在快照，返回快照数据；否则计算并返回当前数据
     *
     * @param int $year 年份
     * @param int $month 月份（1-12）
     * @return JsonResponse
     */
    public function getByMonth(int $year, int $month): JsonResponse
    {
        // 验证月份
        if ($month < 1 || $month > 12) {
            return response()->json([
                'code' => 400,
                'message' => '月份格式错误',
            ], 400);
        }

        try {
            $startDate = Carbon::create($year, $month, 1)->startOfMonth();
            $endDate = Carbon::create($year, $month, 1)->endOfMonth();
        } catch (\Exception $e) {
            return response()->json([
                'code' => 400,
                'message' => '日期格式错误',
            ], 400);
        }

        // 查询快照数据
        $snapshot = PaymentBalanceSnapshot::where('year', $year)
            ->where('month', $month)
            ->first();

        if ($snapshot) {
            // 返回快照数据，使用快照中保存的管理员工资（历史值）
            return response()->json([
                'code' => 200,
                'data' => [
                    'year' => $snapshot->year,
                    'month' => $snapshot->month,
                    'auto_average_income' => (float) $snapshot->auto_average_income,
                    'manual_average_income' => $snapshot->manual_average_income ? (float) $snapshot->manual_average_income : null,
                    'manager_salary' => (float) $snapshot->manager_salary, // 使用快照中保存的管理员工资（历史值）
                    'vehicle_details' => $snapshot->vehicle_details,
                    'operator_name' => $snapshot->operator_name,
                    'created_at' => $snapshot->created_at->format('Y-m-d H:i:s'),
                    'updated_at' => $snapshot->updated_at->format('Y-m-d H:i:s'),
                    'is_saved' => true,
                ],
            ]);
        }

        // 如果没有快照，计算当前数据，使用全局配置的管理员工资（实时值）
        $managerSalary = SystemSetting::getManagerSalary();
        $calculationResult = $this->calculatePaymentBalance($year, $month, $startDate, $endDate, $managerSalary);

        return response()->json([
            'code' => 200,
            'data' => [
                'year' => $year,
                'month' => $month,
                'auto_average_income' => $calculationResult['auto_average_income'],
                'manual_average_income' => null,
                'manager_salary' => $managerSalary,
                'vehicle_details' => $calculationResult['vehicle_details'],
                'operator_name' => null,
                'created_at' => null,
                'updated_at' => null,
                'is_saved' => false,
            ],
        ]);
    }

    /**
     * 计算收付平衡数据
     *
     * @param int $year 年份
     * @param int $month 月份
     * @param Carbon $startDate 开始日期
     * @param Carbon $endDate 结束日期
     * @param float $managerSalary 管理员工资
     * @return array<string, mixed>
     */
    private function calculatePaymentBalance(int $year, int $month, Carbon $startDate, Carbon $endDate, float $managerSalary): array
    {
        // 查询所有在册车辆总数
        $totalVehicleCount = Vehicle::where('status', Vehicle::STATUS_ACTIVE)->count();

        // 查询该月份所有日统计数据
        $dailyStatistics = DailyStatistics::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->get();

        // 汇总实际分配金额（净收入）
        $totalNetIncome = $dailyStatistics->sum('total_net_income');

        // 计算自动平均收入：(总实际分配金额 - 管理员工资) / 在册车辆总数
        $autoAverageIncome = $totalVehicleCount > 0
            ? AmountHelper::truncate(($totalNetIncome - $managerSalary) / $totalVehicleCount) ?? 0.0
            : 0.0;

        // 查询该月份所有已录入的收入记录
        $incomes = DailyIncome::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->with(['vehicle', 'conductor'])
            ->get();

        // 查询所有在册车辆
        $allVehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 按车辆汇总整个月的收入数据
        $vehicleIncomeMap = [];
        foreach ($incomes as $income) {
            $vehicleId = $income->vehicle_id;
            if (!isset($vehicleIncomeMap[$vehicleId])) {
                $vehicleIncomeMap[$vehicleId] = [
                    'revenue' => 0,
                    'net_income' => 0,
                    'turn_count' => 0,
                    'fuel_subsidy' => 0,
                    'reward_penalty' => 0,
                    'conductor_id' => null,
                ];
            }
            $vehicleIncomeMap[$vehicleId]['revenue'] += $income->revenue;
            $vehicleIncomeMap[$vehicleId]['net_income'] += $income->net_income;
            $vehicleIncomeMap[$vehicleId]['turn_count'] += ($income->turn_count ?? 0);
            $vehicleIncomeMap[$vehicleId]['fuel_subsidy'] += (float) ($income->fuel_subsidy ?? 0);
            $vehicleIncomeMap[$vehicleId]['reward_penalty'] += (float) ($income->reward_penalty ?? 0);
            if ($income->conductor_id) {
                $vehicleIncomeMap[$vehicleId]['conductor_id'] = $income->conductor_id;
            }
        }

        // 计算每辆车的收付数据
        $vehicleDetails = $allVehicles->map(function ($vehicle) use ($vehicleIncomeMap, $autoAverageIncome) {
            $income = $vehicleIncomeMap[$vehicle->id] ?? null;

            $revenue = $income ? $income['revenue'] : 0;
            $netIncome = $income ? $income['net_income'] : 0;
            $turnCount = $income ? $income['turn_count'] : 0;
            $fuelSubsidy = $income ? $income['fuel_subsidy'] : 0;
            $rewardPenalty = $income ? $income['reward_penalty'] : 0;
            $conductorId = $income ? ($income['conductor_id'] ?? null) : null;

            // 计算应付款(自动)和应收款(自动)
            // 应付款(自动) = 自动平均收入 - 当前车辆实际分配金额（如果为负，即车辆收入高于平均值）
            // 应收款(自动) = 自动平均收入 - 当前车辆实际分配金额（如果为正，即车辆收入低于平均值）
            $paymentAmount = $autoAverageIncome - $netIncome;
            $paymentDueAuto = $paymentAmount < 0 ? abs($paymentAmount) : 0; // 应付款（车辆应付）
            $paymentReceivableAuto = $paymentAmount > 0 ? $paymentAmount : 0; // 应收款（车辆应收）

            return [
                'vehicle_id' => $vehicle->id,
                'revenue' => AmountHelper::truncate($revenue) ?? 0.0,
                'net_income' => AmountHelper::truncate($netIncome) ?? 0.0,
                'turn_count' => $turnCount,
                'fuel_subsidy' => AmountHelper::truncate($fuelSubsidy) ?? 0.0,
                'reward_penalty' => AmountHelper::truncate($rewardPenalty) ?? 0.0,
                'conductor_id' => $conductorId,
                'payment_due_auto' => AmountHelper::truncate($paymentDueAuto) ?? 0.0,
                'payment_receivable_auto' => AmountHelper::truncate($paymentReceivableAuto) ?? 0.0,
                'payment_due_corrected' => AmountHelper::truncate($paymentDueAuto) ?? 0.0, // 修正版本初始值等于自动值
                'payment_receivable_corrected' => AmountHelper::truncate($paymentReceivableAuto) ?? 0.0, // 修正版本初始值等于自动值
            ];
        })->values()->toArray();

        return [
            'auto_average_income' => $autoAverageIncome,
            'vehicle_details' => $vehicleDetails,
        ];
    }

    /**
     * 预览收付平衡数据（不保存）
     * 用于在修改管理员工资或手动修正收入时预览数据变化
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function preview(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'manager_salary' => ['required', 'numeric', 'min:0'],
            'manual_average_income' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => 400,
                'message' => '数据验证失败',
                'errors' => $validator->errors(),
            ], 400);
        }

        $data = $validator->validated();

        try {
            $startDate = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
            $endDate = Carbon::create($data['year'], $data['month'], 1)->endOfMonth();
        } catch (\Exception $e) {
            return response()->json([
                'code' => 400,
                'message' => '日期格式错误',
            ], 400);
        }

        // 使用传入的管理员工资重新计算
        $managerSalary = AmountHelper::truncate($data['manager_salary']) ?? 0.0;
        $calculationResult = $this->calculatePaymentBalance($data['year'], $data['month'], $startDate, $endDate, $managerSalary);

        // 使用手动修正的平均收入（如果提供），否则使用自动计算的平均收入
        $finalAverageIncome = $data['manual_average_income'] ?? $calculationResult['auto_average_income'];

        // 重新计算修正后的收付款（基于最终的平均收入）
        $updatedVehicleDetails = array_map(function ($vehicle) use ($finalAverageIncome) {
            $paymentAmount = $finalAverageIncome - $vehicle['net_income'];
            $paymentDueCorrected = $paymentAmount < 0 ? abs($paymentAmount) : 0;
            $paymentReceivableCorrected = $paymentAmount > 0 ? $paymentAmount : 0;

            return [
                ...$vehicle,
                'payment_due_corrected' => AmountHelper::truncate($paymentDueCorrected) ?? 0.0,
                'payment_receivable_corrected' => AmountHelper::truncate($paymentReceivableCorrected) ?? 0.0,
            ];
        }, $calculationResult['vehicle_details']);

        return response()->json([
            'code' => 200,
            'data' => [
                'auto_average_income' => $calculationResult['auto_average_income'],
                'vehicle_details' => $updatedVehicleDetails,
            ],
        ]);
    }

    /**
     * 保存收付平衡快照数据
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'auto_average_income' => ['nullable', 'numeric', 'min:0'], // 不再必填，因为会重新计算
            'manual_average_income' => ['nullable', 'numeric', 'min:0'],
            'manager_salary' => ['required', 'numeric', 'min:0'],
            'vehicle_details' => ['nullable', 'array'], // 不再必填，因为会重新计算
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => 400,
                'message' => '数据验证失败',
                'errors' => $validator->errors(),
            ], 400);
        }

        $data = $validator->validated();
        $user = Auth::user();

        // 更新全局管理员工资配置（全局值，影响所有未保存的月份）
        $newManagerSalary = AmountHelper::truncate($data['manager_salary']) ?? 0.0;
        SystemSetting::setManagerSalary($newManagerSalary);

        // 重新计算平均收入和车辆明细（基于新的管理员工资）
        try {
            $startDate = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
            $endDate = Carbon::create($data['year'], $data['month'], 1)->endOfMonth();
        } catch (\Exception $e) {
            return response()->json([
                'code' => 400,
                'message' => '日期格式错误',
            ], 400);
        }

        // 重新计算收付平衡数据（使用新的管理员工资）
        $calculationResult = $this->calculatePaymentBalance($data['year'], $data['month'], $startDate, $endDate, $newManagerSalary);

        // 使用手动修正的平均收入（如果提供），否则使用重新计算的自动平均收入
        $finalAverageIncome = $data['manual_average_income'] ?? $calculationResult['auto_average_income'];

        // 重新计算修正后的收付款（基于最终的平均收入）
        $updatedVehicleDetails = array_map(function ($vehicle) use ($finalAverageIncome) {
            $paymentAmount = $finalAverageIncome - $vehicle['net_income'];
            $paymentDueCorrected = $paymentAmount < 0 ? abs($paymentAmount) : 0;
            $paymentReceivableCorrected = $paymentAmount > 0 ? $paymentAmount : 0;

            return [
                ...$vehicle,
                'payment_due_corrected' => AmountHelper::truncate($paymentDueCorrected) ?? 0.0,
                'payment_receivable_corrected' => AmountHelper::truncate($paymentReceivableCorrected) ?? 0.0,
            ];
        }, $calculationResult['vehicle_details']);

        // 更新或创建快照
        // 注意：管理员工资同时保存到快照中（作为历史记录），这样已保存的快照会显示当时保存时的管理员工资
        // 未保存的数据会显示实时的全局管理员工资
        $snapshot = PaymentBalanceSnapshot::updateOrCreate(
            [
                'year' => $data['year'],
                'month' => $data['month'],
            ],
            [
                'auto_average_income' => AmountHelper::truncate($calculationResult['auto_average_income']) ?? 0.0, // 使用重新计算的值
                'manual_average_income' => $data['manual_average_income'] ? AmountHelper::truncate($data['manual_average_income']) : null,
                'manager_salary' => $newManagerSalary, // 保存到快照中，用于显示历史值
                'vehicle_details' => $updatedVehicleDetails, // 使用重新计算的车辆明细
                'operator_name' => $user->name ?? null,
            ]
        );

        return response()->json([
            'code' => 200,
            'message' => '保存成功',
            'data' => [
                'id' => $snapshot->id,
                'year' => $snapshot->year,
                'month' => $snapshot->month,
            ],
        ]);
    }
}
