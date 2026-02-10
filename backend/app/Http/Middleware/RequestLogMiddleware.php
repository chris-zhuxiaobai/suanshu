<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestLogMiddleware
{
    public const TRACE_ID_ATTRIBUTE = 'trace_id';

    /** 日志中需脱敏的键名（请求体、query、URI） */
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        '_token', // CSRF
        'token',  // 仅对 query/body 脱敏，Authorization header 不记录
    ];

    private static ?float $startTime = null;

    /**
     * 生成或透传全局 Trace-ID，记录请求与响应摘要（格式美观、便于 grep 追踪）。
     */
    public function handle(Request $request, Closure $next): Response
    {
        $traceId = $request->header('X-Trace-Id') ?: Str::uuid()->toString();
        $request->attributes->set(self::TRACE_ID_ATTRIBUTE, $traceId);
        self::$startTime = microtime(true);

        $this->logRequest($request, $traceId);

        $response = $next($request);

        $this->logResponse($request, $response, $traceId);

        $response->headers->set('X-Trace-Id', $traceId);

        return $response;
    }

    private function logRequest(Request $request, string $traceId): void
    {
        $method = $request->method();
        $uri = $this->sanitizeUri($request->fullUrl());
        $ip = $request->ip() ?? '-';

        Log::channel('daily')->info($this->formatBlock([
            'trace_id' => $traceId,
            'event'    => 'request',
            'method'   => $method,
            'uri'      => $uri,
            'ip'       => $ip,
        ]));
    }

    private function logResponse(Request $request, Response $response, string $traceId): void
    {
        $durationMs = self::$startTime !== null
            ? round((microtime(true) - self::$startTime) * 1000, 2)
            : 0;
        $status = $response->getStatusCode();

        Log::channel('daily')->info($this->formatBlock([
            'trace_id'   => $traceId,
            'event'      => 'response',
            'method'     => $request->method(),
            'uri'        => $request->getRequestUri(),
            'status'     => $status,
            'duration_ms'=> $durationMs,
        ]));
    }

    /**
     * 对 URL 中敏感 query 参数脱敏（如 ?password=xxx -> ?password=***）
     */
    private function sanitizeUri(string $fullUrl): string
    {
        $q = parse_url($fullUrl, PHP_URL_QUERY);
        if ($q === null || $q === '') {
            return $fullUrl;
        }
        parse_str($q, $params);
        $sanitized = $this->sanitizeArray($params);
        $base = str_contains($fullUrl, '?') ? explode('?', $fullUrl, 2)[0] : $fullUrl;
        return $base . '?' . http_build_query($sanitized);
    }

    /**
     * 对数组内敏感键脱敏，递归处理子数组。
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function sanitizeArray(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            $lower = is_string($key) ? strtolower($key) : $key;
            $isSensitive = in_array($lower, self::SENSITIVE_KEYS, true)
                || str_contains((string) $key, 'password')
                || str_contains((string) $key, 'token');
            if ($isSensitive && $value !== null && $value !== '') {
                $out[$key] = '***';
                continue;
            }
            $out[$key] = is_array($value) ? $this->sanitizeArray($value) : $value;
        }
        return $out;
    }

    /**
     * 格式化为易读单行，便于 grep trace_id 与日志采集。
     */
    private function formatBlock(array $data): string
    {
        $parts = [];
        foreach ($data as $key => $value) {
            $v = is_scalar($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE);
            $parts[] = $key . '=' . $v;
        }
        return 'HTTP ' . implode(' ', $parts);
    }
}
