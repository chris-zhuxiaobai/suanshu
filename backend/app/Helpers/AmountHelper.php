<?php

namespace App\Helpers;

/**
 * 金额处理辅助类
 * 用于统一处理金额精度（保留一位小数，截断不四舍五入）
 */
class AmountHelper
{
    /**
     * 截断金额到一位小数（不四舍五入）
     *
     * @param  float|string|null  $amount 金额
     * @return float|null
     */
    public static function truncate(float|string|null $amount): ?float
    {
        if ($amount === null || $amount === '') {
            return null;
        }

        $amount = (float) $amount;

        // 截断到一位小数：乘以10，向下取整，再除以10
        return floor($amount * 10) / 10;
    }

    /**
     * 批量截断金额数组
     *
     * @param  array<string, mixed>  $data 数据数组
     * @param  array<string>  $amountFields 金额字段名数组
     * @return array<string, mixed>
     */
    public static function truncateAmounts(array $data, array $amountFields): array
    {
        foreach ($amountFields as $field) {
            if (isset($data[$field])) {
                $data[$field] = self::truncate($data[$field]);
            }
        }

        return $data;
    }
}
