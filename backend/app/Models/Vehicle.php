<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * 车辆模型
 *
 * id 为车牌后三位（纯数字，3位），作为主键，非自增
 *
 * @property string $id 车牌后三位
 * @property int $sort_order 排序字段
 * @property 'active'|'inactive' $status 状态
 * @property string|null $remark 备注
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class Vehicle extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    /**
     * 主键字段名
     */
    protected $primaryKey = 'id';

    /**
     * 主键是否自增
     */
    public $incrementing = false;

    /**
     * 主键类型
     */
    protected $keyType = 'string';

    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'sort_order',
        'status',
        'remark',
    ];

    /**
     * 类型转换
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
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
            'id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'unique:vehicles,id',
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', Rule::in([self::STATUS_ACTIVE, self::STATUS_INACTIVE])],
            'remark' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * 更新时的验证规则
     *
     * @param  string  $id 车辆 ID（车牌号）
     * @return array<string, mixed>
     */
    public static function updateRules(string $id): array
    {
        return [
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', Rule::in([self::STATUS_ACTIVE, self::STATUS_INACTIVE])],
            'remark' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * 是否启用
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
