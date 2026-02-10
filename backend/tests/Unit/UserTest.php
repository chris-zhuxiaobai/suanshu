<?php

namespace Tests\Unit;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_constants(): void
    {
        $this->assertSame('admin', User::ROLE_ADMIN);
        $this->assertSame('daily_admin', User::ROLE_DAILY_ADMIN);
        $this->assertSame('viewer', User::ROLE_VIEWER);
    }

    public function test_admin_can_login_web_and_can_enter_data(): void
    {
        $user = User::factory()->create([
            'username' => 'admin',
            'role' => User::ROLE_ADMIN,
        ]);

        $this->assertTrue($user->canLoginWeb());
        $this->assertTrue($user->canEnterData());
        $this->assertTrue($user->isAdmin());
        $this->assertFalse($user->isDailyAdmin());
    }

    public function test_daily_admin_can_login_web_and_can_enter_data(): void
    {
        $user = User::factory()->create([
            'username' => 'manager',
            'role' => User::ROLE_DAILY_ADMIN,
        ]);

        $this->assertTrue($user->canLoginWeb());
        $this->assertTrue($user->canEnterData());
        $this->assertFalse($user->isAdmin());
        $this->assertTrue($user->isDailyAdmin());
    }

    public function test_viewer_cannot_login_web_and_cannot_enter_data(): void
    {
        $user = User::factory()->create([
            'username' => null,
            'role' => User::ROLE_VIEWER,
        ]);

        $this->assertFalse($user->canLoginWeb());
        $this->assertFalse($user->canEnterData());
        $this->assertFalse($user->isAdmin());
        $this->assertFalse($user->isDailyAdmin());
    }

    public function test_wechat_bindings_relation(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_VIEWER]);

        $this->assertCount(0, $user->wechatBindings);

        $user->wechatBindings()->create([
            'app_id' => 'wx123',
            'openid' => 'openid1',
        ]);

        $user->refresh();
        $this->assertCount(1, $user->wechatBindings);
        $this->assertSame('wx123', $user->wechatBindings->first()->app_id);
        $this->assertSame('openid1', $user->wechatBindings->first()->openid);
    }
}
