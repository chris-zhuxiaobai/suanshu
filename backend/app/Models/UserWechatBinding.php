<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 用户微信绑定（小程序 openid/unionid）
 *
 * 用于小程序登录时通过 code 换 openid/unionid 查找或绑定用户。
 *
 * @property int $id
 * @property int $user_id
 * @property string $app_id 小程序 appid
 * @property string $openid 当前小程序下的 openid
 * @property string|null $unionid 同开放平台下多应用统一 id
 * @property string|null $nickname 微信昵称缓存
 * @property string|null $avatar_url 头像 URL 缓存
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property-read \App\Models\User $user
 */
class UserWechatBinding extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'app_id',
        'openid',
        'unionid',
        'nickname',
        'avatar_url',
    ];

    /**
     * 关联用户
     *
     * @return BelongsTo<\App\Models\User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
