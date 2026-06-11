# English Exam System

英语在线模拟考试与错题学习系统，一个基于 Vue 3 + Node.js + Express + Prisma + PostgreSQL 的全栈项目。

本项目支持学生在线考试、自动评分、结果分析、薄弱知识点定位、错题本沉淀、错题重练，以及管理员试卷管理、题目管理、批量导入和学生考试记录查看。

---

## 1. 项目定位

这是一个面向英语学习场景的在线考试系统。

系统目标不是只完成一次考试，而是形成完整学习闭环：

```text
选择试卷
↓
在线答题
↓
提交评分
↓
查看结果分析
↓
定位薄弱知识点
↓
进入错题本
↓
错题重练
↓
标记已掌握
```

---

## 2. 当前完成度

当前项目已经达到可展示、可试用的产品雏形阶段。

已完成核心能力：

```text
学生注册 / 登录
在线考试
限时答题
自动评分
主观题自评分
考试记录保存
结果详情分析
薄弱知识点统计
题型得分统计
错题本
错题筛选
错题重练
管理员后台
试卷管理
题目管理
批量导入题目
学生考试记录查看
CSV 导出
权限控制
登录过期处理
```

---

## 3. 在线地址

前端地址：

```text
https://english-exam-system-delta.vercel.app/
```

后端地址：

```text
https://english-exam-system.onrender.com
```

后端健康检查：

```text
https://english-exam-system.onrender.com/api/health
```

---

## 4. 技术栈

### 前端

```text
Vue 3
Vite
Vue Router
JavaScript
CSS
Fetch API
localStorage
```

### 后端

```text
Node.js
Express
Prisma
PostgreSQL
bcryptjs
jsonwebtoken
cors
dotenv
```

### 数据库与部署

```text
Neon PostgreSQL
Vercel
Render
GitHub
```

---

## 5. 核心功能

### 5.1 学生端

```text
注册账号
登录系统
按学段查看试卷
进入考试
限时答题
暂停 / 继续考试
提交考试
查看得分
查看正确率
查看题型得分情况
查看薄弱知识点
查看复习建议
查看逐题解析
查看考试历史
删除考试记录
查看错题本
按关键词筛选错题
按题型筛选错题
按知识点筛选错题
错题重练
标记错题已掌握
```

### 5.2 管理员端

```text
创建试卷
编辑试卷
删除试卷
发布 / 下架试卷
批量导入题目
查看题目
编辑题目
删除题目
按关键词搜索试卷
按学段筛选试卷
按题数 / 满分 / 发布状态排序试卷
按题型筛选题目
按关键词搜索题目
按题号 / 分值 / 题型排序题目
导出题目 CSV
查看学生考试记录
筛选学生考试记录
导出学生考试记录 CSV
```

### 5.3 权限与安全体验

```text
JWT 登录认证
密码加密存储
学生与管理员角色区分
管理员路由保护
未登录访问受保护页面自动跳转登录
登录过期自动清理本地状态
API 401 / 403 错误统一处理
```

---

## 6. 项目结构

```text
english-exam-system
├── frontend
│   ├── src
│   │   ├── api
│   │   │   ├── authApi.js
│   │   │   └── examApi.js
│   │   ├── router
│   │   │   └── index.js
│   │   ├── views
│   │   │   ├── AdminAttemptsView.vue
│   │   │   ├── AdminView.vue
│   │   │   ├── AttemptDetailView.vue
│   │   │   ├── ExamListView.vue
│   │   │   ├── ExamView.vue
│   │   │   ├── HomeView.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── ProfileView.vue
│   │   │   ├── RegisterView.vue
│   │   │   └── WrongPracticeView.vue
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css
│   ├── package.json
│   └── vite.config.js
│
├── backend
│   ├── prisma
│   │   └── schema.prisma
│   ├── scripts
│   ├── src
│   │   ├── lib
│   │   │   └── prisma.js
│   │   ├── middlewares
│   │   │   └── authMiddleware.js
│   │   └── routes
│   │       ├── adminRoutes.js
│   │       ├── authRoutes.js
│   │       ├── examRoutes.js
│   │       ├── importRoutes.js
│   │       └── wrongPracticeRoutes.js
│   ├── index.js
│   └── package.json
│
├── README.md
└── ONLINE_TEST_CHECKLIST.md
```

---

## 7. 本地运行

### 7.1 启动后端

进入后端目录：

