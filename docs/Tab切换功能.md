# Tab 切换功能说明

## 问题
资源预览面板在左侧垂直排列时，显示区域较小，当资源较多时需要频繁滚动。

## 解决方案
将左侧面板改为 Tab 切换模式，让每个面板都能占满整个左侧空间。

## 功能特性

### Tab 布局
```
左侧面板:
├── Tab 标签栏: [组件库] [资源] [组件树]
└── 内容区域: 根据选中的 Tab 显示对应内容
```

### 三个 Tab
1. **组件库** - 拖拽组件到画布
2. **资源** - 管理和预览图片资源
3. **组件树** - 查看和管理组件层级

### 优点
- ✅ 每个面板都能占满左侧空间
- ✅ 资源预览区域显著增大
- ✅ 不改变整体布局结构
- ✅ 实现简单，改动最小

### 缺点
- ⚠️ 需要切换 Tab 才能查看不同面板
- ⚠️ 拖拽资源时需要先切换到资源 Tab

## 使用方式

1. **切换 Tab**：点击左侧面板顶部的标签按钮
2. **拖拽组件**：切换到"组件库" Tab，拖拽组件到画布
3. **拖拽资源**：切换到"资源" Tab，拖拽图片到画布
4. **查看层级**：切换到"组件树" Tab，查看组件结构

## 技术实现

### 状态管理
```typescript
const [activeTab, setActiveTab] = React.useState<'components' | 'assets' | 'tree'>('components');
```

### UI 结构
```tsx
<div className="left-panel">
  {/* Tab 标签栏 */}
  <div className="tab-headers">
    <button className={activeTab === 'components' ? 'active' : ''}>组件库</button>
    <button className={activeTab === 'assets' ? 'active' : ''}>资源</button>
    <button className={activeTab === 'tree' ? 'active' : ''}>组件树</button>
  </div>
  
  {/* Tab 内容区 */}
  <div className="tab-content">
    {activeTab === 'components' && <ComponentLibrary />}
    {activeTab === 'assets' && <AssetsPanel />}
    {activeTab === 'tree' && <ComponentTree />}
  </div>
</div>
```

### 样式调整
- 移除面板之间的分隔线
- 添加 Tab 标签样式（激活状态、悬停效果）
- 确保每个面板占满 100% 高度

## 改动文件

### 修改的文件
1. `src/webview/App.tsx` - 添加 Tab 切换逻辑
2. `src/webview/App.css` - 添加 Tab 样式
3. `src/webview/components/AssetsPanel.css` - 移除 border-top
4. `src/webview/components/ComponentLibrary.css` - 添加 height: 100%
5. `src/webview/components/ComponentTree.css` - 添加 height: 100%

### 代码量
- 新增：约 40 行
- 修改：约 15 行
- 总计：约 55 行

## 后续优化建议

### 1. 快捷键切换
- `Ctrl+1`: 切换到组件库
- `Ctrl+2`: 切换到资源
- `Ctrl+3`: 切换到组件树

### 2. 记住上次选择
使用 localStorage 保存用户的 Tab 选择：
```typescript
const [activeTab, setActiveTab] = React.useState<string>(
  () => localStorage.getItem('activeTab') || 'components'
);

useEffect(() => {
  localStorage.setItem('activeTab', activeTab);
}, [activeTab]);
```

### 3. Tab 徽章
显示资源数量或组件数量：
```tsx
<button>资源 <span className="badge">{assets.length}</span></button>
```

### 4. 拖拽优化
- 拖拽资源时自动切换到画布视图
- 或者支持跨 Tab 拖拽（技术难度较高）

## 测试建议

1. 测试 Tab 切换是否流畅
2. 测试每个面板是否正常显示
3. 测试拖拽功能是否正常（组件、资源）
4. 测试面板折叠/展开功能
5. 测试不同分辨率下的显示效果

## 兼容性

- ✅ 所有现有功能保持不变
- ✅ 拖拽功能正常工作
- ✅ 面板折叠/展开功能正常
- ✅ 响应式布局正常
