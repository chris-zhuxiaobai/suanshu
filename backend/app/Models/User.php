<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * 用户模型（鉴权与多端）
 *
 * 角色：admin 常驻管理员、daily_admin 日常管理员、export_admin 导出管理员、viewer 仅小程序。
 * Web 登录：admin / daily_admin / export_admin；export_admin 仅可访问统计相关接口。
 *
 * @property int $id
 * @property string|null $username Web 登录用，admin/daily_admin 必填
 * @property string $name
 * @property string|null $email
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 * @property string|null $password 仅 Web 登录账号必填
 * @property string|null $remember_token
 * @property string $role admin|daily_admin|export_admin|viewer
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\UserWechatBinding> $wechatBindings
 */
class User extends Authenticatable
{
    public const ROLE_ADMIN = 'admin';
    public const ROLE_DAILY_ADMIN = 'daily_admin';
    public const ROLE_VIEWER = 'viewer';
    public const ROLE_EXPORT_ADMIN = 'export_admin';

    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * 是否允许登录 Web（admin / daily_admin / export_admin）
     */
    public function canLoginWeb(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_DAILY_ADMIN, self::ROLE_EXPORT_ADMIN], true);
    }

    /**
     * 是否允许录入（admin / daily_admin）
     */
    public function canEnterData(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_DAILY_ADMIN], true);
    }

    /**
     * 是否为常驻管理员
     */
    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * 是否为日常管理员
     */
    public function isDailyAdmin(): bool
    {
        return $this->role === self::ROLE_DAILY_ADMIN;
    }

    /**
     * 是否为导出管理员（仅可访问统计相关接口）
     */
    public function isExportAdmin(): bool
    {
        return $this->role === self::ROLE_EXPORT_ADMIN;
    }

    /**
     * 微信绑定（小程序 openid/unionid）
     *
     * @return HasMany<\App\Models\UserWechatBinding, $this>
     */
    public function wechatBindings(): HasMany
    {
        return $this->hasMany(UserWechatBinding::class);
    }

    /**
     * 当前请求的 token 来源：web / miniprogram，用于统计与审计
     */
    public function tokenSource(): ?string
    {
        $token = $this->currentAccessToken();

        return $token ? $token->name : null;
    }
}
