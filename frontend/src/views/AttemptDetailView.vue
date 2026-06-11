<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getAttemptDetail } from '../api/examApi'

const route = useRoute()

const detail = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

const typeNameMap = {
  CHOICE: '单选题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const answerList = computed(() => {
  return detail.value?.answers || []
})

const totalQuestionCount = computed(() => {
  return answerList.value.length
})

const correctCount = computed(() => {
  return answerList.value.filter((item) => item.isCorrect === true).length
})

const wrongCount = computed(() => {
  return answerList.value.filter((item) => item.isCorrect === false).length
})

const pendingCount = computed(() => {
  return answerList.value.filter((item) => {
    return item.isCorrect !== true && item.isCorrect !== false
  }).length
})

const fullScore = computed(() => {
  const realTotalScore = answerList.value.reduce((sum, item) => {
    return sum + Number(item.score || 0)
  }, 0)

  return realTotalScore || Number(detail.value?.exam?.totalScore || 0)
})

const actualScore = computed(() => {
  return Number(detail.value?.attempt?.totalScore || 0)
})

const scoreRate = computed(() => {
  if (!fullScore.value) {
    return 0
  }

  return Math.round((actualScore.value / fullScore.value) * 100)
})

const accuracyRate = computed(() => {
  return Number(detail.value?.attempt?.accuracyRate || 0)
})

const wrongAnswers = computed(() => {
  return answerList.value.filter((item) => item.isCorrect === false)
})

const knowledgeStats = computed(() => {
  const map = new Map()

  answerList.value.forEach((item) => {
    const key = item.knowledgePoint || '未分类'

    if (!map.has(key)) {
      map.set(key, {
        name: key,
        totalCount: 0,
        wrongCount: 0,
        totalScore: 0,
        userScore: 0,
      })
    }

    const current = map.get(key)

    current.totalCount += 1
    current.totalScore += Number(item.score || 0)
    current.userScore += Number(item.userScore || 0)

    if (item.isCorrect === false) {
      current.wrongCount += 1
    }
  })

  return Array.from(map.values())
    .map((item) => {
      const scoreRateValue = item.totalScore
        ? Math.round((item.userScore / item.totalScore) * 100)
        : 0

      const wrongRateValue = item.totalCount
        ? Math.round((item.wrongCount / item.totalCount) * 100)
        : 0

      return {
        ...item,
        scoreRate: scoreRateValue,
        wrongRate: wrongRateValue,
      }
    })
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) {
        return b.wrongCount - a.wrongCount
      }

      return a.scoreRate - b.scoreRate
    })
})

const weakKnowledgePoints = computed(() => {
  return knowledgeStats.value.filter((item) => {
    return item.wrongCount > 0 || item.scoreRate < 80
  })
})

const typeStats = computed(() => {
  const map = new Map()

  answerList.value.forEach((item) => {
    const key = item.type || 'UNKNOWN'
    const typeName = typeNameMap[key] || key

    if (!map.has(key)) {
      map.set(key, {
        type: key,
        typeName,
        totalCount: 0,
        correctCount: 0,
        wrongCount: 0,
        totalScore: 0,
        userScore: 0,
      })
    }

    const current = map.get(key)

    current.totalCount += 1
    current.totalScore += Number(item.score || 0)
    current.userScore += Number(item.userScore || 0)

    if (item.isCorrect === true) {
      current.correctCount += 1
    }

    if (item.isCorrect === false) {
      current.wrongCount += 1
    }
  })

  return Array.from(map.values())
    .map((item) => {
      return {
        ...item,
        scoreRate: item.totalScore
          ? Math.round((item.userScore / item.totalScore) * 100)
          : 0,
        accuracyRate: item.totalCount
          ? Math.round((item.correctCount / item.totalCount) * 100)
          : 0,
      }
    })
    .sort((a, b) => {
      return a.typeName.localeCompare(b.typeName, 'zh-CN')
    })
})

const mainWeakPointText = computed(() => {
  if (weakKnowledgePoints.value.length === 0) {
    return '暂无明显薄弱知识点'
  }

  return weakKnowledgePoints.value
    .slice(0, 3)
    .map((item) => item.name)
    .join('、')
})

