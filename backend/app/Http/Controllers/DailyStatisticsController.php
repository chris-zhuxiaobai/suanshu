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
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DailyStatisticsController extends Controller
{
    protected StatisticsService $statisticsService;

    public function __construct(StatisticsService $statisticsService)
    {
        $this->statisticsService = $statisticsService;
    }

    /**
     * 获取指定日期的统计数据
     *
     * @param string $date 日期（Y-m-d格式）
     * @return JsonResponse
     */
    public function getByDate(string $date): JsonResponse
    {
        // 验证日期格式
        try {
            $dateObj = Carbon::parse($date);
        } catch (\Exception $e) {
            return response()->json([
                'code' => 400,
                'message' => '日期格式错误',
            ], 400);
        }

        // 查询所有在册车辆总数
        $totalVehicleCount = Vehicle::where('status', Vehicle::STATUS_ACTIVE)->count();

        // 获取或计算统计数据
        $statistics = $this->statisticsService->getByDate($date);
        if (!$statistics) {
            // 如果不存在，尝试计算
            $statistics = $this->statisticsService->calculateAndUpdate($date);
        }

        // 查询所有在册车辆（用于计算平均值和正负值）
        $allVehicles = Vehicle::where('status', Vehicle::STATUS_ACTIVE)
            ->orderBy('id')
            ->get();

        // 查询该日期所有已录入的收入记录
        $incomes = DailyIncome::where('date', $date)
            ->with(['vehicle', 'conductor'])
            ->get()
            ->keyBy('vehicle_id'); // 用 vehicle_id 作为 key，方便查找

        // 查询该日期的车辆排班状态
        $schedules = VehicleSchedule::where('date', $date)
            ->pluck('status', 'vehicle_id')
            ->toArray();

        // 查询该日期所在月份的售票员排班（用于未录入车辆显示服务员）
        $year = $dateObj->year;
        $month = $dateObj->month;
        $conductorSchedules = ConductorSchedule::where('year', $year)
            ->where('month', $month)
            ->pluck('conductor_id', 'vehicle_id')
            ->toArray();

        // 计算每辆车相对于平均值的正负值（包含所有在册车辆）
        $restVehicleCount = 0; // 统计休息车辆数
        $vehicleStatistics = $allVehicles->map(function ($vehicle) use ($incomes, $schedules, $conductorSchedules, $statistics, &$restVehicleCount) {
            // 查找该车辆是否有收入记录
            $income = $incomes->get($vehicle->id);
            
            // 检查是否休息（如果没有排班记录，默认营运）
            $isRest = ($schedules[$vehicle->id] ?? VehicleSchedule::STATUS_OPERATE) === VehicleSchedule::STATUS_REST;
            
            // 统计休息车辆数
            if ($isRest) {
                $restVehicleCount++;
            }
            
            // 如果没有录入，营业额和净收入为0
            $revenue = $income ? $income->revenue : 0;
            $netIncome = $income ? $income->net_income : 0;
            $turnCount = $income ? ($income->turn_count ?? 0) : 0; // 转数（仅已录入的车辆有）

            // 5转收入、微信、补油款、奖罚（仅已录入时有值）
            $turn1 = $income ? (float) ($income->turn1_amount ?? 0) : 0;
            $turn2 = $income ? (float) ($income->turn2_amount ?? 0) : 0;
            $turn3 = $income ? (float) ($income->turn3_amount ?? 0) : 0;
            $turn4 = $income ? (float) ($income->turn4_amount ?? 0) : 0;
            $turn5 = $income ? (float) ($income->turn5_amount ?? 0) : 0;
            $turnTotal = $turn1 + $turn2 + $turn3 + $turn4 + $turn5; // 5转现金收入合计
            $wechatAmount = $income ? (float) ($income->wechat_amount ?? 0) : 0;
            $fuelSubsidy = $income ? (float) ($income->fuel_subsidy ?? 0) : 0;
            $rewardPenalty = $income ? (float) ($income->reward_penalty ?? 0) : 0;

            // 获取服务员ID：优先使用收入记录中的，如果没有则从售票员排班中获取
            $conductorId = $income
                ? $income->conductor_id
                : ($conductorSchedules[$vehicle->id] ?? null);

            // 计算收付款：平均净收入 - 当前车辆的净收入
            // 正数表示应收钱（车辆收入低于平均值），负数表示应付钱（车辆收入高于平均值）
            $paymentAmount = $statistics->average_net_income - $netIncome;

            return [
                'vehicle_id' => $vehicle->id,
                'vehicle' => [
                    'id' => $vehicle->id,
                    'status' => $vehicle->status,
                ],
                'conductor_id' => $conductorId, // 服务员ID（已录入的从收入记录获取，未录入的从排班获取）
                'revenue' => $revenue,
                'net_income' => $netIncome,
                'turn_count' => $turnCount, // 转数（第1-4转中有收入的转数）
                'turn_total' => AmountHelper::truncate($turnTotal) ?? 0.0, // 现金收入（5转合计）
                'turn1_amount' => AmountHelper::truncate($turn1) ?? 0.0,
                'turn2_amount' => AmountHelper::truncate($turn2) ?? 0.0,
                'turn3_amount' => AmountHelper::truncate($turn3) ?? 0.0,
                'turn4_amount' => AmountHelper::truncate($turn4) ?? 0.0,
                'turn5_amount' => AmountHelper::truncate($turn5) ?? 0.0,
                'wechat_amount' => $wechatAmount,
                'fuel_subsidy' => $fuelSubsidy,
                'reward_penalty' => $rewardPenalty,
                'payment_amount' => AmountHelper::truncate($paymentAmount) ?? 0.0, // 收付款金额（截断到一位小数）
                'remark' => $income ? ($income->remark ?? '') : '',
                'has_income' => $income !== null, // 标记是否已录入
                'is_rest' => $isRest, // 标记是否休息
                'is_overtime' => $income ? $income->is_overtime : false, // 标记是否加班
            ];
        });

        return response()->json([
            'code' => 200,
            'data' => [
                'statistics' => [
                    'date' => $statistics->date->format('Y-m-d'),
                    'total_revenue' => $statistics->total_revenue,
                    'total_net_income' => $statistics->total_net_income,
                    'vehicle_count' => $statistics->vehicle_count, // 已录入的车辆数量
                    'total_vehicle_count' => $totalVehicleCount, // 所有在册车辆总数
                    'rest_vehicle_count' => $restVehicleCount, // 今日休息的车辆数量
                    'average_revenue' => $statistics->average_revenue,
                    'average_net_income' => $statistics->average_net_income,
                ],
                'vehicles' => $vehicleStatistics->values(), // 转换为数组
            ],
        ]);
    }

    /**
     * 获取日期范围的统计数据列表
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = DailyStatistics::query();

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

        // 排序
        $query->orderBy('date', 'desc');

        // 分页
        $perPage = $request->input('per_page', 15);
        $statistics = $query->paginate($perPage);

        return response()->json([
            'code' => 200,
            'data' => $statistics->items(),
            'pagination' => [
                'total' => $statistics->total(),
                'per_page' => $statistics->perPage(),
                'current_page' => $statistics->currentPage(),
                'last_page' => $statistics->lastPage(),
            ],
        ]);
    }

    /**
     * 手动重新计算指定日期的统计数据
     *
     * @param string $date 日期（Y-m-d格式）
     * @return JsonResponse
     */
    public function recalculate(string $date): JsonResponse
    {
        try {
            $dateObj = Carbon::parse($date);
        } catch (\Exception $e) {
            return response()->json([
                'code' => 400,
                'message' => '日期格式错误',
            ], 400);
        }

        $statistics = $this->statisticsService->recalculate($date);

        return response()->json([
            'code' => 200,
            'message' => '重新计算成功',
            'data' => $statistics,
        ]);
    }
}
