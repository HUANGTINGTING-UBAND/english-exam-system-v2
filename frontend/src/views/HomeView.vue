<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser, logoutUser } from '../api/authApi'
import { examCategoryGroups, examCategoryOptions } from '../utils/examCategories'

const currentUser = ref(null)

const loadCurrentUser = () => {
  currentUser.value = getSavedUser()
}

const handleLogout = () => {
  const confirmed = window.confirm('确认退出登录吗？')

  if (!confirmed) {
    return
  }

  logoutUser()
  currentUser.value = null
  window.alert('已退出登录')
}

onMounted(() => {
  loadCurrentUser()
})
</script>

<template>
  <div class="home-page">
    <header class="hero">
      <div class="hero-content">
        <div class="home-auth-bar">
          <div v-if="currentUser" class="home-user-info">
            <span>
              当前登录：{{ currentUser.nickname || currentUser.username }}
            </span>

            <RouterLink class="home-auth-link" to="/profile">
              个人中心
            </RouterLink>

            <RouterLink
              v-if="currentUser.role === 'ADMIN'"
              class="home-auth-link"
              to="/admin"
            >
              管理员后台
            </RouterLink>

            <button class="home-auth-button" @click="handleLogout">
              退出登录
            </button>
          </div>

          <div v-else class="home-user-info">
            <RouterLink class="home-auth-link" to="/login">
              登录
            </RouterLink>

            <RouterLink class="home-auth-link primary-auth-link" to="/register">
              注册
            </RouterLink>
          </div>
        </div>

        <p class="tag">English Exam System</p>

        <h1>英语在线模拟考试与错题学习系统</h1>

        <p class="desc">
          支持 K12 校内英语、大学英语、出国英语考试和其他英语考试分类练习，结合在线考试、结果分析、错题重练和管理员试卷管理，帮助学生形成完整学习闭环。
        </p>

        <div class="actions">
          <RouterLink class="primary-btn" to="/exams">
            查看全部试卷
          </RouterLink>

          <RouterLink class="secondary-btn" to="/profile">
            查看学习记录
          </RouterLink>

          <RouterLink
            v-if="currentUser?.role === 'ADMIN'"
            class="secondary-btn"
            to="/admin"
          >
            管理试卷
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="section">
      <section class="home-feature-section">
        <div class="section-title-row">
          <div>
            <p class="tag">Learning Flow</p>
            <h2>从考试到复盘的完整学习闭环</h2>
          </div>
        </div>

        <div class="home-flow-grid">
          <div class="home-flow-card">
            <span>01</span>
            <h3>选择方向</h3>
            <p>按 K12、大学英语、出国考试、其他考试等方向选择试卷。</p>
          </div>

          <div class="home-flow-card">
            <span>02</span>
            <h3>在线答题</h3>
            <p>支持选择题、翻译题、改错题、写作题、阅读理解和完形填空等题型。</p>
          </div>

          <div class="home-flow-card">
            <span>03</span>
            <h3>查看分析</h3>
            <p>提交后查看得分率、正确率、题型表现、薄弱知识点和复习建议。</p>
          </div>

          <div class="home-flow-card">
            <span>04</span>
            <h3>错题重练</h3>
            <p>系统沉淀错题，支持筛选、搜索、重练和标记已掌握。</p>
          </div>
        </div>
      </section>

      <section class="home-feature-section">
        <div class="section-title-row">
          <div>
            <p class="tag">Exam Categories</p>
            <h2>选择考试方向开始练习</h2>
          </div>
        </div>

        <div class="grade-grid">
          <div
            v-for="group in examCategoryGroups"
            :key="group.key"
            class="grade-card"
          >
            <RouterLink
              class="grade-title-link"
              :to="`/exams?group=${group.key}`"
            >
              {{ group.name }}
            </RouterLink>

            <p>{{ group.description }}</p>

            <div class="home-category-sub-links">
              <template
                v-for="categoryGroup in examCategoryOptions"
                :key="categoryGroup.group"
              >
                <RouterLink
                  v-for="option in categoryGroup.options.filter((item) => group.grades.includes(item.value))"
                  :key="option.value"
                  :to="`/exams?grade=${option.value}`"
                >
                  {{ option.label }}
                </RouterLink>
              </template>
            </div>
          </div>
        </div>
      </section>

      <section class="home-feature-section">
        <div class="section-title-row">
          <div>
            <p class="tag">Product Modules</p>
            <h2>系统核心模块</h2>
          </div>
        </div>

        <div class="home-module-grid">
          <div class="home-module-card">
            <h3>学生端</h3>
            <p>
              注册登录、试卷练习、考试提交、结果详情、错题本、错题重练和学习建议。
            </p>
          </div>

          <div class="home-module-card">
            <h3>管理员端</h3>
            <p>
              创建试卷、编辑题目、批量导入、筛选排序、查看学生考试记录和导出数据。
            </p>
          </div>

          <div class="home-module-card">
            <h3>学习分析</h3>
            <p>
              统计得分率、正确率、题型表现、薄弱知识点和错题分布，辅助学生复盘。
            </p>
          </div>

          <div class="home-module-card">
            <h3>分类管理</h3>
            <p>
              支持 K12、大学英语、出国英语考试、其他考试和综合练习等分类管理。
            </p>
          </div>
        </div>
      </section>

      <section class="home-cta-card">
        <div>
          <p class="tag">Start Now</p>
          <h2>开始一次完整的英语练习</h2>
          <p>
            完成一套试卷后，你可以在个人中心查看考试历史、错题本和学习建议。
          </p>
        </div>

        <div class="actions">
          <RouterLink class="primary-btn" to="/exams">
            去试卷列表
          </RouterLink>

          <RouterLink class="secondary-btn" to="/profile">
            去个人中心
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>
