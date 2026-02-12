<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 系统配置模型
 *
 * 存储全局配置，如管理员工资等
 *
 * @property int $id
 * @property string $key 配置键
 * @property string|null $value 配置值
 * @property string|null $description 配置说明
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class SystemSetting extends Model
{
    /**
     * 可批量赋值的属性
     *
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'description',
    ];

    /**
     * 获取配置值（静态方法）
     *
     * @param string $key 配置键
     * @param mixed $default 默认值
     * @return mixed
     */
    public static function getValue(string $key, $default = null)
    {
        $setting = self::where('key', $key)->first();
        return $setting ? $setting->value : $default;
    }

    /**
     * 设置配置值（静态方法）
     *
     * @param string $key 配置键
     * @param mixed $value 配置值
     * @param string|null $description 配置说明
     * @return self
     */
    public static function setValue(string $key, $value, ?string $description = null): self
    {
        return self::updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'description' => $description,
            ]
        );
    }

    /**
     * 获取管理员工资
     *
     * @return float
     */
    public static function getManagerSalary(): float
    {
        return (float) self::getValue('manager_salary', 0);
    }

    /**
     * 设置管理员工资
     *
     * @param float $salary 工资
     * @return self
     */
    public static function setManagerSalary(float $salary): self
    {
        return self::setValue('manager_salary', (string) $salary, '管理员工资（全局配置）');
    }
}
