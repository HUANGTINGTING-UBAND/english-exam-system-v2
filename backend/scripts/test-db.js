const prisma = require('../src/lib/prisma')

const testDatabaseConnection = async () => {
  try {
    const userCount = await prisma.user.count()
    const registeredUserCount = await prisma.user.count({
      where: {
        username: {
         not: 'guest_student',
        },
      },
    })
    const examCount = await prisma.exam.count()
    const questionCount = await prisma.question.count()
    const attemptCount = await prisma.examAttempt.count()
    const answerCount = await prisma.userAnswer.count()
    const wrongQuestionCount = await prisma.wrongQuestion.count()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
        gradeLevel: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })


    console.log('Database connection successful.')
    console.log(`Users: ${userCount}`)
    console.log(`Exams: ${examCount}`)
    console.log(`Questions: ${questionCount}`)
    console.log(`Attempts: ${attemptCount}`)
    console.log(`UserAnswers: ${answerCount}`)
    console.log(`WrongQuestions: ${wrongQuestionCount}`)
    console.log('User list:')
    console.table(users)
  } catch (error) {
    console.error('Database connection failed.')
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabaseConnection()