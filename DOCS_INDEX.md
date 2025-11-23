# 文档索引

## 📚 主要文档

### 用户文档
- **[README.md](README.md)** - 项目介绍和使用指南
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - 快速参考手册

### 开发文档
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - 开发环境配置和工作流
- **[ARCHITECTURE_ANALYSIS.md](ARCHITECTURE_ANALYSIS.md)** - 项目架构分析
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - 实现指南

### 技术文档
- **[HONEYGUI_C_CODEGEN_ARCHITECTURE.md](HONEYGUI_C_CODEGEN_ARCHITECTURE.md)** - C代码生成架构
- **[HONEYGUI_COMPONENT_NAMING.md](HONEYGUI_COMPONENT_NAMING.md)** - 组件命名规范

### 维护文档
- **[RECENT_FIXES.md](RECENT_FIXES.md)** - 最近的BUG修复记录
- **[CLAUDE.md](CLAUDE.md)** - Claude AI协作记录

### 需求文档
- **[doc/需求文档.md](doc/需求文档.md)** - 项目需求说明

---

## 🔧 脚本工具

### 缓存清理
- `scripts/clear-cache.js` - Node.js缓存清理脚本
- `scripts/clear-cache.sh` - Bash缓存清理脚本
- `scripts/quick-fix.sh` - 快速修复脚本

### npm命令
```bash
npm run clean        # 清理缓存
npm run rebuild      # 清理并重新构建
npm run compile      # 编译TypeScript
npm run build:webview # 构建前端
npm run watch        # 监听后端
npm run watch:webview # 监听前端
```

---

## 📝 文档说明

### 核心文档（必读）
1. **README.md** - 从这里开始
2. **DEVELOPMENT.md** - 开发者必读
3. **RECENT_FIXES.md** - 了解最新变更

### 参考文档（按需查阅）
- 需要了解架构 → ARCHITECTURE_ANALYSIS.md
- 需要实现功能 → IMPLEMENTATION_GUIDE.md
- 需要快速查询 → QUICK_REFERENCE.md
- 需要了解命名 → HONEYGUI_COMPONENT_NAMING.md

### 历史文档
- CLAUDE.md - AI协作历史记录

---

## 🗂️ 文档维护

### 文档更新原则
1. 重要变更必须更新 RECENT_FIXES.md
2. 架构变更必须更新 ARCHITECTURE_ANALYSIS.md
3. 新功能必须更新 README.md 和 QUICK_REFERENCE.md
4. 删除过时的临时文档

### 文档清理记录
**2025-11-23**: 删除了以下冗余文档
- ~~WEBPACK_CACHE_FIX_SUMMARY.md~~ → 合并到 RECENT_FIXES.md
- ~~LOG_BUG_FIX_REPORT.md~~ → 合并到 RECENT_FIXES.md
- ~~CACHE_MANAGEMENT.md~~ → 合并到 RECENT_FIXES.md
- ~~ID_CHANGE_FINAL_FIX.md~~ → 已过时
- ~~ID_CHANGE_SUMMARY.md~~ → 已过时
- ~~ID_CHANGE_FIX.md~~ → 已过时
- ~~EXECUTIVE_SUMMARY.md~~ → 已过时
- ~~COMPONENT_NAMING_AUDIT.md~~ → 已过时
- ~~FIX_COMPLETED_REPORT.md~~ → 已过时
