<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_web_login_success_returns_token_and_user(): void
    {
        User::factory()->create([
            'username' => 'admin',
            'password' => 'secret',
            'role' => User::ROLE_ADMIN,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'admin',
            'password' => 'secret',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'code',
            'message',
            'data' => [
                'token',
                'user' => ['id', 'name', 'username', 'role'],
            ],
        ]);
        $this->assertSame(200, $response->json('code'));
        $this->assertSame('admin', $response->json('data.user.username'));
        $this->assertSame(User::ROLE_ADMIN, $response->json('data.user.role'));
        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_web_login_fails_with_wrong_password(): void
    {
        User::factory()->create([
            'username' => 'admin',
            'role' => User::ROLE_ADMIN,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'admin',
            'password' => 'wrong',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['username'], 'data');
    }

    public function test_web_login_fails_for_viewer_role(): void
    {
        User::factory()->create([
            'username' => 'viewer1',
            'password' => 'secret',
            'role' => User::ROLE_VIEWER,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'viewer1',
            'password' => 'secret',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['username'], 'data');
    }

    public function test_web_login_validation_requires_username_and_password(): void
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['username', 'password'], 'data');
    }

    public function test_logout_deletes_current_token(): void
    {
        $user = User::factory()->create(['username' => 'admin', 'role' => User::ROLE_ADMIN]);
        $token = $user->createToken('web')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/auth/logout');

        $response->assertStatus(200);
        $response->assertJson(['code' => 200, 'message' => 'ok']);

        $this->assertCount(0, $user->fresh()->tokens);
    }

    public function test_me_returns_current_user_and_token_source(): void
    {
        $user = User::factory()->create([
            'username' => 'manager',
            'name' => '日常管理员',
            'role' => User::ROLE_DAILY_ADMIN,
        ]);
        $token = $user->createToken('web')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/auth/me');

        $response->assertStatus(200);
        $response->assertJsonPath('data.username', 'manager');
        $response->assertJsonPath('data.role', User::ROLE_DAILY_ADMIN);
        $response->assertJsonPath('data.token_source', 'web');
    }

    public function test_me_requires_authentication(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }

    public function test_miniprogram_login_returns_501_not_implemented(): void
    {
        $response = $this->postJson('/api/auth/miniprogram/login', ['code' => 'wx_code_123']);

        $response->assertStatus(501);
        $response->assertJsonPath('code', 501);
        $response->assertJsonPath('message', '小程序登录尚未实现');
    }

    public function test_can_enter_data_route_allows_admin_and_daily_admin(): void
    {
        $admin = User::factory()->create(['username' => 'admin', 'role' => User::ROLE_ADMIN]);
        $tokenAdmin = $admin->createToken('web')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $tokenAdmin)
            ->getJson('/api/auth/can-enter');

        $response->assertStatus(200);
        $response->assertJsonPath('data.ok', true);
    }

    public function test_can_enter_data_route_denies_viewer(): void
    {
        $viewer = User::factory()->create(['username' => null, 'role' => User::ROLE_VIEWER]);
        $tokenViewer = $viewer->createToken('miniprogram')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $tokenViewer)
            ->getJson('/api/auth/can-enter');

        $response->assertStatus(403);
        $response->assertJsonPath('code', 403);
        $response->assertJsonPath('message', '没有录入权限');
    }
}
