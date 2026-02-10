<?php

use App\Exceptions\Handler;
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\EnsureTokenIsFresh;
use App\Http\Middleware\RequestLogMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(RequestLogMiddleware::class);
        $middleware->alias([
            // 覆盖框架默认 auth 中间件：API 未登录时不再尝试跳转到 route('login')
            'auth' => Authenticate::class,
            'can.enter.data' => \App\Http\Middleware\EnsureUserCanEnterData::class,
            'token.fresh' => EnsureTokenIsFresh::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        Handler::register($exceptions);
    })->create();
