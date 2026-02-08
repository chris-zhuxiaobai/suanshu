<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Cache;

Route::get('/welcome', function () {
    return view('welcome');
});

Route::get('/test', function () {
    return response()->json([
        'message' => Cache::store('redis')->get('test','hello world'),
        'time' => now()->toDateTimeString()
    ]);
});
