<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建收付平衡快照表
     * 存储每月收付平衡的快照数据，包括手动修正的平均收入和管理员工资
     */
    public function up(): void
    {
        Schema::create('payment_balance_snapshots', function (Blueprint $table) {
            $table->id();
            $table->year('year')->comment('年份');
            $table->tinyInteger('month')->comment('月份（1-12）');
            $table->decimal('auto_average_income', 10, 1)->comment('自动计算的平均收入');
            $table->decimal('manual_average_income', 10, 1)->nullable()->comment('手动修正的平均收入');
            $table->decimal('manager_salary', 10, 1)->comment('管理员工资（快照）');
            $table->json('vehicle_details')->comment('车辆明细数据（JSON格式）');
            $table->string('operator_name')->nullable()->comment('操作员姓名');
            $table->timestamps();

            // 唯一约束：每月只能有一个快照
            $table->unique(['year', 'month']);
            // 索引：用于查询
            $table->index(['year', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_balance_snapshots');
    }
};
