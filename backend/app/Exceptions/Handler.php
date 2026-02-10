<?php

namespace App\Exceptions;

use App\Http\Middleware\RequestLogMiddleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler
{
    /**
     * 统一异常渲染：返回 { code, message, data, trace_id }，并记录日志。
     */
    public static function register(\Illuminate\Foundation\Configuration\Exceptions $exceptions): void
    {
        $exceptions->renderable(function (Throwable $e, Request $request) {
            if (! $request->expectsJson() && ! $request->is('api/*')) {
                return null;
            }

            $traceId = $request->attributes->get(RequestLogMiddleware::TRACE_ID_ATTRIBUTE)
                ?? \Illuminate\Support\Str::uuid()->toString();

            $response = self::toJsonResponse($e, $traceId);
            $response->headers->set('X-Trace-Id', $traceId);

            \Illuminate\Support\Facades\Log::channel('single')->error(
                '[trace_id=' . $traceId . '] [event=exception] [message=' . $e->getMessage() . '] [class=' . get_class($e) . ']',
                [
                    'trace_id' => $traceId,
                    'exception' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]
            );

            return $response;
        });
    }

    private static function toJsonResponse(Throwable $e, string $traceId): Response
    {
        if ($e instanceof ValidationException) {
            return response()->json([
                'code'    => 422,
                'message' => $e->getMessage() ?: '校验失败',
                'data'    => $e->errors(),
                'trace_id'=> $traceId,
            ], 422);
        }

        if ($e instanceof AuthenticationException) {
            return response()->json([
                'code'    => 401,
                'message' => $e->getMessage() ?: '未授权',
                'data'    => null,
                'trace_id'=> $traceId,
            ], 401);
        }

        if ($e instanceof HttpException) {
            $status = $e->getStatusCode();
            return response()->json([
                'code'    => $status,
                'message' => $e->getMessage() ?: self::defaultMessageForStatus($status),
                'data'    => null,
                'trace_id'=> $traceId,
            ], $status);
        }

        $message = config('app.debug') ? $e->getMessage() : '服务器内部错误';

        return response()->json([
            'code'    => 500,
            'message' => $message,
            'data'    => null,
            'trace_id'=> $traceId,
        ], 500);
    }

    private static function defaultMessageForStatus(int $status): string
    {
        return match ($status) {
            401 => '未授权',
            403 => '禁止访问',
            404 => '资源不存在',
            405 => '方法不允许',
            422 => '校验失败',
            429 => '请求过于频繁',
            500 => '服务器内部错误',
            default => '请求失败',
        };
    }
}
