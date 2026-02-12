<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建每日统计表
     * 记录每天的收入统计数据，包括总额、平均值等
     */
    public function up(): void
    {
        Schema::create('daily_statistics', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique()->comment('统计日期');
            
            // 汇总数据
            $table->decimal('total_revenue', 12, 1)->default(0)->comment('总营业额');
            $table->decimal('total_net_income', 12, 1)->default(0)->comment('总净收入');
            $table->integer('vehicle_count')->default(0)->comment('录入收入的车辆数量');
            
            // 平均值
            $table->decimal('average_revenue', 10, 1)->default(0)->comment('平均营业额');
            $table->decimal('average_net_income', 10, 1)->default(0)->comment('平均净收入');
            
            $table->timestamps();
            
            // 索引
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_statistics');
    }
};
