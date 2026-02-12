<?php

return [

    /*
    |--------------------------------------------------------------------------
    | 导出管理员可访问的接口路径前缀（request path）
    |--------------------------------------------------------------------------
    |
    | export_admin 角色仅允许访问以下前缀的 API，其余接口返回 403。
    | 路径与 HTTP 请求的 path() 一致，例如 api 路由为 "api/daily-statistics"。
    | 统计页会顺带请求售票员排班、收入按日查询（只读），故需开放对应 GET 前缀。
    | 新增统计类接口时，在此追加前缀即可。
    |
    */
    'export_admin_allowed_path_prefixes' => [
        'api/daily-statistics',                // 日统计：by-date、recalculate、index
        'api/monthly-statistics',              // 月统计：by-month
        'api/conductor-schedules/by-month',    // 售票员排班按月查询（统计页加载时用）
        'api/daily-incomes/by-date',           // 收入按日查询（统计页同页录入数据加载用）
        'api/payment-balance/by-month',        // 收付平衡：按月查询（export_admin 可查看和导出）
    ],

];
