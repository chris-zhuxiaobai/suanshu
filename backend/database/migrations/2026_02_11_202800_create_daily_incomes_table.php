<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建每日收入记录表
     * 记录每天每辆车的收入情况
     */
    public function up(): void
    {
        Schema::create('daily_incomes', function (Blueprint $table) {
            $table->id();
            $table->date('date')->comment('收入日期');
            $table->string('vehicle_id', 3)->comment('车辆ID（车牌后三位）');
            $table->string('conductor_id', 3)->comment('售票员ID（车牌后三位）');
            
            // 5转收入（可为空）
            $table->decimal('turn1_amount', 10, 1)->nullable()->comment('第1转收入');
            $table->decimal('turn2_amount', 10, 1)->nullable()->comment('第2转收入');
            $table->decimal('turn3_amount', 10, 1)->nullable()->comment('第3转收入');
            $table->decimal('turn4_amount', 10, 1)->nullable()->comment('第4转收入');
            $table->decimal('turn5_amount', 10, 1)->nullable()->comment('第5转收入');
            
            // 其他收入项
            $table->decimal('wechat_amount', 10, 1)->default(0)->comment('微信收入');
            $table->decimal('fuel_subsidy', 10, 1)->default(0)->comment('补油款（正数）');
            $table->decimal('reward_penalty', 10, 1)->default(0)->comment('奖罚（正负值）');
            
            // 自动计算字段
            $table->decimal('revenue', 10, 1)->default(0)->comment('营业额（5转收入+微信收入）');
            $table->decimal('net_income', 10, 1)->default(0)->comment('净收入（营业额-补油款±奖罚）');
            $table->tinyInteger('turn_count')->default(0)->comment('转数（有收入的转数，不含第5转）');
            
            // 其他字段
            $table->boolean('is_overtime')->default(false)->comment('是否加班（轮休车辆录入时标记）');
            $table->string('operator_name', 64)->comment('操作员姓名');
            $table->text('remark')->nullable()->comment('备注');
            
            $table->timestamps();

            // 唯一约束：每天每车只能有一条记录
            $table->unique(['date', 'vehicle_id']);
            // 外键约束
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->onDelete('cascade');
            $table->foreign('conductor_id')->references('id')->on('vehicles')->onDelete('cascade');
            // 索引
            $table->index('date');
            $table->index('is_overtime');
            $table->index('operator_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_incomes');
    }
};
