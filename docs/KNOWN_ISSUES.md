# 已知问题

## 左侧面板折叠功能异常

**提交**: 61d3958

**问题描述**:
1. 组件库和控件树折叠时，不能正确释放空间，框反而变大
2. 资源预览展开时，只能看到顶部的红色边框，内容被压缩到看不见
3. flex布局计算异常

**已尝试的方案**:
- ✗ 使用 `flex: 1` 和 `flex: none`
- ✗ 使用 `flex: 1 1 0` 和 `flex: 0 0 auto`
- ✗ 使用 `:not(.collapsed)` 选择器
- ✗ 在style属性中直接设置flex（优先级最高）

**调试信息**:
- React组件正常渲染，isExpanded状态正确
- Console日志显示状态切换正常
- 添加了彩色边框便于视觉调试（蓝/绿/红）

**可能的原因**:
1. CSS继承或优先级问题
2. 子元素（.library-content等）的flex: 1影响父容器
3. .left-panel的height: 100%与子元素flex冲突
4. Webview iframe环境的特殊性

**下一步调试**:
1. 在iframe context中检查实际DOM和computed styles
2. 使用 `document.querySelector('iframe').contentWindow.document` 访问
3. 检查实际渲染的flex值是否与预期一致
4. 考虑使用grid布局替代flex布局

**临时解决方案**:
- 可以先固定面板顺序，将最容易出问题的面板放在中间
- 或者暂时禁用折叠功能，等找到根本原因后再启用
