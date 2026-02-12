<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建车辆表
     * id 为车牌后三位（纯数字，3位），作为主键
     * sort_order 用于列表排序
     */
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->string('id', 3)->primary()->comment('车牌后三位，纯数字');
            $table->integer('sort_order')->default(0)->comment('排序字段，数值越小越靠前');
            $table->enum('status', ['active', 'inactive'])->default('active')->comment('状态：active=在册启用，inactive=停用');
            $table->text('remark')->nullable()->comment('备注');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
