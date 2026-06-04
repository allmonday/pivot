# Pivot

基于 Claude Agent SDK 的 AI 开发工作台，集成文件夹管理、任务跟踪和 AI 对话。

## 核心功能

- 文件夹与任务的层级管理
- 基于 SSE 的流式 AI 对话
- Plan 模式：生成并查看架构方案

## 技术栈

| 层 | 技术 |
|---|------|
| Backend | FastAPI, SQLAlchemy (async), SQLite, Claude Agent SDK |
| Frontend | React 19, TypeScript, Vite |

## 快速开始

环境要求：Python >= 3.12, Node.js

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Frontend 默认 `http://localhost:5173`，Backend API 默认 `http://localhost:8000`。

## 项目结构

```
backend/
  app/
    main.py          # FastAPI 应用入口
    database.py      # 数据库连接
    models.py        # ORM 模型
    routers/         # API 路由（chat, files, folders, tasks）
    schemas/         # 请求/响应模型
    services/        # 业务逻辑（claude_service, stream_cache）
  main.py
frontend/
  src/
    App.tsx          # 主应用
    api.ts           # API 调用
    types.ts         # 类型定义
    components/      # UI 组件
```

## API 概览

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 文件夹 | `/api/folders` | 增删查 |
| 任务 | `/api/tasks` | 增删改查 |
| 文件 | `/api/files` | 目录浏览、文件读取 |
| 对话 | `/api/chat` | 会话管理、SSE 流式响应 |
