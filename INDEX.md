# 📚 文档导航

欢迎使用工作总结生成工具！本文档索引将帮助你快速找到所需信息。

---

## 🚀 新手入门（按顺序阅读）

### 1. [项目交付文档](PROJECT_INFO.md) ⭐⭐⭐
**必读** - 了解项目整体情况和功能清单

### 2. [快速开始指南](QUICKSTART.md) ⭐⭐⭐
**必读** - 5 分钟快速上手指南

### 3. [API 配置指南](API_CONFIG.md) ⭐⭐⭐
**必读** - 如何获取和配置 Anthropic API Key

### 4. [使用流程说明](USAGE.md) ⭐⭐
**推荐** - 详细的使用步骤和技巧

### 5. [README](README.md) ⭐
**参考** - 项目概述和技术说明

---

## 📖 按需求查找

### 我想快速开始
👉 阅读：[快速开始指南](QUICKSTART.md)

### 我没有 API Key
👉 阅读：[API 配置指南](API_CONFIG.md)

### 我想了解详细用法
👉 阅读：[使用流程说明](USAGE.md)

### 我想了解技术细节
👉 阅读：[README](README.md) 和 [server.js](server.js)

### 我想了解项目整体情况
👉 阅读：[项目交付文档](PROJECT_INFO.md)

---

## 🔧 常见问题

#### Q: 服务器怎么启动？
A: 已自动启动在 http://localhost:3000  
   如需手动启动，运行：`npm start`

#### Q: API Key 在哪里配置？
A: 在项目根目录的 `.env` 文件中配置

#### Q: 如何停止服务器？
A: 在运行服务器的终端按 `Ctrl+C`

#### Q: 支持中文吗？
A: 完全支持！界面和输出都是中文

#### Q: 可以离线使用吗？
A: 不可以，需要联网调用 Claude API

---

## 📁 文件结构说明

```
work-summary/
├── 📘 文档中心
│   ├── INDEX.md              # 本文档（导航索引）
│   ├── PROJECT_INFO.md       # 项目交付文档
│   ├── QUICKSTART.md         # 快速开始指南
│   ├── API_CONFIG.md         # API 配置指南
│   ├── USAGE.md             # 使用流程说明
│   └── README.md            # 项目说明
│
├── 💻 核心代码
│   ├── server.js            # 后端服务器
│   └── public/index.html    # 前端界面
│
├── ⚙️ 配置文件
│   ├── .env                 # 环境变量（需自行配置）
│   ├── .env.example         # 环境变量模板
│   ├── .gitignore           # Git 忽略配置
│   └── package.json         # 项目配置
│
└── 🚀 启动脚本
    ├── start.bat            # Windows 启动脚本
    └── start.sh             # Mac/Linux 启动脚本
```

---

## 🎯 快速参考卡

### 启动命令
```bash
npm start
```

### 访问地址
```
http://localhost:3000
```

### 配置文件
```
.env
```

### 依赖安装
```bash
npm install
```

---

## 🆘 获取帮助

### 遇到问题？
1. 查看 [USAGE.md](USAGE.md) 中的故障排查部分
2. 查看 [PROJECT_INFO.md](PROJECT_INFO.md) 中的已知问题
3. 检查 `.env` 文件是否配置正确

### 常见错误
- **403 Forbidden**: API Key 未配置或无效
- **扫描不到项目**: 路径错误或权限问题
- **Git 操作失败**: Git 未安装或配置错误

---

## 📊 学习路径建议

### 基础使用者（只想快速生成总结）
1. QUICKSTART.md → 5 分钟
2. API_CONFIG.md → 10 分钟
3. 开始使用 → ∞

### 进阶使用者（想深入了解和定制）
1. PROJECT_INFO.md → 10 分钟
2. USAGE.md → 15 分钟
3. README.md → 10 分钟
4. 阅读源代码 → ∞

---

## ✨ 推荐做法

### ✅ Do
- 定期生成工作总结（如每周五）
- 根据实际需要调整参数
- 对 AI 生成的结果进行适当修改
- 保存重要的总结文档

### ❌ Don't
- 不要分享你的 API Key
- 不要将 `.env` 提交到 Git
- 不要过度依赖 AI，保持人工审核
- 不要在无网络环境下尝试使用

---

## 🎓 最佳实践

### 周报生成
- 时间范围：周一到周五
- 分支：当前开发分支
- 用户名：留空（自动识别）

### 月度总结
- 时间范围：月初到月末
- 包含所有相关项目
- 可导出存档备查

### 项目复盘
- 时间范围：项目关键阶段
- 聚焦特定项目
- 结合其他项目数据

---

## 📞 其他资源

- **Anthropic 官方文档**: https://docs.anthropic.com/
- **Claude 定价**: https://www.anthropic.com/pricing
- **Node.js 下载**: https://nodejs.org/
- **Git 下载**: https://git-scm.com/

---

**祝你使用愉快！** 🎉

如有任何问题，请参考上述文档或检查项目配置文件。
