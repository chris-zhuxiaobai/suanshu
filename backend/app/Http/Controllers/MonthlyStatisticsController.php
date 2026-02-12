<?php

namespace App\Http\Controllers;

use App\Helpers\AmountHelper;
use App\Models\ConductorSchedule;
use App\Models\DailyIncome;
use App\Models\DailyStatistics;
use App\Models\Vehicle;
use App\Models\VehicleSchedule;
use App\Services\StatisticsService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class MonthlyStatisticsController extends Controller
{
    protected StatisticsService $statisticsService;

    public function __construct(StatisticsService $statisticsService)
    {
        $this->statisticsService = $statisticsService;
    }

    /**
     * 获取指定月份的统计数据
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

        // 查询所有在册车辆总数
        $totalVehicleCount = Vehicle::where('status', Vehicle::STATUS_ACTIVE)->count();

        // 查询该月份所有日统计数据
        $dailyStatistics = DailyStatistics::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->get();

        // 汇总统计数据
        $totalRevenue = $dailyStatistics->sum('total_revenue');
        $totalNetIncome = $dailyStatistics->sum('total_net_income');

        // 计算平均值：总营业额 / 所有在册车辆总数
        $averageRevenue = $totalVehicleCount > 0
            ? AmountHelper::truncate($totalRevenue / $totalVehicleCount)
            : 0;
        $averageNetIncome = $totalVehicleCount > 0
            ? AmountHelper::truncate($totalNetIncome / $totalVehicleCount)
            : 0;

        // 查询该月份所有已录入的收入记录
        $incomes = DailyIncome::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->with(['vehicle', 'conductor'])
            ->get();
        
        // 入账记录数（整个月的收入记录总数）
        $incomeRecordCount = $incomes->count();
        
        // 总休息车次（整个月所有休息的车次总数）
        $totalRestCount = VehicleSchedule::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where('status', VehicleSchedule::STATUS_REST)
            ->count();
        
        // 总加班车次（整个月所有加班的记录总数）
        $totalOvertimeCount = DailyIncome::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where('is_overtime', true)
            ->count();
        
        // 具体加班的车辆（去重，显示车辆ID和日期）
        $overtimeVehicles = DailyIncome::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->where('is_overtime', true)
            ->select('vehicle_id', 'date')
            ->get()
            ->groupBy('vehicle_id')
            ->map(function ($group) {
                return [
                    'vehicle_id' => $group->first()->vehicle_id,
                    'dates' => $group->pluck('date')->unique()->sort()->values()->toArray(),
                ];
            })
            ->values()
            ->toArray();

        // 查询所有在册车辆（用于计算平均值和正负值）
        $allVehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 查询该月份的售票员排班（用于未录入车辆显示服务员）
        $conductorSchedules = ConductorSchedule::where('year', $year)
            ->where('month', $month)
            ->pluck('conductor_id', 'vehicle_id')
            ->toArray();

        // 按车辆汇总整个月的收入数据
        $vehicleIncomeMap = [];
        foreach ($incomes as $income) {
            $vehicleId = $income->vehicle_id;
            if (!isset($vehicleIncomeMap[$vehicleId])) {
                $vehicleIncomeMap[$vehicleId] = [
                    'revenue' => 0,
                    'net_income' => 0,
                    'turn_count' => 0,
                    'turn1_amount' => 0, // 单转最高金额（取整个月的最大值）
                    'turn2_amount' => 0,
                    'turn3_amount' => 0,
                    'turn4_amount' => 0,
                    'turn5_amount' => 0,
                    'wechat_amount' => 0,
                    'fuel_subsidy' => 0,
                    'reward_penalty' => 0,
                    'has_income' => false,
                    'is_overtime' => false,
                    'conductor_id' => null,
                    'dates' => [], // 记录有收入的日期
                ];
            }
            $vehicleIncomeMap[$vehicleId]['revenue'] += $income->revenue;
            $vehicleIncomeMap[$vehicleId]['net_income'] += $income->net_income;
            $vehicleIncomeMap[$vehicleId]['turn_count'] += ($income->turn_count ?? 0);
            // 单转最高金额：取整个月的最大值（用于单转收入最高统计）
            $vehicleIncomeMap[$vehicleId]['turn1_amount'] = max($vehicleIncomeMap[$vehicleId]['turn1_amount'], (float) ($income->turn1_amount ?? 0));
            $vehicleIncomeMap[$vehicleId]['turn2_amount'] = max($vehicleIncomeMap[$vehicleId]['turn2_amount'], (float) ($income->turn2_amount ?? 0));
            $vehicleIncomeMap[$vehicleId]['turn3_amount'] = max($vehicleIncomeMap[$vehicleId]['turn3_amount'], (float) ($income->turn3_amount ?? 0));
            $vehicleIncomeMap[$vehicleId]['turn4_amount'] = max($vehicleIncomeMap[$vehicleId]['turn4_amount'], (float) ($income->turn4_amount ?? 0));
            $vehicleIncomeMap[$vehicleId]['turn5_amount'] = max($vehicleIncomeMap[$vehicleId]['turn5_amount'], (float) ($income->turn5_amount ?? 0));
            $vehicleIncomeMap[$vehicleId]['wechat_amount'] += (float) ($income->wechat_amount ?? 0);
            $vehicleIncomeMap[$vehicleId]['fuel_subsidy'] += (float) ($income->fuel_subsidy ?? 0);
            $vehicleIncomeMap[$vehicleId]['reward_penalty'] += (float) ($income->reward_penalty ?? 0);
            $vehicleIncomeMap[$vehicleId]['has_income'] = true;
            $vehicleIncomeMap[$vehicleId]['is_overtime'] = $vehicleIncomeMap[$vehicleId]['is_overtime'] || $income->is_overtime;
            // 服务员ID：优先使用最新的收入记录中的
            if ($income->conductor_id) {
                $vehicleIncomeMap[$vehicleId]['conductor_id'] = $income->conductor_id;
            }
            $vehicleIncomeMap[$vehicleId]['dates'][] = $income->date;
        }

        // 计算每辆车相对于平均值的正负值（包含所有在册车辆）
        $vehicleStatistics = $allVehicles->map(function ($vehicle) use ($vehicleIncomeMap, $conductorSchedules, $averageNetIncome) {
            $income = $vehicleIncomeMap[$vehicle->id] ?? null;

            // 如果没有录入，营业额和净收入为0
            $revenue = $income ? $income['revenue'] : 0;
            $netIncome = $income ? $income['net_income'] : 0;
            $turnCount = $income ? $income['turn_count'] : 0;

            // 5转收入、微信、补油款、奖罚（仅已录入时有值）
            $turn1 = $income ? $income['turn1_amount'] : 0;
            $turn2 = $income ? $income['turn2_amount'] : 0;
            $turn3 = $income ? $income['turn3_amount'] : 0;
            $turn4 = $income ? $income['turn4_amount'] : 0;
            $turn5 = $income ? $income['turn5_amount'] : 0;
            $turnTotal = $turn1 + $turn2 + $turn3 + $turn4 + $turn5; // 5转现金收入合计
            $wechatAmount = $income ? $income['wechat_amount'] : 0;
            $fuelSubsidy = $income ? $income['fuel_subsidy'] : 0;
            $rewardPenalty = $income ? $income['reward_penalty'] : 0;

            // 获取服务员ID：优先使用收入记录中的，如果没有则从售票员排班中获取
            $conductorId = $income
                ? ($income['conductor_id'] ?? null)
                : ($conductorSchedules[$vehicle->id] ?? null);

            // 计算收付款：平均净收入 - 当前车辆的净收入
            $paymentAmount = $averageNetIncome - $netIncome;

            return [
                'vehicle_id' => $vehicle->id,
                'vehicle' => [
                    'id' => $vehicle->id,
                    'status' => $vehicle->status,
                ],
                'conductor_id' => $conductorId,
                'revenue' => AmountHelper::truncate($revenue) ?? 0.0,
                'net_income' => AmountHelper::truncate($netIncome) ?? 0.0,
                'turn_count' => $turnCount,
                'turn_total' => AmountHelper::truncate($turnTotal) ?? 0.0,
                'turn1_amount' => AmountHelper::truncate($turn1) ?? 0.0,
                'turn2_amount' => AmountHelper::truncate($turn2) ?? 0.0,
                'turn3_amount' => AmountHelper::truncate($turn3) ?? 0.0,
                'turn4_amount' => AmountHelper::truncate($turn4) ?? 0.0,
                'turn5_amount' => AmountHelper::truncate($turn5) ?? 0.0,
                'wechat_amount' => AmountHelper::truncate($wechatAmount) ?? 0.0,
                'fuel_subsidy' => AmountHelper::truncate($fuelSubsidy) ?? 0.0,
                'reward_penalty' => AmountHelper::truncate($rewardPenalty) ?? 0.0,
                'payment_amount' => AmountHelper::truncate($paymentAmount) ?? 0.0,
                'remark' => '', // 月统计不显示备注
                'has_income' => $income !== null,
                'is_rest' => false, // 月统计不区分休息状态
                'is_overtime' => $income ? $income['is_overtime'] : false,
            ];
        });

        // 奖罚排行：按单次列出（每天每条记录都单独列出）
        $rewardPenaltyRankingRaw = [];
        foreach ($incomes as $income) {
            if ($income->reward_penalty != null && $income->reward_penalty != 0) {
                $rewardPenaltyRankingRaw[] = [
                    'date' => $income->date,
                    'vehicle_id' => $income->vehicle_id,
                    'conductor_id' => $income->conductor_id,
                    'reward_penalty' => (float) $income->reward_penalty,
                    'is_overtime' => $income->is_overtime ?? false,
                ];
            }
        }

        // 排序：正数在前，负数在后，同号时按绝对值降序
        usort($rewardPenaltyRankingRaw, function ($a, $b) {
            if ($a['reward_penalty'] > 0 && $b['reward_penalty'] <= 0) return -1;
            if ($a['reward_penalty'] <= 0 && $b['reward_penalty'] > 0) return 1;
            return abs($b['reward_penalty']) <=> abs($a['reward_penalty']);
        });

        // 如果超过24条，保留前20和后3，中间用省略号
        $rewardPenaltyRanking = [];
        $totalCount = count($rewardPenaltyRankingRaw);
        if ($totalCount > 24) {
            $top20 = array_slice($rewardPenaltyRankingRaw, 0, 20);
            $bottom3 = array_slice($rewardPenaltyRankingRaw, -3);
            foreach ($top20 as $index => $item) {
                $rewardPenaltyRanking[] = array_merge($item, ['rank' => $index + 1]);
            }
            $rewardPenaltyRanking[] = ['isEllipsis' => true, 'rank' => 21];
            foreach ($bottom3 as $index => $item) {
                $rewardPenaltyRanking[] = array_merge($item, ['rank' => $totalCount - 2 + $index]);
            }
        } else {
            foreach ($rewardPenaltyRankingRaw as $index => $item) {
                $rewardPenaltyRanking[] = array_merge($item, ['rank' => $index + 1]);
            }
        }

        // 统计该月有收入的车辆总数（去重）
        $enteredVehicleCount = count(array_filter($vehicleStatistics->toArray(), function ($v) {
            return $v['has_income'];
        }));

        return response()->json([
            'code' => 200,
            'data' => [
                'statistics' => [
                    'year' => $year,
                    'month' => $month,
                    'total_revenue' => AmountHelper::truncate($totalRevenue) ?? 0.0,
                    'total_net_income' => AmountHelper::truncate($totalNetIncome) ?? 0.0,
                    'vehicle_count' => $enteredVehicleCount, // 该月有收入的车辆总数（去重）
                    'total_vehicle_count' => $totalVehicleCount, // 所有在册车辆总数
                    'income_record_count' => $incomeRecordCount, // 入账记录数（整个月的收入记录总数）
                    'total_rest_count' => $totalRestCount, // 总休息车次（整个月所有休息的车次总数）
                    'total_overtime_count' => $totalOvertimeCount, // 总加班车次（整个月所有加班的记录总数）
                    'average_revenue' => $averageRevenue,
                    'average_net_income' => $averageNetIncome,
                ],
                'overtime_vehicles' => $overtimeVehicles, // 具体加班的车辆列表
                'vehicles' => $vehicleStatistics->values(),
                'reward_penalty_ranking' => $rewardPenaltyRanking,
            ],
        ]);
    }

    /**
     * 获取指定车辆在指定月份的每日收入记录详情
     *
     * @param string $vehicleId 车辆ID
     * @param int $year 年份
     * @param int $month 月份（1-12）
     * @return JsonResponse
     */
    public function getVehicleDetailByMonth(string $vehicleId, int $year, int $month): JsonResponse
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

        // 查询该车辆在该月份的所有收入记录
        $incomes = DailyIncome::where('vehicle_id', $vehicleId)
            ->whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->with(['vehicle', 'conductor'])
            ->orderBy('date', 'asc')
            ->get();

        // 转换为前端需要的格式
        $dailyRecords = $incomes->map(function ($income) {
            return [
                'date' => $income->date,
                'vehicle_id' => $income->vehicle_id,
                'conductor_id' => $income->conductor_id,
                'revenue' => AmountHelper::truncate($income->revenue) ?? 0.0,
                'net_income' => AmountHelper::truncate($income->net_income) ?? 0.0,
                'turn_count' => $income->turn_count ?? 0,
                'turn_total' => AmountHelper::truncate(
                    ($income->turn1_amount ?? 0) +
                    ($income->turn2_amount ?? 0) +
                    ($income->turn3_amount ?? 0) +
                    ($income->turn4_amount ?? 0) +
                    ($income->turn5_amount ?? 0)
                ) ?? 0.0,
                'turn1_amount' => AmountHelper::truncate($income->turn1_amount ?? 0) ?? 0.0,
                'turn2_amount' => AmountHelper::truncate($income->turn2_amount ?? 0) ?? 0.0,
                'turn3_amount' => AmountHelper::truncate($income->turn3_amount ?? 0) ?? 0.0,
                'turn4_amount' => AmountHelper::truncate($income->turn4_amount ?? 0) ?? 0.0,
                'turn5_amount' => AmountHelper::truncate($income->turn5_amount ?? 0) ?? 0.0,
                'wechat_amount' => AmountHelper::truncate($income->wechat_amount ?? 0) ?? 0.0,
                'fuel_subsidy' => AmountHelper::truncate($income->fuel_subsidy ?? 0) ?? 0.0,
                'reward_penalty' => AmountHelper::truncate($income->reward_penalty ?? 0) ?? 0.0,
                'payment_amount' => 0.0, // 月统计详情中不显示收付款
                'remark' => $income->remark ?? '',
                'is_overtime' => $income->is_overtime ?? false,
            ];
        });

        return response()->json([
            'code' => 200,
            'data' => [
                'vehicle_id' => $vehicleId,
                'year' => $year,
                'month' => $month,
                'records' => $dailyRecords,
            ],
        ]);
    }

    /**
     * 获取指定月份所有车辆的每日营业额数据（用于营收统计表格）
     *
     * @param int $year 年份
     * @param int $month 月份（1-12）
     * @return JsonResponse
     */
    public function getRevenueMatrix(int $year, int $month): JsonResponse
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

        // 获取该月的所有天数
        $daysInMonth = $endDate->day;
        
        // 获取所有在册车辆
        $allVehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 查询该月份所有收入记录
        $incomes = DailyIncome::whereBetween('date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
            ->get();

        // 构建数据矩阵：vehicle_id => [day => revenue]
        $revenueMatrix = [];
        $dailyTotals = []; // 每日汇总：day => total_revenue
        
        // 初始化所有车辆的所有日期为0
        foreach ($allVehicles as $vehicle) {
            $revenueMatrix[$vehicle->id] = [];
            for ($day = 1; $day <= $daysInMonth; $day++) {
                $revenueMatrix[$vehicle->id][$day] = 0.0;
            }
        }
        
        // 初始化每日汇总
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $dailyTotals[$day] = 0.0;
        }

        // 填充实际数据
        foreach ($incomes as $income) {
            $vehicleId = $income->vehicle_id;
            // date 字段在模型中已转换为 Carbon 实例
            $date = $income->date instanceof \Carbon\Carbon ? $income->date : Carbon::parse($income->date);
            $day = (int) $date->day;
            // revenue 字段可能不存在，需要计算：5转收入 + 微信收入
            $revenue = $income->revenue ?? $income->calculateRevenue();
            $revenue = AmountHelper::truncate($revenue) ?? 0.0;
            
            if (isset($revenueMatrix[$vehicleId]) && $day >= 1 && $day <= $daysInMonth) {
                $revenueMatrix[$vehicleId][$day] = $revenue;
                $dailyTotals[$day] += $revenue;
            }
        }

        // 计算每车的月度汇总
        $vehicleTotals = [];
        foreach ($allVehicles as $vehicle) {
            $vehicleTotals[$vehicle->id] = array_sum($revenueMatrix[$vehicle->id]);
        }

        // 计算总汇总（所有车辆所有日期的总和）
        $grandTotal = array_sum($vehicleTotals);

        // 转换为前端需要的格式
        $data = [];
        foreach ($allVehicles as $vehicle) {
            $row = [
                'vehicle_id' => $vehicle->id,
                'daily_revenues' => $revenueMatrix[$vehicle->id],
                'monthly_total' => $vehicleTotals[$vehicle->id],
            ];
            $data[] = $row;
        }

        return response()->json([
            'code' => 200,
            'data' => [
                'year' => $year,
                'month' => $month,
                'days_in_month' => $daysInMonth,
                'vehicles' => $data,
                'daily_totals' => $dailyTotals,
                'grand_total' => AmountHelper::truncate($grandTotal) ?? 0.0,
            ],
        ]);
    }
}
