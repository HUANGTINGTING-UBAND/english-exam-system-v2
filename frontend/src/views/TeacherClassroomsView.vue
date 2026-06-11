<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  createTeacherClassroom,
  getTeacherClassroomStudents,
  getTeacherClassrooms,
} from '../api/platformApi'

const currentUser = ref(getSavedUser())
const classrooms = ref([])
const selectedClassroom = ref(null)
const students = ref([])
const name = ref('')
const description = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isTeacher = computed(() => currentUser.value?.role === 'TEACHER')

const loadClassrooms = async () => {
  if (!isTeacher.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    classrooms.value = await getTeacherClassrooms()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '班级加载失败'
  } finally {
    isLoading.value = false
  }
}

const handleCreateClassroom = async () => {
  if (!name.value.trim()) {
    errorMessage.value = '请输入班级名称'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const created = await createTeacherClassroom({
      name: name.value,
      description: description.value,
    })

    successMessage.value = `班级创建成功，邀请码：${created.inviteCode}`
    name.value = ''
    description.value = ''
    await loadClassrooms()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '班级创建失败'
  } finally {
    isSubmitting.value = false
  }
}

const selectClassroom = async (classroom) => {
  selectedClassroom.value = classroom
  students.value = []
  errorMessage.value = ''

  try {
    students.value = await getTeacherClassroomStudents(classroom.id)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '班级学生加载失败'
  }
}

onMounted(loadClassrooms)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Classrooms</p>
      <h1>班级管理</h1>
      <p>创建班级后，把邀请码发给学生，学生即可加入班级。</p>
    </section>

    <section v-if="!isTeacher" class="profile-empty-card">
      <h2>当前账号不能访问教师班级</h2>
      <p>请使用教师账号登录。</p>
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
          <p class="tag">Create</p>
          <h2>创建班级</h2>
          <p>第一轮先使用邀请码加入班级，后续可扩展批量导入学生。</p>
        </div>

        <div class="profile-actions">
          <RouterLink class="secondary-btn" to="/teacher">
            返回工作台
          </RouterLink>
        </div>
      </div>

      <div class="learning-overview-card">
        <label>
          班级名称
          <input v-model="name" type="text" placeholder="例如：六年级英语 A 班" />
        </label>

        <label>
          班级说明
          <textarea v-model="description" placeholder="可填写班级说明"></textarea>
        </label>

        <button
          class="primary-btn"
          :disabled="isSubmitting"
          @click="handleCreateClassroom"
        >
          {{ isSubmitting ? '创建中……' : '创建班级' }}
        </button>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>我的班级</h2>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载班级……
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
              <p>邀请码：<strong>{{ classroom.inviteCode }}</strong></p>
              <p>学生 {{ classroom.studentCount }} 人｜任务 {{ classroom.assignmentCount }} 个</p>
            </div>

            <button class="secondary-btn" @click="selectClassroom(classroom)">
              查看学生
            </button>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无班级。
        </p>
      </div>

      <div v-if="selectedClassroom" class="learning-overview-card">
        <div class="section-title-row">
          <h2>{{ selectedClassroom.name }} 学生</h2>
        </div>

        <div v-if="students.length > 0" class="attempt-list">
          <article
            v-for="student in students"
            :key="student.studentId"
            class="attempt-card"
          >
            <div>
              <h3>{{ student.nickname || student.username }}</h3>
              <p>用户名：{{ student.username }}</p>
              <p>加入时间：{{ new Date(student.joinedAt).toLocaleString() }}</p>
            </div>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无学生加入。
        </p>
      </div>
    </section>
  </div>
</template>
