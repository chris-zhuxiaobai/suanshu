<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\Rule;

/**
 * 售票员排班模型
 *
 * 记录每月每辆车的售票员配置（哪辆车配哪个售票员）
 *
 * @property int $id
 * @property int $year 年份
 * @property int $month 月份（1-12）
 * @property string $vehicle_id 车辆ID（车牌后三位）
 * @property string $conductor_id 售票员ID（车牌后三位，标识售票员来自哪辆车）
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property-read Vehicle $vehicle 关联的车辆
 * @property-read Vehicle $conductor 关联的售票员（也是车辆）
 */
class ConductorSchedule extends Model
{
    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'year',
        'month',
        'vehicle_id',
        'conductor_id',
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
        ];
    }

    /**
     * 关联车辆（营运车辆）
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'id');
    }

    /**
     * 关联售票员（售票员所属车辆）
     */
    public function conductor(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'conductor_id', 'id');
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
            'vehicle_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'conductor_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
                'different:vehicle_id', // 售票员不能跟本车
            ],
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
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'schedules' => ['required', 'array', 'min:1'],
            'schedules.*.vehicle_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'schedules.*.conductor_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
        ];
    }

    /**
     * 更新时的验证规则
     *
     * @param  int  $id 排班记录ID
     * @return array<string, mixed>
     */
    public static function updateRules(int $id): array
    {
        return [
            'conductor_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
                function ($attribute, $value, $fail) use ($id) {
                    $schedule = self::find($id);
                    if ($schedule && $value === $schedule->vehicle_id) {
                        $fail('售票员不能跟本车');
                    }
                },
            ],
        ];
    }
}
