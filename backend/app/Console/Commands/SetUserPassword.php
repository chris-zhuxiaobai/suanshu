<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SetUserPassword extends Command
{
    protected $signature = 'user:set-password {username : 用户名（admin 或日常管理员）} {password : 新密码（明文，将哈希后写入）}';

    protected $description = '为 Web 端账号设置密码（仅 admin / daily_admin）';

    public function handle(): int
    {
        $username = $this->argument('username');
        $password = $this->argument('password');

        $user = User::where('username', $username)->first();

        if (! $user) {
            $this->error("用户 {$username} 不存在。");
            return self::FAILURE;
        }

        if (! $user->canLoginWeb()) {
            $this->error("该用户不允许 Web 登录，无法设置密码。");
            return self::FAILURE;
        }

        $user->password = Hash::make($password);
        $user->save();

        // 密码修改后，为安全起见，强制踢下线该用户所有 Sanctum token。
        // 包含 Web 登录（name = 'web'）及未来可能扩展的小程序等终端。
        $user->tokens()->delete();

        $this->info("已为 {$username} 更新密码，并强制下线该用户的所有登录会话。");
        return self::SUCCESS;
    }
}
