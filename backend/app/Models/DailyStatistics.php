<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 每日统计模型
 *
 * 记录每天的收入统计数据，包括总额、平均值等
 *
 * @property int $id
 * @property string $date 统计日期（Y-m-d）
 * @property float $total_revenue 总营业额
 * @property float $total_net_income 总净收入
 * @property int $vehicle_count 录入收入的车辆数量
 * @property float $average_revenue 平均营业额
 * @property float $average_net_income 平均净收入
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class DailyStatistics extends Model
{
    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'date',
        'total_revenue',
        'total_net_income',
        'vehicle_count',
        'average_revenue',
        'average_net_income',
    ];

    /**
     * 类型转换
     *
     * @var array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'total_revenue' => 'decimal:1',
            'total_net_income' => 'decimal:1',
            'vehicle_count' => 'integer',
            'average_revenue' => 'decimal:1',
            'average_net_income' => 'decimal:1',
        ];
    }
}
