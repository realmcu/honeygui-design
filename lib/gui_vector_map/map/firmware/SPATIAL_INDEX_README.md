# 空间索引优化 (Spatial Index Optimization)

## 概述

本文档描述了地图渲染的空间索引优化实现，用于解决大地图在小视口下渲染性能问题。

**v7 新增**: 除了道路边(edges)的空间索引外，还增加了区域(areas)的空间索引，用于加速水域、公园、建筑等多边形区域的渲染。

## 问题背景

### 原始问题
在渲染 300 米半径的地图视口时，系统需要遍历整个地图的所有道路边（edges）和区域（areas）：

```
地图总边数: 164,706 条
地图总区域数: 50,000+ 个
视口大小: 0.0083 度 (约 900 米)
实际渲染: ~100 条道路, ~50 个区域
```

**问题**: 每次渲染都需要遍历所有边和区域来找出视口内的元素，造成大量无效计算。

### 根本原因
原始的 `render_roads_with_options` 和 `render_areas_with_options` 函数使用 O(n) 遍历策略：

```c
for (uint32_t i = 0; i < map->header.edge_count; i++)  // 遍历所有边
{
    // 坐标转换
    // 边界检查
    // 渲染
}

for (uint32_t i = 0; i < map->header.area_count; i++)  // 遍历所有区域
{
    // 计算边界框
    // 边界检查
    // 渲染
}
```

## 解决方案：网格空间索引

### 原理
将地图区域划分为固定大小的网格单元（Grid Cells），在地图转换阶段预先计算每条边和每个区域所属的网格单元。渲染时只查询视口覆盖的网格单元中的元素。

```
+---+---+---+---+---+
| 0 | 1 | 2 | 3 | 4 |
+---+---+---+---+---+
| 5 | 6 | 7 | 8 | 9 |
+---+---+---+---+---+
|10 |11 |12 |13 |14 |
+---+---+---+---+---+

视口覆盖单元格: 6, 7, 11, 12
只查询这 4 个单元格中的边和区域
```

### 数据结构

#### 地图文件格式 (v7)

```c
/* Map file header (76 bytes for v7) */
typedef struct {
    // ... 之前的字段 ...
    
    /* v6 additions: spatial index for edges */
    uint16_t grid_cols;               /* 网格列数 */
    uint16_t grid_rows;               /* 网格行数 */
    uint32_t spatial_index_count;     /* 边索引条目总数 */
    
    /* v7 additions: spatial index for areas */
    uint32_t area_spatial_index_count; /* 区域索引条目总数 */
} map_header_t;

/* Map data structure */
typedef struct {
    // ... 之前的字段 ...
    
    /* Spatial index (v6) - for fast edge rendering */
    uint32_t *cell_offsets;       /* 每个单元格的边偏移量 */
    uint32_t *cell_edges;         /* 按单元格组织的边索引 */
    
    /* Area spatial index (v7) - for fast area rendering */
    uint32_t *area_cell_offsets;  /* 每个单元格的区域偏移量 */
    uint32_t *area_cell_indices;  /* 按单元格组织的区域索引 */
} map_t;
```

#### 索引结构

```
cell_offsets: [0, 15, 42, 67, ...]  // 每个单元格在 cell_edges 中的起始位置
cell_edges:   [边0, 边5, 边12, ...]  // 按单元格分组的边索引
```

## 实现细节

### 1. 地图转换阶段 (convert_map.py)

```python
# 配置
SPATIAL_INDEX_CELL_SIZE_DEG = 0.002  # 单元格大小 (~200米)

def _build_spatial_index(self):
    # 计算网格维度
    grid_cols = int(lon_range / SPATIAL_INDEX_CELL_SIZE_DEG) + 1
    grid_rows = int(lat_range / SPATIAL_INDEX_CELL_SIZE_DEG) + 1
    
    # 为每条边分配到它穿越的所有单元格
    for edge_idx, edge in enumerate(edges):
        # 计算边的边界框
        # 找到覆盖的单元格
        # 将边添加到这些单元格
    
    # 构建扁平化的索引数组
    return grid_cols, grid_rows, cell_offsets, cell_edges
```

### 2. 地图加载阶段 (nav_api.c)

