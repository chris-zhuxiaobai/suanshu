<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建车辆排班表
     * 记录每天每辆车的排班状态（休息/营运）
     */
    public function up(): void
    {
        Schema::create('vehicle_schedules', function (Blueprint $table) {
            $table->id();
            $table->date('date')->comment('排班日期');
            $table->string('vehicle_id', 3)->comment('车辆ID（车牌后三位）');
            $table->enum('status', ['rest', 'operate'])->default('operate')->comment('状态：rest=休息，operate=营运');
            $table->timestamps();

            // 唯一约束：每天每车只能有一条排班记录
            $table->unique(['date', 'vehicle_id']);
            // 外键约束
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->onDelete('cascade');
            // 索引：用于查询某日期的排班
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicle_schedules');
    }
};
