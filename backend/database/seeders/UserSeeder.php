<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * 创建 Web 端固定账号：admin（常驻管理员）、日常管理员。
     * 密码从环境变量读取；生产环境未设置则跳过，避免弱密码。
     */
    public function run(): void
    {
        $this->seedAdmin();
        $this->seedDailyAdmin();
    }

    private function seedAdmin(): void
    {
        $username = env('ADMIN_USERNAME', 'admin');
        $password = env('ADMIN_PASSWORD');

        if (app()->environment('production') && empty($password)) {
            $this->command->warn('ADMIN_PASSWORD 未设置，跳过创建 admin 账号。');
            return;
        }

        if (empty($password) && app()->environment('local')) {
            $password = 'Admin123!';
            $this->command->warn('本地环境使用默认 admin 密码: Admin123!，请勿用于生产。');
        }

        User::updateOrCreate(
            ['username' => $username],
            [
                'name'     => '常驻管理员',
                'email'    => $username . '@local',
                'password' => Hash::make($password),
                'role'     => User::ROLE_ADMIN,
            ]
        );
    }

    private function seedDailyAdmin(): void
    {
        // 默认用户名改为 pyh66，便于与前端默认填充值一致
        $username = env('DAILY_ADMIN_USERNAME', 'pyh66');
        $password = env('DAILY_ADMIN_PASSWORD');

        if (app()->environment('production') && empty($password)) {
            $this->command->warn('DAILY_ADMIN_PASSWORD 未设置，跳过创建日常管理员账号。');
            return;
        }

        if (empty($password) && app()->environment('local')) {
            $password = 'Manager123!';
            $this->command->warn('本地环境使用默认日常管理员密码: Manager123!，请勿用于生产。');
        }

        User::updateOrCreate(
            ['username' => $username],
            [
                'name'     => '日常管理员',
                'email'    => $username . '@local',
                'password' => Hash::make($password),
                'role'     => User::ROLE_DAILY_ADMIN,
            ]
        );
    }
}
