# Project Stage Summary

## 一、当前项目阶段

当前项目已经完成公开测试版核心链路。

项目已经具备：

- 前端页面
- 后端 API
- 数据库读写
- 用户注册登录
- token 登录状态
- 考试提交
- 历史记录
- 错题本
- 按用户隔离数据
- 前端部署
- 后端部署
- 线上联调

当前阶段可以定义为：

```text
公开测试版 MVP
```

---

## 二、线上地址

### 前端

```text
https://english-exam-system-delta.vercel.app/
```

### 后端

```text
https://english-exam-system.onrender.com
```

### 后端健康检查

```text
https://english-exam-system.onrender.com/api/health
```

### 后端试卷接口

```text
https://english-exam-system.onrender.com/api/exams
```

---

## 三、当前技术栈

### 前端

- Vue 3
- Vite
- Vue Router
- JavaScript
- CSS
- Fetch API
- localStorage

### 后端

- Node.js
- Express
- Prisma
- PostgreSQL
- bcryptjs
- jsonwebtoken
- cors
- dotenv

### 数据库

- Neon PostgreSQL

### 部署平台

- Vercel
- Render
- GitHub

---

## 四、当前已完成功能

### 1. 用户系统

- 用户注册
- 用户登录
- 密码加密存储
- JWT token 生成
- 前端保存 token
- 前端保存 currentUser
- 退出登录
- 个人中心显示当前用户
- 不同用户之间数据隔离

### 2. 试卷系统

- 从数据库读取试卷列表
- 按学段筛选试卷
- 读取单张试卷详情
- 读取指定试卷题目
- 后端不可用时前端可回退 mock 数据

### 3. 考试系统

- 考试说明页
- 题目预览
- 开始考试
- 上一题 / 下一题
- 题号导航
- 选择题作答
- 主观题输入
- 倒计时
- 暂停 / 继续考试
- 手动提交
- 自动提交
- 未答题提醒
- 重新考试

### 4. 评分系统

- 选择题自动评分
- 主观题自评分
- 客观题得分
- 主观题得分
- 总分统计
- 正确率统计
- 薄弱知识点分析
- 学习建议

### 5. 历史记录

- 提交考试后保存到数据库
- 保存 ExamAttempt
- 保存 UserAnswer
- 个人中心读取当前用户考试历史
- 记录得分、正确率、用时、提交方式、答案数量

### 6. 错题本

- 提交后可保存错题
- 错题保存到数据库
- 个人中心读取当前用户错题
- 显示来源试卷、知识点、题型、参考答案、解析
- 后端不可用时可回退本地错题

### 7. 管理员后台

- 已创建 Admin 页面
- 未登录用户访问后台会提示登录
- 普通用户访问后台会提示无权限
- ADMIN 用户可以看到后台入口
- 目前后台仍是静态基础版，后续需要接入真实试卷管理

### 8. 部署

- 前端已部署到 Vercel
- 后端已部署到 Render
- 数据库使用 Neon
- 前端通过 VITE_API_BASE_URL 连接线上后端
- 后端 CORS 支持 Vercel 和 Codespaces 开发环境
- 本地 Codespaces 可继续开发

---

## 五、当前重要文件

### 前端

```text
frontend/src/api/authApi.js
frontend/src/api/examApi.js
frontend/src/views/HomeView.vue
frontend/src/views/LoginView.vue
frontend/src/views/RegisterView.vue
frontend/src/views/ProfileView.vue
frontend/src/views/ExamListView.vue
frontend/src/views/ExamView.vue
frontend/src/views/AdminView.vue
frontend/src/router/index.js
frontend/src/style.css
frontend/vite.config.js
```

### 后端

```text
backend/index.js
backend/src/lib/prisma.js
backend/src/routes/authRoutes.js
backend/src/routes/examRoutes.js
backend/src/middlewares/authMiddleware.js
backend/prisma/schema.prisma
backend/scripts/seed.js
backend/scripts/test-db.js
backend/package.json
```

---

## 六、核心数据表

### User

用于保存用户信息。

主要字段：

- id
- username
- passwordHash
- nickname
- role
- gradeLevel
- createdAt
- updatedAt

### Exam

用于保存试卷信息。

主要字段：

- id
- title
- gradeLevel
- description
- timeLimit
- totalScore
- isPublished

