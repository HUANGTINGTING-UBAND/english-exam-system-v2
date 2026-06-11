<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  getStudentAssignments,
  getStudentClassrooms,
  joinClassroomByInviteCode,
} from '../api/platformApi'

const currentUser = ref(getSavedUser())
const inviteCode = ref('')
const classrooms = ref([])
const assignments = ref([])
const isLoading = ref(false)
const isJoining = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isStudent = computed(() => currentUser.value?.role === 'STUDENT')

const loadData = async () => {
  if (!isStudent.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const [classroomResult, assignmentResult] = await Promise.all([
      getStudentClassrooms(),
      getStudentAssignments(),
    ])

    classrooms.value = classroomResult
    assignments.value = assignmentResult
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '我的班级任务加载失败'
  } finally {
    isLoading.value = false
  }
}

const handleJoinClassroom = async () => {
  if (!inviteCode.value.trim()) {
    errorMessage.value = '请输入班级邀请码'
    return
  }

  isJoining.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await joinClassroomByInviteCode(inviteCode.value)
    successMessage.value = `已加入班级：${result.classroom.name}`
    inviteCode.value = ''
    await loadData()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '加入班级失败'
  } finally {
    isJoining.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Class Assignments</p>
      <h1>我的班级任务</h1>
      <p>通过老师提供的邀请码加入班级，并完成老师发布的考试。</p>
    </section>

    <section v-if="!isStudent" class="profile-empty-card">
      <h2>当前账号不能访问学生任务</h2>
      <p>请使用学生账号登录。</p>
    </section>

    <section v-else class="profile-section">
      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="api-success">
        {{ successMessage }}
      </div>

      <div class="profile-card">
        <div>
          <p class="tag">Join</p>
          <h2>加入班级</h2>
          <p>输入老师提供的邀请码，加入后即可看到班级任务。</p>
        </div>

        <div class="profile-actions">
          <RouterLink class="secondary-btn" to="/profile">
            返回个人中心
          </RouterLink>
        </div>
      </div>

      <div class="learning-overview-card">
        <label>
          班级邀请码
          <input
            v-model="inviteCode"
            type="text"
            placeholder="例如 CLASS-ABC123"
          />
        </label>

        <button
          class="primary-btn"
          :disabled="isJoining"
          @click="handleJoinClassroom"
        >
          {{ isJoining ? '加入中……' : '加入班级' }}
        </button>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>我的班级</h2>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载班级任务……
        </div>

        <div v-else-if="classrooms.length > 0" class="attempt-list">
          <article
            v-for="classroom in classrooms"
            :key="classroom.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ classroom.name }}</h3>
              <p>{{ classroom.description || '暂无说明' }}</p>
              <p>老师：{{ classroom.teacherName || '暂无' }}</p>
            </div>
          </article>
        </div>

        <p v-else class="empty-text">
          暂未加入班级。
        </p>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>待完成任务</h2>
        </div>

        <div v-if="assignments.length > 0" class="attempt-list">
          <article
            v-for="assignment in assignments"
            :key="assignment.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ assignment.title }}</h3>
              <p>{{ assignment.classroomName }}｜{{ assignment.examTitle }}</p>
              <p>
                {{ assignment.latestAttempt ? '已提交' : '未提交' }}
                <template v-if="assignment.latestAttempt">
                  ｜得分 {{ assignment.latestAttempt.totalScore }}
                </template>
              </p>
            </div>

            <div class="profile-actions">
              <RouterLink
                class="primary-btn"
                :to="`/assignments/${assignment.id}/exam/${assignment.examId}`"
              >
                {{ assignment.latestAttempt ? '再次练习' : '开始考试' }}
              </RouterLink>

              <RouterLink
                v-if="assignment.latestAttempt"
                class="secondary-btn"
                :to="`/attempts/${assignment.latestAttempt.id}`"
              >
                查看结果
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无班级任务。
        </p>
      </div>
    </section>
  </div>
</template>
