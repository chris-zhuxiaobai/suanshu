<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 为鉴权与多端登录扩展 users 表，并新增微信绑定表。
     * 角色：admin（常驻）、daily_admin（日常管理员）、viewer（仅小程序）。
     * Web 登录仅 admin/daily_admin，通过 username + password；viewer 无 password。
     * 使用原生 SQL 修改列可空性，避免依赖 doctrine/dbal。
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 64)->nullable()->unique()->after('id');
            $table->string('role', 32)->default('viewer')->after('remember_token');
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
            DB::statement('ALTER TABLE users MODIFY password VARCHAR(255) NULL');
        }
        if ($driver === 'sqlite') {
            DB::statement('CREATE TABLE users_new (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, username VARCHAR(64) NULL UNIQUE, name VARCHAR(255) NOT NULL, email VARCHAR(255) NULL, email_verified_at DATETIME NULL, password VARCHAR(255) NULL, remember_token VARCHAR(100) NULL, role VARCHAR(32) NOT NULL DEFAULT \'viewer\', created_at DATETIME NULL, updated_at DATETIME NULL)');
            DB::statement('INSERT INTO users_new (id, username, name, email, email_verified_at, password, remember_token, role, created_at, updated_at) SELECT id, username, name, email, email_verified_at, password, remember_token, role, created_at, updated_at FROM users');
            Schema::drop('users');
            Schema::rename('users_new', 'users');
        }

        Schema::create('user_wechat_bindings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('app_id', 64);
            $table->string('openid', 128);
            $table->string('unionid', 128)->nullable();
            $table->string('nickname', 128)->nullable();
            $table->string('avatar_url', 512)->nullable();
            $table->timestamps();

            $table->unique(['app_id', 'openid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_wechat_bindings');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'username']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL');
        }
        // sqlite down: restoring nullable is complex; leave columns as-is or document
    }
};