const learningSuggestion = computed(() => {
  if (totalQuestionCount.value === 0) {
    return '暂无题目数据，暂时无法生成学习建议。'
  }

  if (scoreRate.value >= 90 && wrongCount.value === 0) {
    return '本次表现非常稳定，可以继续挑战更高难度试卷，同时保持错题复盘习惯。'
  }

  if (scoreRate.value >= 80) {
    return `整体掌握较好，建议重点复盘 ${mainWeakPointText.value}，把少量失分点补齐。`
  }

  if (scoreRate.value >= 60) {
    return `基础已经具备，但稳定性还不够。建议优先复习 ${mainWeakPointText.value}，并进行对应错题重练。`
  }

  return `本次得分率偏低，建议先回到基础知识点，重点补习 ${mainWeakPointText.value}，再进行同类题专项练习。`
})

const resultLevel = computed(() => {
  if (scoreRate.value >= 90) {
    return '优秀'
  }

  if (scoreRate.value >= 80) {
    return '良好'
  }

  if (scoreRate.value >= 60) {
    return '及格'
  }

  return '需要加强'
})

const resultLevelClass = computed(() => {
  if (scoreRate.value >= 90) {
    return 'excellent'
  }

  if (scoreRate.value >= 80) {
    return 'good'
  }

  if (scoreRate.value >= 60) {
    return 'pass'
  }

  return 'weak'
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

const formatScore = (score) => {
  if (score === null || score === undefined) {
    return 0
  }

  return Number(score)
}

const getAnswerStatusText = (item) => {
  if (item.isCorrect === true) {
    return '正确'
  }

  if (item.isCorrect === false) {
    return '错误'
  }

  return '待评分'
}

const getAnswerStatusClass = (item) => {
  if (item.isCorrect === true) {
    return 'correct'
  }

  if (item.isCorrect === false) {
    return 'wrong'
  }

  return 'pending'
}

const loadAttemptDetail = async () => {
  const attemptId = route.params.attemptId

  if (!attemptId) {
    errorMessage.value = '缺少考试记录 ID'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await getAttemptDetail(attemptId)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '考试结果详情加载失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadAttemptDetail()
})
</script>

<template>
  <div class="attempt-detail-page">
    <div class="page-header">
      <p class="tag">Result Detail</p>
      <h1>考试结果详情</h1>
      <p class="desc">
        查看本次考试的得分、题型表现、薄弱知识点、复习建议和逐题解析。
      </p>
    </div>

    <div class="attempt-detail-actions">
      <RouterLink class="secondary-btn" to="/profile">
        返回个人中心
      </RouterLink>

      <RouterLink class="secondary-btn" to="/exams">
        返回试卷列表
      </RouterLink>

      <RouterLink class="secondary-btn" to="/profile">
       查看错题本
      </RouterLink>
    </div>

    <div v-if="isLoading" class="loading-box">
      正在加载考试结果详情……
    </div>

    <div v-else-if="errorMessage" class="api-warning">
      {{ errorMessage }}
    </div>

    <section v-else-if="detail" class="attempt-detail-section">
      <div class="attempt-summary-card">
        <div class="attempt-summary-title-row">
          <div>
            <h2>{{ detail.exam?.title || '未知试卷' }}</h2>
            <p class="attempt-submit-time">
              提交时间：{{ formatDateTime(detail.attempt.submittedAt) }}
            </p>
          </div>

          <div
            class="result-level-badge"
            :class="resultLevelClass"
          >
            {{ resultLevel }}
          </div>
        </div>

        <div class="attempt-summary-grid">
          <div>
            <span>本次得分</span>
            <strong>{{ actualScore }} / {{ fullScore }}</strong>
          </div>

          <div>
            <span>得分率</span>
            <strong>{{ scoreRate }}%</strong>
          </div>

          <div>
            <span>正确率</span>
            <strong>{{ accuracyRate }}%</strong>
          </div>

          <div>
            <span>客观题得分</span>
            <strong>{{ formatScore(detail.attempt.objectiveScore) }}</strong>
          </div>

          <div>
            <span>主观题得分</span>
            <strong>{{ formatScore(detail.attempt.subjectiveScore) }}</strong>
          </div>

          <div>
            <span>题目数量</span>
            <strong>{{ totalQuestionCount }}</strong>
          </div>

          <div>
            <span>正确题数</span>
            <strong>{{ correctCount }}</strong>
          </div>

          <div>
            <span>错误题数</span>
            <strong>{{ wrongCount }}</strong>
          </div>

          <div>
            <span>待评分</span>
            <strong>{{ pendingCount }}</strong>
          </div>

          <div>
            <span>用时</span>
            <strong>{{ formatUsedTime(detail.attempt.usedTime) }}</strong>
          </div>
        </div>
      </div>

      <div class="learning-analysis-grid">
        <div class="learning-analysis-card">
          <div class="section-title-row">
            <div>
              <h2>复习建议</h2>
              <p class="section-subtitle">
                根据本次得分、错题和知识点生成
              </p>
            </div>
          </div>

          <p class="learning-suggestion-text">
            {{ learningSuggestion }}
          </p>

          <div class="weak-point-summary">
            <span>主要薄弱点</span>
            <strong>{{ mainWeakPointText }}</strong>
          </div>
        </div>

        <div class="learning-analysis-card">
          <div class="section-title-row">
            <div>
              <h2>薄弱知识点</h2>
              <p class="section-subtitle">
                按错题数量和得分率排序
              </p>
            </div>
          </div>

          <div v-if="weakKnowledgePoints.length > 0" class="knowledge-stat-list">
            <div
              v-for="item in weakKnowledgePoints"
              :key="item.name"
              class="knowledge-stat-item"
            >
              <div>
                <strong>{{ item.name }}</strong>
                <p>
                  错 {{ item.wrongCount }} / {{ item.totalCount }} 题，
                  得分 {{ item.userScore }} / {{ item.totalScore }}
                </p>
              </div>

              <span>{{ item.scoreRate }}%</span>
            </div>
          </div>

          <p v-else class="empty-text">
            本次没有明显薄弱知识点。
          </p>
        </div>
      </div>

      <div class="learning-analysis-card">
        <div class="section-title-row">
          <div>
            <h2>题型得分情况</h2>
            <p class="section-subtitle">
              查看不同题型的正确率和得分率
            </p>
          </div>
        </div>

        <div v-if="typeStats.length > 0" class="type-stat-table-wrap">
          <table class="type-stat-table">
            <thead>
              <tr>
                <th>题型</th>
                <th>题数</th>
                <th>正确</th>
                <th>错误</th>
                <th>得分</th>
                <th>得分率</th>
                <th>正确率</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="item in typeStats"
                :key="item.type"
              >
                <td>{{ item.typeName }}</td>
                <td>{{ item.totalCount }}</td>
                <td>{{ item.correctCount }}</td>
                <td>{{ item.wrongCount }}</td>
                <td>{{ item.userScore }} / {{ item.totalScore }}</td>
                <td>{{ item.scoreRate }}%</td>
                <td>{{ item.accuracyRate }}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-text">
          暂无题型统计。
        </p>
      </div>

      <div class="attempt-answer-list">
        <div class="section-title-row">
          <div>
            <h2>逐题解析</h2>
            <p class="section-subtitle">
              共 {{ totalQuestionCount }} 题，错题 {{ wrongCount }} 题
            </p>
          </div>
        </div>

        <div
          v-for="item in answerList"
          :key="item.answerId"
          class="attempt-answer-card"
          :class="getAnswerStatusClass(item)"
        >
          <div class="attempt-answer-header">
            <span>第 {{ item.orderIndex }} 题</span>
            <span>{{ typeNameMap[item.type] || item.type }}</span>
            <span>{{ formatScore(item.userScore) }} / {{ formatScore(item.score) }} 分</span>
            <span
              class="answer-status-badge"
              :class="getAnswerStatusClass(item)"
            >
              {{ getAnswerStatusText(item) }}
            </span>
          </div>

          <h3>{{ item.text }}</h3>

          <ul v-if="item.options && item.options.length > 0">
            <li
              v-for="(option, index) in item.options"
              :key="option"
            >
              {{ String.fromCharCode(65 + index) }}. {{ option }}
            </li>
          </ul>

          <div class="attempt-answer-info">
            <p>
              <strong>你的答案：</strong>
              {{ item.userAnswerDisplay || item.answerText || '未作答' }}
            </p>

            <p>
              <strong>正确答案：</strong>
              {{ item.correctAnswerDisplay || item.referenceAnswer || '暂无' }}
            </p>

            <p>
              <strong>知识点：</strong>
              {{ item.knowledgePoint || '未分类' }}
            </p>

            <p v-if="item.referenceAnswer">
              <strong>参考答案：</strong>
              {{ item.referenceAnswer }}
            </p>

            <p v-if="item.explanation">
              <strong>解析：</strong>
              {{ item.explanation }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <p v-else class="empty-text">
      暂无考试结果详情。
    </p>
  </div>
</template>
