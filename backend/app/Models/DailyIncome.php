<?php

namespace App\Models;

use App\Helpers\AmountHelper;
use App\Services\StatisticsService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\Rule;

/**
 * 每日收入记录模型
 *
 * 记录每天每辆车的收入情况
 *
 * @property int $id
 * @property string $date 收入日期（Y-m-d）
 * @property string $vehicle_id 车辆ID（车牌后三位）
 * @property string $conductor_id 售票员ID（车牌后三位）
 * @property float|null $turn1_amount 第1转收入
 * @property float|null $turn2_amount 第2转收入
 * @property float|null $turn3_amount 第3转收入
 * @property float|null $turn4_amount 第4转收入
 * @property float|null $turn5_amount 第5转收入
 * @property float $wechat_amount 微信收入
 * @property float $fuel_subsidy 补油款
 * @property float $reward_penalty 奖罚
 * @property float $revenue 营业额（自动计算）
 * @property float $net_income 净收入（自动计算）
 * @property int $turn_count 转数（自动计算）
 * @property bool $is_overtime 是否加班
 * @property string $operator_name 操作员姓名
 * @property string|null $remark 备注
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property-read Vehicle $vehicle 关联的车辆
 * @property-read Vehicle $conductor 关联的售票员
 */
class DailyIncome extends Model
{
    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'date',
        'vehicle_id',
        'conductor_id',
        'turn1_amount',
        'turn2_amount',
        'turn3_amount',
        'turn4_amount',
        'turn5_amount',
        'wechat_amount',
        'fuel_subsidy',
        'reward_penalty',
        'is_overtime',
        'operator_name',
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
            'date' => 'date',
            'turn1_amount' => 'decimal:1',
            'turn2_amount' => 'decimal:1',
            'turn3_amount' => 'decimal:1',
            'turn4_amount' => 'decimal:1',
            'turn5_amount' => 'decimal:1',
            'wechat_amount' => 'decimal:1',
            'fuel_subsidy' => 'decimal:1',
            'reward_penalty' => 'decimal:1',
            'revenue' => 'decimal:1',
            'net_income' => 'decimal:1',
            'turn_count' => 'integer',
            'is_overtime' => 'boolean',
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
     * 关联售票员
     */
    public function conductor(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'conductor_id', 'id');
    }

    /**
     * 计算营业额（5转收入 + 微信收入）
     */
    public function calculateRevenue(): float
    {
        $turnTotal = 0;
        for ($i = 1; $i <= 5; $i++) {
            $amount = $this->getAttribute("turn{$i}_amount");
            if ($amount !== null) {
                $turnTotal += $amount;
            }
        }

        $revenue = $turnTotal + ($this->wechat_amount ?? 0);
        return AmountHelper::truncate($revenue) ?? 0.0;
    }

    /**
     * 计算净收入（实际分配金额）= 营业额 - 补油款 + 奖罚
     */
    public function calculateNetIncome(): float
    {
        $revenue = $this->revenue ?? $this->calculateRevenue();
        $fuelSubsidy = (float) ($this->getAttribute('fuel_subsidy') ?? 0);
        $rewardPenalty = (float) ($this->getAttribute('reward_penalty') ?? 0);

        $netIncome = $revenue - $fuelSubsidy + $rewardPenalty;
        return AmountHelper::truncate($netIncome) ?? 0.0;
    }

    /**
     * 计算转数（有收入的转数，不含第5转）
     */
    public function calculateTurnCount(): int
    {
        $count = 0;
        for ($i = 1; $i <= 4; $i++) {
            $amount = $this->getAttribute("turn{$i}_amount");
            if ($amount !== null && $amount > 0) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * 保存前自动计算字段
     */
    protected static function boot(): void
    {
        parent::boot();

        static::saving(function ($model) {
            // 处理金额精度（截断到一位小数）
            $amountFields = [
                'turn1_amount', 'turn2_amount', 'turn3_amount', 'turn4_amount', 'turn5_amount',
                'wechat_amount', 'fuel_subsidy', 'reward_penalty',
            ];

            foreach ($amountFields as $field) {
                if (isset($model->$field) && $model->$field !== null && $model->$field !== '') {
                    $model->$field = AmountHelper::truncate($model->$field);
                }
            }

            // 自动计算营业额、净收入、转数
            $model->revenue = $model->calculateRevenue();
            $model->net_income = $model->calculateNetIncome();
            $model->turn_count = $model->calculateTurnCount();
        });

        // 保存或更新后自动更新统计数据
        static::saved(function ($model) {
            if ($model->date) {
                app(StatisticsService::class)->calculateAndUpdate($model->date->format('Y-m-d'));
            }
        });

        // 删除后自动更新统计数据
        static::deleted(function ($model) {
            if ($model->date) {
                app(StatisticsService::class)->calculateAndUpdate($model->date->format('Y-m-d'));
            }
        });
    }

    /**
     * 创建时的验证规则
     *
     * @return array<string, mixed>
     */
    public static function createRules(): array
    {
        return [
            'date' => ['required', 'date', 'before_or_equal:today'],
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
            ],
            'turn1_amount' => ['nullable', 'numeric', 'min:0'],
            'turn2_amount' => ['nullable', 'numeric', 'min:0'],
            'turn3_amount' => ['nullable', 'numeric', 'min:0'],
            'turn4_amount' => ['nullable', 'numeric', 'min:0'],
            'turn5_amount' => ['nullable', 'numeric', 'min:0'],
            'wechat_amount' => ['nullable', 'numeric', 'min:0'],
            'fuel_subsidy' => ['nullable', 'numeric', 'min:0'],
            'reward_penalty' => ['nullable', 'numeric'],
            'is_overtime' => ['nullable', 'boolean'],
            'remark' => ['nullable', 'string', 'max:1000'],
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
            'conductor_id' => [
                'sometimes',
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'turn1_amount' => ['nullable', 'numeric', 'min:0'],
            'turn2_amount' => ['nullable', 'numeric', 'min:0'],
            'turn3_amount' => ['nullable', 'numeric', 'min:0'],
            'turn4_amount' => ['nullable', 'numeric', 'min:0'],
            'turn5_amount' => ['nullable', 'numeric', 'min:0'],
            'wechat_amount' => ['nullable', 'numeric', 'min:0'],
            'fuel_subsidy' => ['nullable', 'numeric', 'min:0'],
            'reward_penalty' => ['nullable', 'numeric'],
            'is_overtime' => ['nullable', 'boolean'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * 批量创建时的验证规则
     *
     * @return array<string, mixed>
     */
    public static function batchCreateRules(): array
    {
        return [
            'date' => ['required', 'date', 'before_or_equal:today'],
            'incomes' => ['required', 'array', 'min:1'],
            'incomes.*.vehicle_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'incomes.*.conductor_id' => [
                'required',
                'string',
                'size:3',
                'regex:/^\d{3}$/',
                'exists:vehicles,id',
            ],
            'incomes.*.turn1_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.turn2_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.turn3_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.turn4_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.turn5_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.wechat_amount' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.fuel_subsidy' => ['nullable', 'numeric', 'min:0'],
            'incomes.*.reward_penalty' => ['nullable', 'numeric'],
            'incomes.*.is_overtime' => ['nullable', 'boolean'],
            'incomes.*.remark' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
