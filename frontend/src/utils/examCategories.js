export const examCategoryGroups = [
  {
    key: 'K12',
    name: 'K12 校内英语',
    description: '覆盖小学、初中、高中英语练习与升学模拟。',
    grades: ['PRIMARY', 'JUNIOR', 'SENIOR'],
  },
  {
    key: 'COLLEGE',
    name: '大学英语',
    description: '覆盖大学英语四级、六级和考研英语。',
    grades: ['CET4', 'CET6', 'POSTGRADUATE', 'COLLEGE'],
  },
  {
    key: 'ABROAD',
    name: '出国英语考试',
    description: '覆盖雅思 IELTS、托福 TOEFL 等留学语言考试。',
    grades: ['IELTS', 'TOEFL'],
  },
  {
    key: 'OTHER_EXAM',
    name: '其他英语考试',
    description: '覆盖商务英语、成人英语、职称英语等考试。',
    grades: ['BUSINESS', 'ADULT', 'PROFESSIONAL'],
  },
  {
    key: 'OTHER',
    name: '其他',
    description: '放置综合练习、未分类试卷和自定义试卷。',
    grades: ['GENERAL', 'OTHER'],
  },
]

export const examCategoryOptions = [
  {
    group: 'K12 校内英语',
    options: [
      { value: 'PRIMARY', label: '小学英语' },
      { value: 'JUNIOR', label: '初中英语' },
      { value: 'SENIOR', label: '高中英语' },
    ],
  },
  {
    group: '大学英语',
    options: [
      { value: 'CET4', label: '大学英语四级' },
      { value: 'CET6', label: '大学英语六级' },
      { value: 'POSTGRADUATE', label: '考研英语' },
      { value: 'COLLEGE', label: '大学英语综合' },
    ],
  },
  {
    group: '出国英语考试',
    options: [
      { value: 'IELTS', label: '雅思 IELTS' },
      { value: 'TOEFL', label: '托福 TOEFL' },
    ],
  },
  {
    group: '其他英语考试',
    options: [
      { value: 'BUSINESS', label: '商务英语' },
      { value: 'ADULT', label: '成人英语' },
      { value: 'PROFESSIONAL', label: '职称英语' },
    ],
  },
  {
    group: '其他',
    options: [
      { value: 'GENERAL', label: '综合练习' },
      { value: 'OTHER', label: '未分类' },
    ],
  },
]

export const examCategoryNameMap = {
  PRIMARY: '小学英语',
  JUNIOR: '初中英语',
  SENIOR: '高中英语',
  COLLEGE: '大学英语综合',
  CET4: '大学英语四级',
  CET6: '大学英语六级',
  POSTGRADUATE: '考研英语',
  IELTS: '雅思 IELTS',
  TOEFL: '托福 TOEFL',
  BUSINESS: '商务英语',
  ADULT: '成人英语',
  PROFESSIONAL: '职称英语',
  GENERAL: '综合练习',
  OTHER: '未分类',

  primary: '小学英语',
  junior: '初中英语',
  senior: '高中英语',
  college: '大学英语综合',
  cet4: '大学英语四级',
  cet6: '大学英语六级',
  postgraduate: '考研英语',
  ielts: '雅思 IELTS',
  toefl: '托福 TOEFL',
  business: '商务英语',
  adult: '成人英语',
  professional: '职称英语',
  general: '综合练习',
  other: '未分类',
}

export const examGroupNameMap = {
  K12: 'K12 校内英语',
  COLLEGE: '大学英语',
  ABROAD: '出国英语考试',
  OTHER_EXAM: '其他英语考试',
  OTHER: '其他',
}

export const getExamCategoryName = (value) => {
  return examCategoryNameMap[value] || value || '未分类'
}

export const getExamGroupName = (value) => {
  return examGroupNameMap[value] || value || '全部考试方向'
}
