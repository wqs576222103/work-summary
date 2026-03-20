# 快速开始指南

## 🚀 立即使用

1. **获取 Anthropic API Key**
   - 访问 https://console.anthropic.com/
   - 注册账号并创建 API Key
   - 复制你的 API Key

2. **配置 API Key**
   - 打开项目根目录下的 `.env` 文件
   - 将以下内容中的 `your_api_key_here` 替换为你的实际 API Key：
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
   ```

3. **启动服务**（已完成）
   - 服务器已在 http://localhost:3000 运行
   - 如果尚未启动，运行：`npm start`

4. **打开浏览器**
   - 访问：http://localhost:3000

5. **生成工作总结**
   - 输入包含多个项目的父目录路径
   - 点击"扫描项目"
   - 选择需要总结的项目
   - 设置日期范围
   - 点击"生成总结"

## 📝 使用示例

### 示例 1：总结最近一周的工作
```
根目录：D:\projects
开始日期：2026-03-13
结束日期：2026-03-20
分支：alpha
用户名：（留空，使用 Git 配置的用户名）
```

### 示例 2：总结特定时间段的所有项目
```
根目录：/home/user/work-projects
开始日期：2026-03-01
结束日期：2026-03-31
分支：main
用户名：zhangsan
```

## ⚙️ 配置说明

### .env 文件配置
```bash
# 必填：你的 Anthropic API Key
ANTHROPIC_API_KEY=your_actual_api_key
```

### Git 用户名配置（可选）
如果留空，工具会自动使用每个仓库的 Git 配置用户名。
你也可以在命令行中查看当前 Git 用户名：
```bash
git config user.name
```

## 🔧 常见问题

### Q: 我没有 Anthropic API Key 怎么办？
A: 你可以：
1. 注册 Anthropic 获取 API Key（推荐）
2. 或者修改 `server.js` 中的 `generateSummary` 函数，使用其他 AI 服务或自定义总结逻辑

### Q: 扫描不到项目？
A: 检查：
- 路径格式是否正确（Windows 使用 `\` 或 `/`，Linux/Mac 使用 `/`）
- 目标目录下是否确实存在包含 `.git` 文件夹的项目
- 是否有该目录的读取权限

### Q: 生成的总结不满意？
A: 可以调整：
- 修改 `server.js` 中 Claude 的提示词模板
- 更换不同的 Claude 模型
- 调整日期范围或筛选条件

## 🛠️ 开发调试

如果需要修改代码后重启：
```bash
# 停止当前运行的服务器（Ctrl+C）
npm start
```

## 📊 系统要求

- Node.js 14.x 或更高版本
- Git 已安装并配置
- 有效的网络连接到 Claude API

---

**现在就开始使用吧！** 🎉
