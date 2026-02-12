<?php

namespace Database\Seeders;

use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VehicleSeeder extends Seeder
{
    /**
     * 初始化车辆数据（24 辆在册车辆）
     * 幂等性：如果 vehicles 表已有数据，则跳过
     */
    public function run(): void
    {
        // 幂等性检查：如果表已有数据，跳过
        if (Vehicle::count() > 0) {
            $this->command->info('车辆表已有数据，跳过初始化');
            return;
        }

        // 24 辆在册车辆（车牌后三位）
        $vehicles = [
            ['id' => '562', 'sort_order' => 1],
            ['id' => '191', 'sort_order' => 2],
            ['id' => '598', 'sort_order' => 3],
            ['id' => '786', 'sort_order' => 4],
            ['id' => '425', 'sort_order' => 5],
            ['id' => '987', 'sort_order' => 6],
            ['id' => '608', 'sort_order' => 7],
            ['id' => '991', 'sort_order' => 8],
            ['id' => '373', 'sort_order' => 9],
            ['id' => '780', 'sort_order' => 10],
            ['id' => '743', 'sort_order' => 11],
            ['id' => '833', 'sort_order' => 12],
            ['id' => '415', 'sort_order' => 13],
            ['id' => '975', 'sort_order' => 14],
            ['id' => '753', 'sort_order' => 15],
            ['id' => '203', 'sort_order' => 16],
            ['id' => '968', 'sort_order' => 17],
            ['id' => '427', 'sort_order' => 18],
            ['id' => '836', 'sort_order' => 19],
            ['id' => '727', 'sort_order' => 20],
            ['id' => '163', 'sort_order' => 21],
            ['id' => '416', 'sort_order' => 22],
            ['id' => '713', 'sort_order' => 23],
            ['id' => '779', 'sort_order' => 24],
        ];

        // 批量插入，设置默认状态为 active
        $now = now();
        $data = array_map(function ($vehicle) use ($now) {
            return [
                'id' => $vehicle['id'],
                'sort_order' => $vehicle['sort_order'],
                'status' => Vehicle::STATUS_ACTIVE,
                'remark' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $vehicles);

        DB::table('vehicles')->insert($data);

        $this->command->info(sprintf('成功初始化 %d 辆车辆', count($vehicles)));
    }
}
