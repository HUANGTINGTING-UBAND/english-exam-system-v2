<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser, logoutUser } from '../api/authApi'
import {
  deleteAttemptHistory,
  getAttemptHistory,
  getWrongQuestions,
  markWrongQuestionMastered,
} from '../api/examApi'

const currentUser = ref(getSavedUser())
const attemptHistory = ref([])
const wrongQuestions = ref([])
const isLoadingHistory = ref(false)
const isLoadingWrongQuestions = ref(false)
const historyErrorMessage = ref('')
const wrongQuestionErrorMessage = ref('')
const successMessage = ref('')

const wrongKeyword = ref('')
const wrongTypeFilter = ref('ALL')
const wrongKnowledgeFilter = ref('ALL')
const wrongSortType = ref('NEWEST')

const isLoggedIn = computed(() => {
  return Boolean(currentUser.value)
})

const roleNameMap = {
  STUDENT: '学生',
  ADMIN: '管理员',
}

const typeNameMap = {
  CHOICE: '单选题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const totalAttempts = computed(() => {
  return attemptHistory.value.length
})

const totalWrongQuestions = computed(() => {
  return wrongQuestions.value.length
})

const uniqueWrongKnowledgePoints = computed(() => {
  const set = new Set()

  wrongQuestions.value.forEach((item) => {
    set.add(item.knowledgePoint || '未分类')
  })

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const uniqueWrongTypes = computed(() => {
  const set = new Set()

  wrongQuestions.value.forEach((item) => {
    set.add(item.questionType || 'UNKNOWN')
  })

  return Array.from(set).sort((a, b) => {
    const nameA = typeNameMap[a] || a
    const nameB = typeNameMap[b] || b

    return nameA.localeCompare(nameB, 'zh-CN')
  })
})

const filteredWrongQuestions = computed(() => {
  const keyword = wrongKeyword.value.trim().toLowerCase()

  const result = wrongQuestions.value.filter((item) => {
    const knowledgePoint = item.knowledgePoint || '未分类'
    const questionType = item.questionType || 'UNKNOWN'

    const text = [
      item.questionText,
      item.examTitle,
      knowledgePoint,
      item.referenceAnswer,
      item.explanation,
      typeNameMap[questionType],
      questionType,
    ]
      .join(' ')
      .toLowerCase()

    const matchedKeyword = !keyword || text.includes(keyword)

    const matchedType =
      wrongTypeFilter.value === 'ALL' ||
      questionType === wrongTypeFilter.value

    const matchedKnowledge =
      wrongKnowledgeFilter.value === 'ALL' ||
      knowledgePoint === wrongKnowledgeFilter.value

    return matchedKeyword && matchedType && matchedKnowledge
  })

  return [...result].sort((a, b) => {
    if (wrongSortType.value === 'OLDEST') {
      return new Date(a.createdAt || a.savedAt || 0).getTime() -
        new Date(b.createdAt || b.savedAt || 0).getTime()
    }

    if (wrongSortType.value === 'KNOWLEDGE_ASC') {
      return String(a.knowledgePoint || '未分类').localeCompare(
        String(b.knowledgePoint || '未分类'),
        'zh-CN'
      )
    }

    if (wrongSortType.value === 'TYPE_ASC') {
      const typeA = typeNameMap[a.questionType] || a.questionType || ''
      const typeB = typeNameMap[b.questionType] || b.questionType || ''

      return typeA.localeCompare(typeB, 'zh-CN')
    }

    return new Date(b.createdAt || b.savedAt || 0).getTime() -
      new Date(a.createdAt || a.savedAt || 0).getTime()
  })
})

const hasWrongFilter = computed(() => {
  return (
    wrongKeyword.value.trim() ||
    wrongTypeFilter.value !== 'ALL' ||
    wrongKnowledgeFilter.value !== 'ALL' ||
    wrongSortType.value !== 'NEWEST'
  )
})

const topWrongKnowledgePoints = computed(() => {
  const map = new Map()

  wrongQuestions.value.forEach((item) => {
    const key = item.knowledgePoint || '未分类'
    map.set(key, (map.get(key) || 0) + 1)
  })

  return Array.from(map.entries())
    .map(([name, count]) => ({
      name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
})

const mainWrongKnowledgeText = computed(() => {
  if (topWrongKnowledgePoints.value.length === 0) {
    return '暂无'
  }

  return topWrongKnowledgePoints.value
    .map((item) => `${item.name}（${item.count}题）`)
    .join('、')
})

const getAttemptFullScore = (attempt) => {
  return Number(attempt.examTotalScore || attempt.realTotalScore || attempt.fullScore || 0)
}

const getAttemptScore = (attempt) => {
  return Number(attempt.totalScore || 0)
}

const getScoreRate = (attempt) => {
  const score = getAttemptScore(attempt)
  const fullScore = getAttemptFullScore(attempt)

  if (!fullScore) {
    return 0
  }

  return Math.round((score / fullScore) * 100)
}

const averageScoreRate = computed(() => {
  if (attemptHistory.value.length === 0) {
    return 0
  }

  const totalRate = attemptHistory.value.reduce((sum, item) => {
    return sum + getScoreRate(item)
  }, 0)

  return Math.round(totalRate / attemptHistory.value.length)
})

const bestScoreRate = computed(() => {
  if (attemptHistory.value.length === 0) {
    return 0
  }

  return Math.max(
    ...attemptHistory.value.map((item) => getScoreRate(item))
  )
})

const averageAccuracy = computed(() => {
  if (attemptHistory.value.length === 0) {
    return 0
  }

  const total = attemptHistory.value.reduce((sum, item) => {
    return sum + Number(item.accuracyRate || 0)
  }, 0)

  return Math.round(total / attemptHistory.value.length)
})

const latestAttempt = computed(() => {
  if (attemptHistory.value.length === 0) {
    return null
  }

  return attemptHistory.value[0]
})

const learningSuggestion = computed(() => {
  if (attemptHistory.value.length === 0) {
    return '先完成一套试卷，系统会根据你的考试记录生成学习建议。'
  }

  if (averageScoreRate.value >= 85 && averageAccuracy.value >= 85 && totalWrongQuestions.value <= 3) {
    return '整体表现不错，可以继续挑战更高难度试卷，并保持错题复盘。'
  }

  if (totalWrongQuestions.value >= 8) {
    return `当前错题较多，建议优先处理 ${mainWrongKnowledgeText.value}，先完成错题重练，再进行整卷训练。`
  }

  if (averageScoreRate.value < 60 || averageAccuracy.value < 60) {
    return '得分率或正确率偏低，建议先复习基础知识点，再进行整卷训练。'
  }

  return '继续保持练习节奏，建议每次考试后查看结果详情并处理错题。'
})

const wrongPracticeSuggestion = computed(() => {
  if (totalWrongQuestions.value === 0) {
    return '当前暂无错题，继续保持。'
  }

  if (topWrongKnowledgePoints.value.length > 0) {
    return `建议优先练习：${mainWrongKnowledgeText.value}。`
  }

  return '建议按照错题产生时间，从最新错题开始复习。'
})

const formatDateTime = (dateValue) => {
  if (!dateValue) {
    return '暂无'
  }

  return new Date(dateValue).toLocaleString()
}

const formatUsedTime = (seconds) => {
  const totalSeconds = Number(seconds || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const restSeconds = totalSeconds % 60

  return `${minutes} 分 ${restSeconds} 秒`
}

const clearWrongFilters = () => {
  wrongKeyword.value = ''
  wrongTypeFilter.value = 'ALL'
  wrongKnowledgeFilter.value = 'ALL'
  wrongSortType.value = 'NEWEST'
}

const handleLogout = () => {
  logoutUser()
  currentUser.value = null
  attemptHistory.value = []
  wrongQuestions.value = []
  clearWrongFilters()
}

const loadAttemptHistory = async () => {
  if (!isLoggedIn.value) {
    return
  }

  isLoadingHistory.value = true
  historyErrorMessage.value = ''

  try {
    attemptHistory.value = await getAttemptHistory()
  } catch (error) {
    console.error(error)
    historyErrorMessage.value = error.message || '考试历史加载失败'
  } finally {
    isLoadingHistory.value = false
  }
}

const loadWrongQuestions = async () => {
  if (!isLoggedIn.value) {
    return
  }

  isLoadingWrongQuestions.value = true
  wrongQuestionErrorMessage.value = ''

  try {
    wrongQuestions.value = await getWrongQuestions()
  } catch (error) {
    console.error(error)
    wrongQuestionErrorMessage.value = error.message || '错题本加载失败'
  } finally {
    isLoadingWrongQuestions.value = false
  }
}

const refreshProfileData = async () => {
  await Promise.all([
    loadAttemptHistory(),
    loadWrongQuestions(),
  ])
}

const handleDeleteAttempt = async (attempt) => {
  const confirmed = window.confirm(
    `确认删除这次考试记录吗？\n\n试卷：${attempt.examTitle || '未知试卷'}\n得分：${getAttemptScore(attempt)} / ${getAttemptFullScore(attempt)} 分\n\n删除后，该次考试答案和对应错题记录也会被删除。`
  )

  if (!confirmed) {
    return
  }

  const secondConfirmed = window.confirm(
    '请再次确认：删除后不可恢复。是否继续？'
  )

  if (!secondConfirmed) {
    return
  }

  historyErrorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteAttemptHistory(attempt.id)

    attemptHistory.value = attemptHistory.value.filter(
      (item) => item.id !== attempt.id
    )

    await loadWrongQuestions()

    successMessage.value = '考试记录已删除，相关答案和错题记录也已同步清理。'
  } catch (error) {
    console.error(error)
    historyErrorMessage.value = error.message || '删除考试记录失败'
  }
}

const handleMarkMastered = async (item) => {
  const confirmed = window.confirm(
    `确认将这道错题标记为已掌握吗？\n\n标记后它会从错题本中移除。`
  )

  if (!confirmed) {
    return
  }

  wrongQuestionErrorMessage.value = ''
  successMessage.value = ''

  try {
    await markWrongQuestionMastered(item.id)

    wrongQuestions.value = wrongQuestions.value.filter(
      (wrongQuestion) => wrongQuestion.id !== item.id
    )

    successMessage.value = '已标记为掌握，错题已从错题本移除。'
  } catch (error) {
    console.error(error)
    wrongQuestionErrorMessage.value = error.message || '标记已掌握失败'
  }
}

onMounted(() => {
  refreshProfileData()
})
</script>

<template>
  <div class="profile-page">
    <div class="page-header">
      <p class="tag">Profile</p>
      <h1>个人中心</h1>
      <p class="desc">
        查看你的账号信息、学习数据、考试历史和错题记录。
      </p>
    </div>

    <section v-if="!isLoggedIn" class="profile-login-card">
      <h2>你还没有登录</h2>
      <p>
        登录后可以保存考试记录、查看错题本，并继续追踪学习情况。
      </p>

      <div class="profile-actions">
        <RouterLink class="primary-btn" to="/login">
          去登录
        </RouterLink>

        <RouterLink class="secondary-btn" to="/register">
          注册账号
        </RouterLink>
      </div>
    </section>

    <section v-else class="profile-section">
      <div class="profile-card">
        <div>
          <p class="tag">Account</p>
          <h2>{{ currentUser.nickname || currentUser.username }}</h2>
          <p>
            用户名：{{ currentUser.username }}
          </p>
          <p>
            角色：{{ roleNameMap[currentUser.role] || currentUser.role }}
          </p>
        </div>

        <div class="profile-actions">
          <RouterLink
            v-if="currentUser.role === 'ADMIN'"
            class="secondary-btn"
            to="/admin"
          >
            管理员后台
          </RouterLink>

          <button class="secondary-btn" @click="refreshProfileData">
            刷新数据
          </button>

          <button class="secondary-btn" @click="handleLogout">
            退出登录
          </button>
        </div>
      </div>

      <div v-if="successMessage" class="api-success">
        {{ successMessage }}
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>学习数据概览</h2>
        </div>

        <div class="learning-stats-grid">
          <div class="learning-stat-item">
            <span>考试次数</span>
            <strong>{{ totalAttempts }}</strong>
          </div>

          <div class="learning-stat-item">
            <span>平均得分率</span>
            <strong>{{ averageScoreRate }}%</strong>
          </div>

          <div class="learning-stat-item">
            <span>最高得分率</span>
            <strong>{{ bestScoreRate }}%</strong>
          </div>

          <div class="learning-stat-item">
            <span>平均正确率</span>
            <strong>{{ averageAccuracy }}%</strong>
          </div>

          <div class="learning-stat-item">
            <span>当前错题</span>
            <strong>{{ totalWrongQuestions }}</strong>
          </div>
        </div>

        <div class="learning-suggestion-box">
          <h3>学习建议</h3>
          <p>{{ learningSuggestion }}</p>
        </div>

        <div v-if="latestAttempt" class="latest-attempt-box">
          <h3>最近一次考试</h3>
          <p>
            {{ latestAttempt.examTitle || '未知试卷' }}
          </p>
          <p>
            得分：{{ getAttemptScore(latestAttempt) }} / {{ getAttemptFullScore(latestAttempt) }} 分 /
            得分率：{{ getScoreRate(latestAttempt) }}% /
            正确率：{{ latestAttempt.accuracyRate }}% /
            用时：{{ formatUsedTime(latestAttempt.usedTime) }}
          </p>

          <RouterLink
            class="secondary-btn"
            :to="`/attempts/${latestAttempt.id}`"
          >
            查看最近考试详情
          </RouterLink>
        </div>
      </div>

      <div class="profile-grid">
        <div class="profile-panel">
          <div class="section-title-row">
            <h2>考试历史</h2>
            <button class="secondary-btn" @click="loadAttemptHistory">
              刷新
            </button>
          </div>

          <div v-if="historyErrorMessage" class="api-warning">
            {{ historyErrorMessage }}
          </div>

          <div v-if="isLoadingHistory" class="loading-box">
            正在加载考试历史……
          </div>

          <div v-else-if="attemptHistory.length > 0" class="history-list">
            <div
              v-for="attempt in attemptHistory"
              :key="attempt.id"
              class="history-item"
            >
              <div>
                <h3>{{ attempt.examTitle || '未知试卷' }}</h3>
                <p>
                  得分：{{ getAttemptScore(attempt) }} / {{ getAttemptFullScore(attempt) }} 分
                </p>
                <p>
                  得分率：{{ getScoreRate(attempt) }}% /
                  正确率：{{ attempt.accuracyRate }}%
                </p>
                <p>
                  用时：{{ formatUsedTime(attempt.usedTime) }}
                </p>
                <p>
                  提交时间：{{ formatDateTime(attempt.submittedAt) }}
                </p>
              </div>

              <div class="history-actions">
                <RouterLink
                  class="secondary-btn"
                  :to="`/attempts/${attempt.id}`"
                >
                  查看详情
                </RouterLink>

                <button
                  class="danger-btn"
                  @click="handleDeleteAttempt(attempt)"
                >
                  删除记录
                </button>
              </div>
            </div>
          </div>

          <p v-else class="empty-text">
            暂无考试历史。
          </p>
        </div>

        <div class="profile-panel">
          <div class="section-title-row">
            <div>
              <h2>错题本</h2>
              <p class="section-subtitle">
                当前显示 {{ filteredWrongQuestions.length }} / {{ wrongQuestions.length }} 道错题
              </p>
            </div>

            <button class="secondary-btn" @click="loadWrongQuestions">
              刷新
            </button>
          </div>

          <div v-if="wrongQuestions.length > 0" class="wrong-filter-card">
            <input
              v-model="wrongKeyword"
              class="wrong-filter-input"
              type="text"
              placeholder="搜索题干、知识点、解析或试卷"
            />

            <select v-model="wrongTypeFilter" class="wrong-filter-select">
              <option value="ALL">全部题型</option>
              <option
                v-for="type in uniqueWrongTypes"
                :key="type"
                :value="type"
              >
                {{ typeNameMap[type] || type }}
              </option>
            </select>

            <select v-model="wrongKnowledgeFilter" class="wrong-filter-select">
              <option value="ALL">全部知识点</option>
              <option
                v-for="knowledgePoint in uniqueWrongKnowledgePoints"
                :key="knowledgePoint"
                :value="knowledgePoint"
              >
                {{ knowledgePoint }}
              </option>
            </select>

            <select v-model="wrongSortType" class="wrong-filter-select">
              <option value="NEWEST">最新错题优先</option>
              <option value="OLDEST">最早错题优先</option>
              <option value="KNOWLEDGE_ASC">按知识点排序</option>
              <option value="TYPE_ASC">按题型排序</option>
            </select>

            <button
              v-if="hasWrongFilter"
              class="secondary-btn"
              @click="clearWrongFilters"
            >
              清空筛选
            </button>
          </div>

          <div v-if="wrongQuestions.length > 0" class="wrong-summary-box">
            <p>
              {{ wrongPracticeSuggestion }}
            </p>
          </div>

          <div v-if="wrongQuestionErrorMessage" class="api-warning">
            {{ wrongQuestionErrorMessage }}
          </div>

          <div v-if="isLoadingWrongQuestions" class="loading-box">
            正在加载错题本……
          </div>

          <div v-else-if="filteredWrongQuestions.length > 0" class="wrong-question-list">
            <div
              v-for="item in filteredWrongQuestions"
              :key="item.id"
              class="wrong-question-item"
            >
              <p class="tag">
                {{ typeNameMap[item.questionType] || item.questionType || '题目' }}
              </p>

              <h3>{{ item.questionText || '题目内容暂缺' }}</h3>

              <p>
                知识点：{{ item.knowledgePoint || '未分类' }}
              </p>

              <p>
                来源试卷：{{ item.examTitle || '未知试卷' }}
              </p>

              <p v-if="item.referenceAnswer">
                参考答案：{{ item.referenceAnswer }}
              </p>

              <p v-if="item.explanation">
                解析：{{ item.explanation }}
              </p>

              <div class="wrong-question-actions">
                <RouterLink
                  class="primary-btn"
                  :to="`/wrong-practice/${item.id}`"
                >
                  重新练习
                </RouterLink>

                <button
                  class="secondary-btn"
                  @click="handleMarkMastered(item)"
                >
                  标记已掌握
                </button>
              </div>
            </div>
          </div>

          <p v-else class="empty-text">
            {{ hasWrongFilter ? '暂无符合筛选条件的错题。' : '暂无错题。' }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
