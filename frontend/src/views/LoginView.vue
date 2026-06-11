<script setup>
import { ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { loginUser, saveAuthData } from '../api/authApi'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''

  if (!username.value || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  isLoading.value = true

  try {
    const authData = await loginUser({
      username: username.value,
      password: password.value,
    })

    saveAuthData(authData)
    window.alert('登录成功')
    const redirectPath = route.query.redirect || '/profile'
    router.push(String(redirectPath))
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '登录失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <p class="tag">Login</p>
      <h1>登录</h1>
      <p class="auth-tip">
        登录后，你的考试记录和错题本将逐步关联到真实账号。
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
        密码
        <input
          v-model="password"
          type="password"
          placeholder="请输入密码"
        />
      </label>

      <button
        class="primary-btn"
        :disabled="isLoading"
        @click="handleLogin"
      >
        {{ isLoading ? '登录中……' : '登录' }}
      </button>

      <p class="auth-link">
        没有账号？
        <RouterLink to="/register">
          去注册
        </RouterLink>
      </p>
    </div>
  </div>
</template>