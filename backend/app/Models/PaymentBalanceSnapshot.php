<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * 收付平衡快照模型
 *
 * 存储每月收付平衡的快照数据，包括手动修正的平均收入和管理员工资
 *
 * @property int $id
 * @property int $year 年份
 * @property int $month 月份（1-12）
 * @property float $auto_average_income 自动计算的平均收入
 * @property float|null $manual_average_income 手动修正的平均收入
 * @property float $manager_salary 管理员工资（快照）
 * @property array $vehicle_details 车辆明细数据（JSON格式）
 * @property string|null $operator_name 操作员姓名
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class PaymentBalanceSnapshot extends Model
{
    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'year',
        'month',
        'auto_average_income',
        'manual_average_income',
        'manager_salary',
        'vehicle_details',
        'operator_name',
    ];

    /**
     * 类型转换
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'auto_average_income' => 'decimal:1',
            'manual_average_income' => 'decimal:1',
            'manager_salary' => 'decimal:1',
            'vehicle_details' => 'array',
        ];
    }

    /**
     * 创建时的验证规则
     *
     * @return array<string, mixed>
     */
    public static function createRules(): array
    {
        return [
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'auto_average_income' => ['required', 'numeric', 'min:0'],
            'manual_average_income' => ['nullable', 'numeric', 'min:0'],
            'manager_salary' => ['required', 'numeric', 'min:0'],
            'vehicle_details' => ['required', 'array'],
            'operator_name' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * 更新时的验证规则
     *
     * @param int $id 记录ID
     * @return array<string, mixed>
     */
    public static function updateRules(int $id): array
    {
        return [
            'manual_average_income' => ['nullable', 'numeric', 'min:0'],
            'manager_salary' => ['required', 'numeric', 'min:0'],
            'vehicle_details' => ['required', 'array'],
            'operator_name' => ['nullable', 'string', 'max:50'],
        ];
    }
}
