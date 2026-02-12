<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建售票员排班表
     * 记录每月每辆车的售票员配置（哪辆车配哪个售票员）
     */
    public function up(): void
    {
        Schema::create('conductor_schedules', function (Blueprint $table) {
            $table->id();
            $table->year('year')->comment('年份');
            $table->tinyInteger('month')->comment('月份（1-12）');
            $table->string('vehicle_id', 3)->comment('车辆ID（车牌后三位）');
            $table->string('conductor_id', 3)->comment('售票员ID（车牌后三位，标识售票员来自哪辆车）');
            $table->timestamps();

            // 唯一约束：每月每车只能有一个售票员
            $table->unique(['year', 'month', 'vehicle_id']);
            // 外键约束：车辆ID
            $table->foreign('vehicle_id')->references('id')->on('vehicles')->onDelete('cascade');
            // 外键约束：售票员ID（也是车辆ID）
            $table->foreign('conductor_id')->references('id')->on('vehicles')->onDelete('cascade');
            // 索引：用于查询某年月的排班
            $table->index(['year', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conductor_schedules');
    }
};
