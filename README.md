# 工作总结生成工具

基于 Git 提交记录和 AI 自动生成工作总结的工具。

## 功能特点

- 📁 自动扫描指定目录下的所有 Git 项目
- 📅 支持自定义日期范围
- 🔀 支持指定 Git 分支
- 👤 按 Git 用户名筛选提交记录
- 🤖 使用 Claude AI 生成结构化总结
- 🌐 友好的 Web 界面
- 📋 支持复制和下载结果

## 技术栈

- **后端**: Node.js + Express
- **Git 操作**: simple-git
- **AI 集成**: Anthropic Claude API
- **前端**: 原生 HTML/CSS/JavaScript

## 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
   - 复制 `.env.example` 为 `.env`
   - 在 `.env` 文件中填入你的 Anthropic API Key：
```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

3. 启动服务器：
```bash
npm start
```

4. 打开浏览器访问：
```
http://localhost:3000
```

## 使用方法

1. **输入根目录路径**：填写包含多个项目的父目录路径
   - Windows 示例：`D:\projects`
   - Linux/Mac 示例：`/home/user/projects`

2. **点击"扫描项目"**：系统会自动查找该目录下所有包含 `.git` 的项目

3. **选择项目**：勾选需要生成总结的项目（支持全选/全不选）

4. **设置参数**：
   - 选择日期范围（开始日期和结束日期）
   - 指定分支名称（可选，如：alpha、main、master）
   - 输入 Git 用户名（可选，留空则使用仓库配置的用户名）

5. **点击"生成总结"**：等待 AI 分析提交记录并生成总结

6. **查看和使用结果**：
   - 查看生成的工作总结
   - 点击"复制结果"复制到剪贴板
   - 点击"下载结果"保存为文本文件

## 输出格式

生成的工作总结格式如下：

```
日期：YYYY-MM-DD~YYYY-MM-DD
1. 重点工作完成情况
    1.1 项目 1
        变更描述
    1.2 项目 2
        变更描述
        ......
```

## 注意事项

1. **API Key**: 需要有效的 Anthropic Claude API Key
2. **网络要求**: 需要能够访问 Claude API
3. **Git 要求**: 系统需要安装 Git 命令行工具
4. **权限要求**: 需要对扫描的目录有读取权限
5. **分支切换**: 工具会临时切换到指定分支获取提交记录，完成后会自动切回

## 项目结构

```
work-summary/
├── server.js           # 主服务器文件
├── public/
│   └── index.html      # Web 界面
├── .env.example        # 环境变量模板
├── .env                # 环境变量配置（需自行创建）
├── package.json        # 项目配置
└── README.md           # 说明文档
```

## API 端点

- `POST /api/scan`: 扫描目录获取 Git 项目列表
- `POST /api/username`: 获取指定仓库的 Git 用户名
- `POST /api/generate`: 生成工作总结

## 故障排除

### 扫描不到项目
- 检查路径是否正确
- 确保目标目录包含 `.git` 文件夹
- 检查是否有目录读取权限

### 生成总结失败
- 检查 API Key 是否正确配置
- 确认网络连接正常
- 检查所选项目在指定日期范围内是否有提交记录

### Git 操作错误
- 确保系统已安装 Git
- 检查 Git 配置中的用户名
- 确认指定的分支存在

## License

ISC