### Question

用于保存题目信息。

主要字段：

- id
- examId
- type
- text
- options
- answer
- score
- knowledgePoint
- referenceAnswer
- explanation
- orderIndex

### ExamAttempt

用于保存一次考试记录。

主要字段：

- id
- userId
- examId
- objectiveScore
- subjectiveScore
- totalScore
- accuracyRate
- submitType
- usedTime
- pauseCount
- submittedAt

### UserAnswer

用于保存用户每一道题的答案。

主要字段：

- id
- attemptId
- questionId
- answerText
- selectedIndex
- score
- isCorrect

### WrongQuestion

用于保存错题。

主要字段：

- id
- userId
- examId
- questionId
- attemptId
- questionType
- knowledgePoint
- reason
- note
- createdAt

---

## 七、当前环境变量

### 后端 Render / backend/.env

```env
DATABASE_URL="Neon PostgreSQL 连接字符串"
JWT_SECRET="JWT 密钥"
FRONTEND_URL="https://english-exam-system-delta.vercel.app"
NODE_ENV="production 或 development"
```

### 前端 Vercel

```env
VITE_API_BASE_URL="https://english-exam-system.onrender.com/api"
```

---

## 八、本地开发方式

### 启动后端

```bash
cd backend
npm run dev
```

后端本地地址：

```text
http://localhost:3000
```

### 启动前端

```bash
cd frontend
npm run dev
```

前端本地地址：

```text
http://localhost:5173
```

Codespaces 中前端通常是：

```text
https://xxxx-5173.app.github.dev
```

Codespaces 中后端通常是：

```text
https://xxxx-3000.app.github.dev
```

---

## 九、本地开发注意事项

### 1. 根目录不能直接运行 npm

项目根目录没有 `package.json`。

正确方式：

```bash
cd frontend
npm run dev
```

或：

```bash
cd backend
npm run dev
```

### 2. 本地前端需要本地后端

Codespaces 本地前端默认请求：

```text
/api
```

然后通过 Vite proxy 转发到：

```text
http://localhost:3000
```

所以本地开发时必须同时开前端和后端。

### 3. 线上前端不需要本地后端

线上前端通过：

```text
VITE_API_BASE_URL
```

连接 Render 后端。

---

## 十、当前已知问题

### 1. 大陆访问速度问题

当前使用：

```text
Vercel + Render + Neon
```

中国大陆访问可能较慢。

后续如果项目确实可行，可以迁移到国内轻量服务器。

### 2. 管理员后台还未接入真实数据库管理

当前 Admin 页面只完成权限展示，后续需要继续开发：

- 新增试卷
- 修改试卷
- 发布 / 下架试卷
- 新增题目
- 修改题目
- 删除题目
- 用户数据统计

### 3. 题型还不完整

当前题型基础支持：

- 单选题
- 翻译题
- 改错题
- 写作题

后续需要完善：

- 阅读理解一篇文章多小题
- 完形填空
- 批量导入题目
- 更精细的评分逻辑

---

## 十一、下一阶段任务建议

### 第一组：管理员后台真实接入

- 后端管理员权限中间件
- 新增试卷接口
- 修改试卷接口
- 发布 / 下架试卷接口
- 新增题目接口
- 修改题目接口
- 删除题目接口
- 前端管理员页面表单
- 管理员页面读取数据库试卷
- 管理员页面管理题目

### 第二组：考试结果详情页

- 历史记录点击进入详情
- 查看每道题作答情况
- 查看正确答案
- 查看解析
- 查看用户答案
- 查看得分情况

### 第三组：错题专项训练

- 错题本按题型筛选
- 错题本按知识点筛选
- 重新练习错题
- 错题移除
- 错题掌握状态

### 第四组：国内部署准备

- 国内轻量服务器
- Nginx
- PM2
- PostgreSQL 迁移
- 前端 dist 部署
- 后端 Node 服务部署

---

## 十二、阶段结论

当前项目已经完成从 0 到 1 的全栈闭环：

```text
前端页面
↓
后端 API
↓
数据库
↓
用户系统
↓
考试流程
↓
结果保存
↓
错题沉淀
↓
线上部署
```

项目当前已经可以作为公开测试版使用，也可以作为后续继续开发管理员后台和题库系统的基础。