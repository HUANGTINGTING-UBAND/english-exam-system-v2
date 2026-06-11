<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  getTeacherAssignments,
  getTeacherClassrooms,
} from '../api/platformApi'

const currentUser = ref(getSavedUser())
const classrooms = ref([])
const assignments = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const isTeacher = computed(() => currentUser.value?.role === 'TEACHER')

const loadDashboard = async () => {
  if (!isTeacher.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const [classroomResult, assignmentResult] = await Promise.all([
      getTeacherClassrooms(),
      getTeacherAssignments(),
    ])

    classrooms.value = classroomResult
    assignments.value = assignmentResult
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '教师工作台加载失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Teacher Workspace</p>
      <h1>教师工作台</h1>
      <p>
        管理班级、发布考试任务，并查看学生提交情况。
      </p>
    </section>

    <section v-if="!isTeacher" class="profile-empty-card">
      <h2>当前账号不能访问教师端</h2>
      <p>请使用教师账号登录。</p>
    </section>

    <section v-else class="profile-section">
      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <div class="profile-card">
        <div>
          <p class="tag">Overview</p>
          <h2>{{ currentUser.nickname || currentUser.username }}</h2>
          <p>班级 {{ classrooms.length }} 个，已发布任务 {{ assignments.length }} 个。</p>
        </div>

        <div class="profile-actions">
          <RouterLink class="primary-btn" to="/teacher/classrooms">
            管理班级
          </RouterLink>

          <RouterLink class="secondary-btn" to="/teacher/assignments">
            管理任务
          </RouterLink>

          <RouterLink class="secondary-btn" to="/teacher/assignments">
            我的试卷
          </RouterLink>

          <RouterLink class="secondary-btn" to="/import-drafts">
            导入草稿
          </RouterLink>

          <RouterLink class="secondary-btn" to="/skills">
            Skill 配置
          </RouterLink>
        </div>
      </div>

      <div v-if="isLoading" class="loading-box">
        正在加载教师工作台……
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>最近任务</h2>
        </div>

        <div v-if="assignments.length > 0" class="attempt-list">
          <article
            v-for="assignment in assignments.slice(0, 5)"
            :key="assignment.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ assignment.title }}</h3>
              <p>{{ assignment.classroomName }}｜{{ assignment.examTitle }}</p>
              <p>提交 {{ assignment.submissionCount }} 人</p>
            </div>

            <RouterLink
              class="secondary-btn"
              :to="`/teacher/assignments?assignmentId=${assignment.id}`"
            >
              查看提交
            </RouterLink>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无任务，先创建班级并发布一份试卷。
        </p>
      </div>
    </section>
  </div>
</template>
