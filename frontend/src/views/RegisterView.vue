<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { registerUser, saveAuthData } from '../api/authApi'

const router = useRouter()

const username = ref('')
const nickname = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleRegister = async () => {
  errorMessage.value = ''

  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = '密码长度不能少于 6 位'
    return
  }

  isLoading.value = true

  try {
    const authData = await registerUser({
      username: username.value,
      nickname: nickname.value || username.value,
      password: password.value,
    })

    saveAuthData(authData)
    window.alert('注册成功')
    router.push('/profile')
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '注册失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="tag">Register</p>
      <h1>注册</h1>
      <p class="auth-tip">
        创建账号后，后续考试记录、错题本和学习分析将归属于你的账号。
      </p>

      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <label>
        用户名
        <input
          v-model="username"
          type="text"
          placeholder="请输入用户名"
        />
      </label>

      <label>
        昵称
        <input
          v-model="nickname"
          type="text"
          placeholder="请输入昵称，可不填"
        />
      </label>

      <label>
        密码
        <input
          v-model="password"
          type="password"
          placeholder="请输入至少 6 位密码"
        />
      </label>

      <button
        class="primary-btn"
        :disabled="isLoading"
        @click="handleRegister"
      >
        {{ isLoading ? '注册中……' : '注册' }}
      </button>

      <p class="auth-link">
        已有账号？
        <RouterLink to="/login">
          去登录
        </RouterLink>
      </p>
    </div>
  </div>
</template>