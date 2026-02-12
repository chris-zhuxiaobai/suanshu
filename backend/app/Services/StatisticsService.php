<?php

namespace App\Services;

use App\Helpers\AmountHelper;
use App\Models\DailyIncome;
use App\Models\DailyStatistics;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 统计服务类
 *
 * 负责处理每日收入统计的计算和更新
 */
class StatisticsService
{
    /**
     * 计算并更新指定日期的统计数据
     *
     * @param string $date 日期（Y-m-d格式）
     * @return DailyStatistics
     */
    public function calculateAndUpdate(string $date): DailyStatistics
    {
        // 查询该日期所有已录入的收入记录
        $incomes = DailyIncome::where('date', $date)->get();

        // 计算统计数据（只统计已录入的车辆）
        $totalRevenue = $incomes->sum('revenue');
        $totalNetIncome = $incomes->sum('net_income');
        $enteredVehicleCount = $incomes->count();

        // 查询所有在册车辆总数（用于计算平均值）
        $totalVehicleCount = Vehicle::where('status', Vehicle::STATUS_ACTIVE)->count();

        // 计算平均值：总净收入 / 所有在册车辆总数（无论是否录入）
        $averageRevenue = $totalVehicleCount > 0
            ? AmountHelper::truncate($totalRevenue / $totalVehicleCount)
            : 0;
        $averageNetIncome = $totalVehicleCount > 0
            ? AmountHelper::truncate($totalNetIncome / $totalVehicleCount)
            : 0;

        // 更新或创建统计记录
        // vehicle_count 存储已录入的车辆数量（用于显示）
        return DailyStatistics::updateOrCreate(
            ['date' => $date],
            [
                'total_revenue' => AmountHelper::truncate($totalRevenue),
                'total_net_income' => AmountHelper::truncate($totalNetIncome),
                'vehicle_count' => $enteredVehicleCount, // 已录入的车辆数量
                'average_revenue' => $averageRevenue, // 基于所有在册车辆计算的平均值
                'average_net_income' => $averageNetIncome, // 基于所有在册车辆计算的平均值
            ]
        );
    }

    /**
     * 获取指定日期的统计数据
     *
     * @param string $date 日期（Y-m-d格式）
     * @return DailyStatistics|null
     */
    public function getByDate(string $date): ?DailyStatistics
    {
        return DailyStatistics::where('date', $date)->first();
    }

    /**
     * 获取指定日期范围的统计数据
     *
     * @param string $startDate 开始日期（Y-m-d格式）
     * @param string $endDate 结束日期（Y-m-d格式）
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getByDateRange(string $startDate, string $endDate)
    {
        return DailyStatistics::whereBetween('date', [$startDate, $endDate])
            ->orderBy('date', 'desc')
            ->get();
    }

    /**
     * 重新计算指定日期的统计数据（用于数据修复）
     *
     * @param string $date 日期（Y-m-d格式）
     * @return DailyStatistics
     */
    public function recalculate(string $date): DailyStatistics
    {
        return $this->calculateAndUpdate($date);
    }

    /**
     * 批量重新计算指定日期范围的统计数据
     *
     * @param string $startDate 开始日期（Y-m-d格式）
     * @param string $endDate 结束日期（Y-m-d格式）
     * @return int 更新的记录数
     */
    public function batchRecalculate(string $startDate, string $endDate): int
    {
        $count = 0;
        $currentDate = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);

        while ($currentDate->lte($end)) {
            $this->calculateAndUpdate($currentDate->format('Y-m-d'));
            $count++;
            $currentDate->addDay();
        }

        return $count;
    }
}
