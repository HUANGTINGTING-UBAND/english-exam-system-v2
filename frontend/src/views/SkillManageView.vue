<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  activateSkill,
  createSkill,
  deactivateSkill,
  getSkills,
} from '../api/platformApi'

const currentUser = ref(getSavedUser())
const skills = ref([])
const isLoading = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  name: '',
  code: '',
  description: '',
  configText: '{\n  "mode": "placeholder"\n}',
})

const canManageSkills = computed(() => {
  return ['TEACHER', 'ADMIN'].includes(currentUser.value?.role)
})

const loadSkills = async () => {
  if (!canManageSkills.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    skills.value = await getSkills()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || 'Skill 列表加载失败'
  } finally {
    isLoading.value = false
  }
}

const parseConfig = () => {
  if (!form.value.configText.trim()) {
    return {}
  }

  return JSON.parse(form.value.configText)
}

const handleCreateSkill = async () => {
  if (!form.value.name.trim()) {
    errorMessage.value = '请输入 Skill 名称'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await createSkill({
      name: form.value.name,
      code: form.value.code,
      description: form.value.description,
      config: parseConfig(),
    })

    successMessage.value = 'Skill 创建成功'
    form.value.name = ''
    form.value.code = ''
    form.value.description = ''
    form.value.configText = '{\n  "mode": "placeholder"\n}'
    await loadSkills()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || 'Skill 创建失败，请检查配置 JSON'
  } finally {
    isSubmitting.value = false
  }
}

const toggleSkill = async (skill) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (skill.isActive) {
      await deactivateSkill(skill.id)
      successMessage.value = 'Skill 已停用'
    } else {
      await activateSkill(skill.id)
      successMessage.value = 'Skill 已启用'
    }

    await loadSkills()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || 'Skill 状态更新失败'
  }
}

onMounted(loadSkills)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Generation Skill</p>
      <h1>Skill 管理</h1>
      <p>第一轮只做 Skill 配置基础表和启停管理，后续再接完整 AI 执行链路。</p>
    </section>

    <section v-if="!canManageSkills" class="profile-empty-card">
      <h2>当前账号不能访问 Skill 管理</h2>
      <p>请使用教师或管理员账号登录。</p>
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
          <h2>创建 Skill</h2>
          <p>可先记录 Skill 名称、编码和 JSON 配置。</p>
        </div>

        <div class="profile-actions">
          <RouterLink
            v-if="currentUser.role === 'TEACHER'"
            class="secondary-btn"
            to="/teacher"
          >
            返回教师工作台
          </RouterLink>

          <RouterLink
            v-if="currentUser.role === 'ADMIN'"
            class="secondary-btn"
            to="/admin"
          >
            返回管理后台
          </RouterLink>
        </div>
      </div>

      <div class="learning-overview-card">
        <label>
          Skill 名称
          <input v-model="form.name" type="text" placeholder="例如：阅读材料结构化" />
        </label>

        <label>
          Skill 编码
          <input v-model="form.code" type="text" placeholder="例如 reading-material-parser" />
        </label>

        <label>
          描述
          <textarea v-model="form.description" placeholder="说明这个 Skill 后续要做什么"></textarea>
        </label>

        <label>
          配置 JSON
          <textarea v-model="form.configText"></textarea>
        </label>

        <button
          class="primary-btn"
          :disabled="isSubmitting"
          @click="handleCreateSkill"
        >
          {{ isSubmitting ? '创建中……' : '创建 Skill' }}
        </button>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>Skill 列表</h2>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载 Skill……
        </div>

        <div v-else-if="skills.length > 0" class="attempt-list">
          <article
            v-for="skill in skills"
            :key="skill.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ skill.name }}</h3>
              <p>编码：{{ skill.code }}</p>
              <p>{{ skill.description || '暂无描述' }}</p>
              <p>状态：{{ skill.isActive ? '启用' : '停用' }}｜运行 {{ skill.runCount }} 次</p>
            </div>

            <button class="secondary-btn" @click="toggleSkill(skill)">
              {{ skill.isActive ? '停用' : '启用' }}
            </button>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无 Skill。
        </p>
      </div>
    </section>
  </div>
</template>