```bash
cd backend
```

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run dev
```

后端默认运行：

```text
http://localhost:3000
```

健康检查：

```text
http://localhost:3000/api/health
```

### 7.2 启动前端

新开一个终端，进入前端目录：

```bash
cd frontend
```

安装依赖：

```bash
npm install
```

启动前端：

```bash
npm run dev
```

前端默认运行：

```text
http://localhost:5173
```

---

## 8. 环境变量

### 8.1 后端 `.env`

在 `backend/.env` 中配置：

```env
DATABASE_URL="你的 PostgreSQL 数据库连接地址"
JWT_SECRET="你的 JWT 密钥"
FRONTEND_URL="你的前端地址"
NODE_ENV="development"
```

注意：

```text
.env 文件不能提交到 GitHub。
```

### 8.2 前端环境变量

线上部署时，在 Vercel 中配置：

```env
VITE_API_BASE_URL="https://english-exam-system.onrender.com/api"
```

本地开发如果未配置，前端默认使用：

```text
/api
```

---

## 9. 常用命令

### 9.1 前端命令

```bash
cd frontend
npm run dev
npm run build
```

### 9.2 后端命令

```bash
cd backend
npm run dev
npm start
npm run seed
npm run test:db
```

### 9.3 Git 命令

```bash
git status
git add .
git commit -m "message"
git push
```

---

## 10. 核心接口

### 10.1 用户认证

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### 10.2 试卷与题目

```text
GET /api/exams
GET /api/exams?grade=JUNIOR
GET /api/exams/:examId
GET /api/exams/:examId/questions
```

### 10.3 考试记录

```text
POST   /api/attempts/submit
GET    /api/attempts/history
GET    /api/attempts/:attemptId/detail
DELETE /api/attempts/:attemptId
```

### 10.4 错题本

```text
GET    /api/wrong-questions
POST   /api/wrong-questions
GET    /api/wrong-questions/:wrongQuestionId/practice
DELETE /api/wrong-questions/:wrongQuestionId
```

### 10.5 管理员

```text
GET    /api/admin/exams
POST   /api/admin/exams
PUT    /api/admin/exams/:examId
DELETE /api/admin/exams/:examId
PATCH  /api/admin/exams/:examId/publish

GET    /api/admin/exams/:examId/questions
POST   /api/admin/exams/:examId/questions
PUT    /api/admin/questions/:questionId
DELETE /api/admin/questions/:questionId

GET    /api/admin/attempts
POST   /api/admin/import/parse-file
POST   /api/admin/exams/:examId/import-questions
```

---

## 11. 测试账号建议

可以准备两类账号用于演示。

学生账号：

```text
用于注册、登录、考试、查看结果、错题重练。
```

管理员账号：

```text
用于登录管理员后台、创建试卷、导入题目、查看学生考试记录。
```

如果部署线上演示，建议在 README 或单独文档中写明测试账号。

---

## 12. 最终测试清单

### 12.1 学生端测试

```text
打开首页
注册新学生
登录学生账号
查看试卷列表
按学段筛选试卷
进入试卷
开始考试
完成答题
提交考试
查看结果详情
查看薄弱知识点
查看题型得分情况
进入个人中心
查看考试历史
查看错题本
筛选错题
进入错题重练
提交错题练习
标记已掌握
退出登录
```

### 12.2 管理员端测试

```text
登录管理员账号
进入管理员后台
创建试卷
编辑试卷
发布 / 下架试卷
批量导入题目
查看题目列表
搜索题目
筛选题目
排序题目
编辑题目分值
删除题目
查看试卷满分是否自动更新
查看学生考试记录
筛选考试记录
导出考试记录 CSV
导出题目 CSV
删除试卷
```

### 12.3 权限测试

```text
未登录访问个人中心，应跳转登录
未登录访问管理员后台，应跳转登录
学生访问管理员后台，应被拦截
管理员访问后台，应正常进入
登录过期后访问接口，应清理状态并跳转登录
登录后访问登录页，应自动跳转个人中心
```

### 12.4 构建测试

前端构建：

```bash
cd frontend
npm run build
```

后端启动：

```bash
cd backend
npm run dev
```

---

## 13. 已完成能力总结

当前项目已经具备完整产品雏形。

已完成能力包括：

```text
前端页面
前端路由
用户认证
权限控制
后端 API
数据库读写
考试业务流程
错题学习闭环
管理员内容管理
数据导出
线上部署
```

完整链路：

```text
Vercel 前端
↓
Render 后端
↓
Neon PostgreSQL 数据库
```

项目当前已经达到可演示、可试用、可作为作品集展示的阶段。

后续可继续优化：

```text
管理员复制试卷
管理员批量删除题目
学生成绩趋势图
单个学生学习画像
更完整的移动端适配
更细致的主观题评分
AI 自动解析试卷增强
AI 生成学习建议
README 增加截图
部署脚本整理
```