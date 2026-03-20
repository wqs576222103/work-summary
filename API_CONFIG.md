# API 配置指南

## 获取 Anthropic API Key

### 步骤 1: 访问官网
打开 https://console.anthropic.com/

### 步骤 2: 注册/登录
- 如果没有账号，点击 "Sign Up" 注册
- 如果已有账号，点击 "Log In" 登录

### 步骤 3: 创建 API Key
1. 登录后进入控制台
2. 点击左侧菜单的 "API Keys"
3. 点击 "Create Key" 按钮
4. 给 API Key 起个名字（例如：Work Summary Tool）
5. 选择适当的权限和额度
6. 点击 "Create" 创建

### 步骤 4: 复制 API Key
- 创建成功后，系统会显示你的 API Key
- **重要**: API Key 只会显示一次，请立即复制并妥善保存
- API Key 格式类似：`sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx`

### 步骤 5: 配置到项目
1. 打开项目根目录下的 `.env` 文件
2. 找到这一行：`ANTHROPIC_API_KEY=your_api_key_here`
3. 将 `your_api_key_here` 替换为你的实际 API Key
4. 保存文件

示例：
```
ANTHROPIC_API_KEY=sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

## 测试 API Key

配置完成后，重启服务器：
```bash
# 按 Ctrl+C 停止当前服务
npm start
```

然后在浏览器中尝试生成一次工作总结。

## 注意事项

⚠️ **安全提醒**:
- 不要将 `.env` 文件提交到 Git 仓库
- 不要公开分享你的 API Key
- 定期检查 API 使用量和费用

💰 **费用说明**:
- Claude API 按使用量计费
- 查看定价：https://www.anthropic.com/pricing
- 建议设置使用限额以防超支

🔑 **API Key 管理**:
- 如怀疑 Key 已泄露，立即在控制台删除并重新创建
- 可以为不同项目创建多个 API Key
- 定期轮换 API Key 提高安全性

## 替代方案

如果你不想使用 Anthropic，可以修改 `server.js` 中的 `generateSummary` 函数，集成其他 AI 服务：
- OpenAI GPT
- Google Gemini
- 本地部署的 LLM
- 或其他大模型服务

## 需要帮助？

- Anthropic 官方文档：https://docs.anthropic.com/
- API 状态：https://status.anthropic.com/
- 支持邮箱：support@anthropic.com
