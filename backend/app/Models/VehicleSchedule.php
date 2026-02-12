<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\Rule;

/**
 * 车辆排班模型
 *
 * 记录每天每辆车的排班状态（休息/营运）
 *
 * @property int $id
 * @property string $date 排班日期（Y-m-d）
 * @property string $vehicle_id 车辆ID（车牌后三位）
 * @property 'rest'|'operate' $status 状态：rest=休息，operate=营运
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property-read Vehicle $vehicle 关联的车辆
 */
class VehicleSchedule extends Model
{
    public const STATUS_REST = 'rest';
    public const STATUS_OPERATE = 'operate';

    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'date',
        'vehicle_id',
        'status',
    ];

    /**
     * 类型转换
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    /**
     * 关联车辆
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'id');
    }

    /**
     * 创建时的验证规则
     *
     * @return array<string, mixed>
     */
    public static function createRules(): array
    {
        return [
            'date' => ['required', 'date', 'after_or_equal:today'],
            'vehicle_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'status' => ['required', Rule::in([self::STATUS_REST, self::STATUS_OPERATE])],
        ];
    }

    /**
     * 批量创建时的验证规则（用于批量排班）
     *
     * @return array<string, mixed>
     */
    public static function batchCreateRules(): array
    {
        return [
            'date' => ['required', 'date', 'after_or_equal:today'],
            'vehicle_ids' => ['required', 'array', 'min:1'],
            'vehicle_ids.*' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'status' => ['required', Rule::in([self::STATUS_REST, self::STATUS_OPERATE])],
        ];
    }

    /**
     * 更新时的验证规则
     *
     * @return array<string, mixed>
     */
    public static function updateRules(): array
    {
        return [
            'status' => ['required', Rule::in([self::STATUS_REST, self::STATUS_OPERATE])],
        ];
    }

    /**
     * 是否休息
     */
    public function isRest(): bool
    {
        return $this->status === self::STATUS_REST;
    }

    /**
     * 是否营运
     */
    public function isOperate(): bool
    {
        return $this->status === self::STATUS_OPERATE;
    }
}