```c
/* Load spatial index if present (v6) - zero-copy */
if (version >= 6 && map->header.grid_cols > 0) {
    uint32_t total_cells = map->header.grid_cols * map->header.grid_rows;
    
    map->cell_offsets = (uint32_t *)ptr;
    ptr += (total_cells + 1) * sizeof(uint32_t);
    
    map->cell_edges = (uint32_t *)ptr;
    ptr += map->header.spatial_index_count * sizeof(uint32_t);
}
```

### 3. 渲染阶段 (render_api.c)

```c
if (use_spatial_index) {
    // 计算视口覆盖的网格单元
    int col_start = (view_min_lon - min_lon) / cell_lon;
    int col_end = (view_max_lon - min_lon) / cell_lon;
    int row_start = (view_min_lat - min_lat) / cell_lat;
    int row_end = (view_max_lat - min_lat) / cell_lat;
    
    // 只遍历这些单元格中的边
    for (row = row_start; row <= row_end; row++) {
        for (col = col_start; col <= col_end; col++) {
            int cell_idx = row * grid_cols + col;
            for (ei = cell_offsets[cell_idx]; ei < cell_offsets[cell_idx + 1]; ei++) {
                uint32_t edge_idx = cell_edges[ei];
                // 渲染这条边
            }
        }
    }
} else {
    // 回退到遍历所有边 (v1-v5 兼容)
}
```

## 性能指标

### 测试结果

```
>>> SPATIAL INDEX ACTIVE: checked 32284/164706 edges (19.60%), rendered 835, cells 63/9842 <<<
```

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 检查的边数 | 164,706 | 32,284 | **减少 80%** |
| 检查的单元格 | N/A | 63/9842 | 仅 0.64% |
| 复杂度 | O(n) | O(k) | k << n |

### 存储开销

```
Spatial index: 133x74 grid
  - cell_offsets: (9842 + 1) × 4 = 39,372 bytes
  - cell_edges: 184,550 × 4 = 738,200 bytes
  - 总计: ~760 KB (地图总大小 8 MB 的 ~9.5%)
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `SPATIAL_INDEX_CELL_SIZE_DEG` | 0.002 | 单元格大小（度），约 200 米 |

### 调优建议

- **较小的视口** (< 500m): 使用 0.001 度 (~100m) 可获得更好性能
- **较大的视口** (> 2km): 使用 0.005 度 (~500m) 以减少索引大小
- **内存受限**: 增大单元格大小以减少索引内存占用

## 兼容性

- **向后兼容**: v1-v5 地图文件可正常加载，自动回退到遍历所有边
- **版本检测**: 通过 `map->header.version >= 6` 和 `map->cell_offsets != NULL` 判断

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `map_types.h` | 添加空间索引字段到 header 和 map_t（v7 增加 area 索引字段）|
| `convert_map.py` | 添加 `_build_spatial_index()` 和 `_build_area_spatial_index()` 方法 |
| `nav_api.c` | 添加空间索引加载逻辑（v7 增加 area 索引加载）|
| `render_api.c` | 使用空间索引进行快速边/区域查询 |

## 使用方法

### 1. 重新生成地图文件

```bash
cd tools
python convert_map.py -i data/map.osm -o data/map.bin --features all
```

输出示例：
```
Spatial index: 133 x 74 = 9842 cells
Spatial index entries: 184550 (avg 18.8 per cell)
Area spatial index entries: 65000 (avg 6.6 per cell)
```

### 2. 验证空间索引生效

运行程序时会输出：
```
>>> SPATIAL INDEX ACTIVE: checked X/Y edges (Z%), rendered N, cells M/T <<<
>>> AREA SPATIAL INDEX ACTIVE: checked X/Y areas (Z%), rendered N, cells M/T <<<
```

如果看到 `NO SPATIAL INDEX` 或 `NO AREA SPATIAL INDEX`，检查地图版本是否为 v7。

## 兼容性

- **向后兼容**: v1-v6 地图文件可正常加载，自动回退到遍历所有边/区域
- **版本检测**: 
  - 边索引: 通过 `map->header.version >= 6` 和 `map->cell_offsets != NULL` 判断
  - 区域索引: 通过 `map->header.version >= 7` 和 `map->area_cell_offsets != NULL` 判断

## 未来优化方向

1. **四叉树索引**: 对于高度不均匀分布的数据，四叉树可能更高效
2. **多级索引**: 根据缩放级别使用不同粒度的索引
3. **标签空间索引**: 为文本标签添加类似的空间索引
3. **区域索引**: 为不同区域（水域、公园等）添加类似的空间索引
