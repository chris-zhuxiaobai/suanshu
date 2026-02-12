<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class VehicleController extends Controller
{
    /**
     * 车辆列表（支持搜索、分页、排序）
     */
    public function index(Request $request): JsonResponse
    {
        $query = Vehicle::query();

        // 搜索：车牌号（id）模糊匹配
        if ($request->has('search') && $request->input('search')) {
            $search = $request->input('search');
            $query->where('id', 'like', "%{$search}%");
        }

        // 状态筛选
        if ($request->has('status') && $request->input('status')) {
            $query->where('status', $request->input('status'));
        }

        // 排序：默认按 sort_order 升序，再按 id 升序
        $query->orderBy('sort_order')->orderBy('id');

        // 分页
        $perPage = $request->input('per_page', 15);
        $vehicles = $query->paginate($perPage);

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $vehicles,
        ]);
    }

    /**
     * 创建车辆
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate(Vehicle::createRules());
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        $vehicle = Vehicle::create($validated);

        return response()->json([
            'code' => 200,
            'message' => '创建成功',
            'data' => $vehicle,
        ], 201);
    }

    /**
     * 车辆详情
     */
    public function show(string $id): JsonResponse
    {
        $vehicle = Vehicle::find($id);

        if (! $vehicle) {
            return response()->json([
                'code' => 404,
                'message' => '车辆不存在',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'code' => 200,
            'message' => 'ok',
            'data' => $vehicle,
        ]);
    }

    /**
     * 更新车辆（不允许修改 id）
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $vehicle = Vehicle::find($id);

        if (! $vehicle) {
            return response()->json([
                'code' => 404,
                'message' => '车辆不存在',
                'data' => null,
            ], 404);
        }

        try {
            $validated = $request->validate(Vehicle::updateRules($id));
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 422,
                'message' => '验证失败',
                'data' => $e->errors(),
            ], 422);
        }

        $vehicle->update($validated);

        return response()->json([
            'code' => 200,
            'message' => '更新成功',
            'data' => $vehicle->fresh(),
        ]);
    }

    /**
     * 删除车辆
     * TODO: 删除前检查是否有关联数据（收入记录、排班等）
     */
    public function destroy(string $id): JsonResponse
    {
        $vehicle = Vehicle::find($id);

        if (! $vehicle) {
            return response()->json([
                'code' => 404,
                'message' => '车辆不存在',
                'data' => null,
            ], 404);
        }

        // TODO: 检查关联数据
        // if ($vehicle->hasRelatedData()) {
        //     return response()->json([
        //         'code' => 400,
        //         'message' => '该车辆存在关联数据，无法删除',
        //         'data' => null,
        //     ], 400);
        // }

        $vehicle->delete();

        return response()->json([
            'code' => 200,
            'message' => '删除成功',
            'data' => null,
        ]);
    }
}
