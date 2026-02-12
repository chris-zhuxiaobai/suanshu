<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 创建系统配置表
     * 存储全局配置，如管理员工资等
     */
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique()->comment('配置键');
            $table->text('value')->nullable()->comment('配置值');
            $table->string('description')->nullable()->comment('配置说明');
            $table->timestamps();

            // 索引
            $table->index('key');
        });

        // 插入默认管理员工资配置
        DB::table('system_settings')->insert([
            'key' => 'manager_salary',
            'value' => '0',
            'description' => '管理员工资（全局配置）',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
