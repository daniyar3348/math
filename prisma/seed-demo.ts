// Демо-контент (§19): реальные двуязычные учебные материалы (без lorem ipsum).
// Идемпотентен: фиксированные id + upsert. Результаты тестов создаются честно —
// прогоном попытки через движок (см. seedResults).
import type { PrismaClient } from "../lib/generated/prisma/client";
import type { QuestionType, ContentStatus } from "../lib/generated/prisma/enums";

type Ctx = { orgId: string; adminId: string; teacherId: string; studentId: string };

export async function seedDemoContent(prisma: PrismaClient, ctx: Ctx) {
  const { orgId } = ctx;

  // ————— Таксономия —————
  const math = await prisma.subject.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug: "matematika" } },
    update: {},
    create: { organizationId: orgId, slug: "matematika", nameKk: "Математика", nameRu: "Математика", sort: 0 },
  });
  const kaz = await prisma.subject.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug: "kazak-tili" } },
    update: {},
    create: { organizationId: orgId, slug: "kazak-tili", nameKk: "Қазақ тілі", nameRu: "Казахский язык", sort: 1 },
  });

  const grades: Record<number, string> = {};
  for (const n of [5, 6, 7]) {
    const g = await prisma.gradeLevel.upsert({
      where: { organizationId_number: { organizationId: orgId, number: n } },
      update: {},
      create: { organizationId: orgId, number: n, nameKk: `${n}-сынып`, nameRu: `${n} класс` },
    });
    grades[n] = g.id;
  }

  const topicsData = [
    { slug: "naturalnye-chisla", subjectId: math.id, grade: 5, kk: "Натурал сандар", ru: "Натуральные числа" },
    { slug: "drobi", subjectId: math.id, grade: 5, kk: "Жай бөлшектер", ru: "Обыкновенные дроби" },
    { slug: "procenty", subjectId: math.id, grade: 6, kk: "Пайыздар", ru: "Проценты" },
    { slug: "uravneniya", subjectId: math.id, grade: 6, kk: "Теңдеулер", ru: "Уравнения" },
    { slug: "sozdik-qor", subjectId: kaz.id, grade: 5, kk: "Сөздік қор", ru: "Словарный запас" },
    { slug: "morfologiya", subjectId: kaz.id, grade: 6, kk: "Морфология", ru: "Морфология" },
  ];
  const topics: Record<string, string> = {};
  for (const [i, td] of topicsData.entries()) {
    const t = await prisma.topic.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: td.slug } },
      update: {},
      create: {
        organizationId: orgId, subjectId: td.subjectId, gradeLevelId: grades[td.grade],
        slug: td.slug, nameKk: td.kk, nameRu: td.ru, sort: i,
      },
    });
    topics[td.slug] = t.id;
  }

  const objectives = [
    { topic: "procenty", code: "6.1.1", kk: "Санның пайызын табу", ru: "Находить процент от числа" },
    { topic: "procenty", code: "6.1.2", kk: "Пайызы бойынша санды табу", ru: "Находить число по его проценту" },
    { topic: "drobi", code: "5.2.1", kk: "Бөлшектерді салыстыру", ru: "Сравнивать дроби" },
    { topic: "uravneniya", code: "6.3.1", kk: "Сызықтық теңдеулерді шешу", ru: "Решать линейные уравнения" },
  ];
  const objByCode: Record<string, string> = {};
  for (const o of objectives) {
    const row = await prisma.learningObjective.upsert({
      where: { topicId_code: { topicId: topics[o.topic], code: o.code } },
      update: {},
      create: { topicId: topics[o.topic], code: o.code, nameKk: o.kk, nameRu: o.ru },
    });
    objByCode[o.code] = row.id;
  }

  const cohort = await prisma.cohort.upsert({
    where: { id: "cohort-6a" },
    update: {},
    create: {
      id: "cohort-6a", organizationId: orgId, name: "6А (2026)",
      gradeLevelId: grades[6], teacherUserId: ctx.teacherId,
    },
  });
  await prisma.cohortMember.upsert({
    where: { cohortId_userId: { cohortId: cohort.id, userId: ctx.studentId } },
    update: {},
    create: { cohortId: cohort.id, userId: ctx.studentId },
  });

  // ————— Банк вопросов (20, все 10 типов) —————
  interface QDef {
    id: string;
    type: QuestionType;
    subjectId: string;
    grade: number;
    topic: string;
    objective?: string;
    difficulty: number;
    points: number;
    kk: string;
    ru: string;
    explKk?: string;
    explRu?: string;
    config?: object;
    choices?: { kk: string; ru: string; correct?: boolean }[];
    tags?: string[];
  }

  const Q: QDef[] = [
    {
      id: "q-demo-01", type: "SINGLE_CHOICE", subjectId: math.id, grade: 6, topic: "procenty",
      objective: "6.1.1", difficulty: 1, points: 1,
      kk: "250 санының 10%-ы неге тең?", ru: "Чему равны 10% от числа 250?",
      explKk: "10% = 1/10. 250 : 10 = 25.", explRu: "10% = 1/10. 250 : 10 = 25.",
      choices: [
        { kk: "25", ru: "25", correct: true },
        { kk: "2,5", ru: "2,5" },
        { kk: "50", ru: "50" },
        { kk: "10", ru: "10" },
      ],
      tags: ["пайыз", "процент"],
    },
    {
      id: "q-demo-02", type: "SINGLE_CHOICE", subjectId: math.id, grade: 6, topic: "procenty",
      difficulty: 1, points: 1,
      kk: "25% бөлшек түрінде қалай жазылады?", ru: "Как записать 25% в виде дроби?",
      explKk: "25% = 25/100 = 1/4.", explRu: "25% = 25/100 = 1/4.",
      choices: [
        { kk: "1/4", ru: "1/4", correct: true },
        { kk: "1/2", ru: "1/2" },
        { kk: "1/25", ru: "1/25" },
        { kk: "2/5", ru: "2/5" },
      ],
    },
    {
      id: "q-demo-03", type: "MULTI_CHOICE", subjectId: math.id, grade: 6, topic: "procenty",
      difficulty: 2, points: 2,
      kk: "Қай жазбалар 50%-ға тең? (бірнеше жауап)", ru: "Какие записи равны 50%? (несколько ответов)",
      explKk: "50% = 1/2 = 0,5 = 50/100.", explRu: "50% = 1/2 = 0,5 = 50/100.",
      config: { partial: "proportional" },
      choices: [
        { kk: "1/2", ru: "1/2", correct: true },
        { kk: "0,5", ru: "0,5", correct: true },
        { kk: "50/100", ru: "50/100", correct: true },
        { kk: "5/100", ru: "5/100" },
      ],
    },
    {
      id: "q-demo-04", type: "TRUE_FALSE", subjectId: math.id, grade: 6, topic: "procenty",
      objective: "6.1.1", difficulty: 1, points: 1,
      kk: "50 санының 20%-ы 10-ға тең.", ru: "20% от числа 50 равны 10.",
      explKk: "50 · 0,2 = 10 — дұрыс.", explRu: "50 · 0,2 = 10 — верно.",
      config: { answer: true },
    },
    {
      id: "q-demo-05", type: "NUMERIC", subjectId: math.id, grade: 6, topic: "procenty",
      objective: "6.1.1", difficulty: 2, points: 2,
      kk: "200 санының 15%-ын табыңыз.", ru: "Найдите 15% от числа 200.",
      explKk: "200 · 0,15 = 30.", explRu: "200 · 0,15 = 30.",
      config: { answer: 30, tolerance: 0 },
    },
    {
      id: "q-demo-06", type: "SHORT_TEXT", subjectId: math.id, grade: 6, topic: "procenty",
      difficulty: 1, points: 1,
      kk: "Санның жүзден бір бөлігі қалай аталады? (бір сөзбен)",
      ru: "Как называется сотая часть числа? (одним словом)",
      explKk: "Пайыз — санның жүзден бір бөлігі.", explRu: "Процент — сотая часть числа.",
      config: { answers: { kk: ["пайыз"], ru: ["процент"] }, caseSensitive: false },
    },
    {
      id: "q-demo-07", type: "FILL_BLANKS", subjectId: math.id, grade: 6, topic: "procenty",
      objective: "6.1.2", difficulty: 2, points: 2,
      kk: "Толтырыңыз: 1% = 1/{{a}}. 300 санының 10%-ы = {{b}}.",
      ru: "Заполните: 1% = 1/{{a}}. 10% от числа 300 = {{b}}.",
      explKk: "1% = 1/100; 300 · 0,1 = 30.", explRu: "1% = 1/100; 300 · 0,1 = 30.",
      config: {
        blanks: [
          { id: "a", answers: { kk: ["100"], ru: ["100"] } },
          { id: "b", answers: { kk: ["30"], ru: ["30"] } },
        ],
        partial: true,
      },
    },
    {
      id: "q-demo-08", type: "MATCHING", subjectId: math.id, grade: 6, topic: "procenty",
      difficulty: 2, points: 3,
      kk: "Пайызды бөлшекпен сәйкестендіріңіз.", ru: "Сопоставьте процент и дробь.",
      config: {
        pairs: [
          { left: { kk: "25%", ru: "25%" }, right: { kk: "1/4", ru: "1/4" } },
          { left: { kk: "50%", ru: "50%" }, right: { kk: "1/2", ru: "1/2" } },
          { left: { kk: "75%", ru: "75%" }, right: { kk: "3/4", ru: "3/4" } },
        ],
        partial: true,
      },
    },
    {
      id: "q-demo-09", type: "ORDERING", subjectId: math.id, grade: 6, topic: "procenty",
      difficulty: 2, points: 2,
      kk: "Өсу ретімен орналастырыңыз.", ru: "Расставьте в порядке возрастания.",
      config: {
        items: [
          { kk: "5%", ru: "5%" },
          { kk: "25%", ru: "25%" },
          { kk: "50%", ru: "50%" },
          { kk: "100%", ru: "100%" },
        ],
        partial: true,
      },
    },
    {
      id: "q-demo-10", type: "ESSAY", subjectId: math.id, grade: 6, topic: "procenty",
      objective: "6.1.2", difficulty: 3, points: 5,
      kk: "Дүкенде баға 20%-ға төмендеді, жаңа баға 640 теңге. Бастапқы бағаны табыңыз және шешіміңізді түсіндіріңіз.",
      ru: "Цена в магазине снизилась на 20%, новая цена 640 тенге. Найдите первоначальную цену и объясните решение.",
      config: { minWords: 15 },
    },
    {
      id: "q-demo-11", type: "SINGLE_CHOICE", subjectId: math.id, grade: 5, topic: "drobi",
      objective: "5.2.1", difficulty: 1, points: 1,
      kk: "Қай бөлшек 1/2-ден үлкен?", ru: "Какая дробь больше 1/2?",
      explKk: "3/4 = 0,75 > 0,5.", explRu: "3/4 = 0,75 > 0,5.",
      choices: [
        { kk: "3/4", ru: "3/4", correct: true },
        { kk: "1/3", ru: "1/3" },
        { kk: "2/5", ru: "2/5" },
        { kk: "1/4", ru: "1/4" },
      ],
    },
    {
      id: "q-demo-12", type: "NUMERIC", subjectId: math.id, grade: 5, topic: "drobi",
      difficulty: 1, points: 1,
      kk: "Есептеңіз: 3/4 + 1/4.", ru: "Вычислите: 3/4 + 1/4.",
      explKk: "3/4 + 1/4 = 4/4 = 1.", explRu: "3/4 + 1/4 = 4/4 = 1.",
      config: { answer: 1, tolerance: 0 },
    },
    {
      id: "q-demo-13", type: "TRUE_FALSE", subjectId: math.id, grade: 5, topic: "drobi",
      objective: "5.2.1", difficulty: 2, points: 1,
      kk: "2/3 бөлшегі 3/4-тен үлкен.", ru: "Дробь 2/3 больше, чем 3/4.",
      explKk: "2/3 ≈ 0,67 < 0,75 — тұжырым қате.", explRu: "2/3 ≈ 0,67 < 0,75 — утверждение неверно.",
      config: { answer: false },
    },
    {
      id: "q-demo-14", type: "SHORT_TEXT", subjectId: math.id, grade: 5, topic: "drobi",
      difficulty: 1, points: 1,
      kk: "1/2 бөлшегін ондық бөлшек түрінде жазыңыз.", ru: "Запишите дробь 1/2 в виде десятичной дроби.",
      config: { answers: { kk: ["0,5", "0.5"], ru: ["0,5", "0.5"] } },
    },
    {
      id: "q-demo-15", type: "SINGLE_CHOICE", subjectId: math.id, grade: 6, topic: "uravneniya",
      objective: "6.3.1", difficulty: 1, points: 1,
      kk: "x + 5 = 12 теңдеуінің шешімі:", ru: "Решение уравнения x + 5 = 12:",
      explKk: "x = 12 − 5 = 7.", explRu: "x = 12 − 5 = 7.",
      choices: [
        { kk: "7", ru: "7", correct: true },
        { kk: "17", ru: "17" },
        { kk: "5", ru: "5" },
        { kk: "-7", ru: "-7" },
      ],
    },
    {
      id: "q-demo-16", type: "NUMERIC", subjectId: math.id, grade: 6, topic: "uravneniya",
      objective: "6.3.1", difficulty: 2, points: 2,
      kk: "3x = 27 теңдеуін шешіңіз. x = ?", ru: "Решите уравнение 3x = 27. x = ?",
      explKk: "x = 27 : 3 = 9.", explRu: "x = 27 : 3 = 9.",
      config: { answer: 9, tolerance: 0 },
    },
    {
      id: "q-demo-17", type: "SINGLE_CHOICE", subjectId: kaz.id, grade: 5, topic: "sozdik-qor",
      difficulty: 1, points: 1,
      kk: "«Үлкен» сөзінің синонимін табыңыз.", ru: "Найдите синоним слова «үлкен» (большой).",
      explKk: "«Зор» — «үлкен» сөзінің синонимі.", explRu: "«Зор» — синоним слова «үлкен».",
      choices: [
        { kk: "зор", ru: "зор", correct: true },
        { kk: "кіші", ru: "кіші" },
        { kk: "жұқа", ru: "жұқа" },
        { kk: "тар", ru: "тар" },
      ],
    },
    {
      id: "q-demo-18", type: "MATCHING", subjectId: kaz.id, grade: 5, topic: "sozdik-qor",
      difficulty: 1, points: 3,
      kk: "Сөздер мен аудармаларын сәйкестендіріңіз.", ru: "Сопоставьте слова и их переводы.",
      config: {
        pairs: [
          { left: { kk: "кітап", ru: "кітап" }, right: { kk: "книга", ru: "книга" } },
          { left: { kk: "мұғалім", ru: "мұғалім" }, right: { kk: "учитель", ru: "учитель" } },
          { left: { kk: "білім", ru: "білім" }, right: { kk: "знание", ru: "знание" } },
        ],
        partial: true,
      },
    },
    {
      id: "q-demo-19", type: "MULTI_CHOICE", subjectId: kaz.id, grade: 6, topic: "morfologiya",
      difficulty: 2, points: 2,
      kk: "Зат есімдерді белгілеңіз.", ru: "Отметьте имена существительные.",
      explKk: "«Мектеп» пен «оқушы» — зат есімдер.", explRu: "«Мектеп» и «оқушы» — существительные.",
      config: { partial: "proportional" },
      choices: [
        { kk: "мектеп", ru: "мектеп", correct: true },
        { kk: "оқушы", ru: "оқушы", correct: true },
        { kk: "оқу (етістік)", ru: "оқу (глагол)" },
        { kk: "жақсы (сын есім)", ru: "жақсы (прилагательное)" },
      ],
    },
    {
      id: "q-demo-20", type: "FILE_UPLOAD", subjectId: kaz.id, grade: 6, topic: "morfologiya",
      difficulty: 3, points: 5,
      kk: "«Менің мектебім» тақырыбына шағын шығарма жазып, фотосын жүктеңіз.",
      ru: "Напишите небольшое сочинение на тему «Моя школа» и загрузите фото работы.",
      config: { maxSizeMb: 10 },
    },
  ];

  for (const q of Q) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        organizationId: orgId,
        subjectId: q.subjectId,
        gradeLevelId: grades[q.grade],
        topicId: topics[q.topic],
        objectiveId: q.objective ? objByCode[q.objective] : null,
        type: q.type,
        difficulty: q.difficulty,
        points: q.points,
        status: "PUBLISHED" as ContentStatus,
        config: (q.config ?? {}) as object,
        createdById: ctx.adminId,
        translations: {
          create: [
            { locale: "kk", prompt: q.kk, explanation: q.explKk ?? "" },
            { locale: "ru", prompt: q.ru, explanation: q.explRu ?? "" },
          ],
        },
        choices: q.choices
          ? { create: q.choices.map((c, i) => ({ sort: i, correct: !!c.correct, textKk: c.kk, textRu: c.ru })) }
          : undefined,
        tags: q.tags ? { create: q.tags.map((tag) => ({ tag })) } : undefined,
        versions: {
          create: { version: 1, snapshot: { seeded: true } as object, createdById: ctx.adminId },
        },
      },
    });
  }

  // ————— Тесты (3) —————
  async function ensureTest(params: {
    id: string; slug: string; subjectId: string; grade: number;
    mode: "STANDARD" | "DIAGNOSTIC" | "EXAM";
    titleKk: string; titleRu: string; descKk: string; descRu: string;
    instrKk: string; instrRu: string;
    timeLimitSec: number | null; attempts: number; passPct: number;
    sections: { titleKk: string; titleRu: string; questionIds: string[] }[];
    shuffleQuestions?: boolean;
  }) {
    const exists = await prisma.test.findUnique({ where: { id: params.id } });
    if (exists) return exists;
    return prisma.test.create({
      data: {
        id: params.id,
        organizationId: orgId,
        slug: params.slug,
        subjectId: params.subjectId,
        gradeLevelId: grades[params.grade],
        mode: params.mode,
        status: "PUBLISHED",
        attemptsAllowed: params.attempts,
        timeLimitSec: params.timeLimitSec,
        passPct: params.passPct,
        shuffleQuestions: params.shuffleQuestions ?? false,
        shuffleChoices: false,
        resultsPolicy: "IMMEDIATE",
        showCorrect: "AFTER_SUBMIT",
        showExplanations: true,
        publishedAt: new Date(),
        createdById: ctx.adminId,
        translations: {
          create: [
            { locale: "kk", title: params.titleKk, description: params.descKk, instructions: params.instrKk },
            { locale: "ru", title: params.titleRu, description: params.descRu, instructions: params.instrRu },
          ],
        },
        sections: {
          create: params.sections.map((s, si) => ({
            sort: si,
            titleKk: s.titleKk,
            titleRu: s.titleRu,
            questions: { create: s.questionIds.map((qid, qi) => ({ questionId: qid, sort: qi })) },
          })),
        },
      },
    });
  }

  await ensureTest({
    id: "test-demo-diag", slug: "diagnostika-matematika-6", subjectId: math.id, grade: 6,
    mode: "DIAGNOSTIC",
    titleKk: "Диагностикалық тест: математика, 6-сынып",
    titleRu: "Диагностический тест: математика, 6 класс",
    descKk: "Пайыздар, бөлшектер және теңдеулер бойынша білім деңгейін анықтайды.",
    descRu: "Определяет уровень знаний по процентам, дробям и уравнениям.",
    instrKk: "Тестте 10 сұрақ бар. Уақыт — 20 минут. Әр сұраққа мұқият жауап беріңіз.",
    instrRu: "В тесте 10 вопросов. Время — 20 минут. Отвечайте внимательно на каждый вопрос.",
    timeLimitSec: 20 * 60, attempts: 2, passPct: 50,
    sections: [
      { titleKk: "Пайыздар", titleRu: "Проценты", questionIds: ["q-demo-01", "q-demo-02", "q-demo-04", "q-demo-05", "q-demo-07"] },
      { titleKk: "Бөлшектер", titleRu: "Дроби", questionIds: ["q-demo-11", "q-demo-12", "q-demo-13"] },
      { titleKk: "Теңдеулер", titleRu: "Уравнения", questionIds: ["q-demo-15", "q-demo-16"] },
    ],
  });

  await ensureTest({
    id: "test-demo-procenty", slug: "procenty-bekitu", subjectId: math.id, grade: 6,
    mode: "STANDARD",
    titleKk: "Пайыздар: бекіту тесті",
    titleRu: "Проценты: закрепляющий тест",
    descKk: "Пайыздар тақырыбын толық қамтитын тест, соның ішінде ашық сұрақ.",
    descRu: "Тест по теме «Проценты», включая развёрнутый ответ.",
    instrKk: "Соңғы сұрақ — ашық жауап: шешіміңізді толық жазыңыз.",
    instrRu: "Последний вопрос — развёрнутый: запишите решение полностью.",
    timeLimitSec: 30 * 60, attempts: 2, passPct: 60,
    sections: [
      {
        titleKk: "Негізгі бөлім", titleRu: "Основная часть",
        questionIds: ["q-demo-01", "q-demo-02", "q-demo-03", "q-demo-04", "q-demo-05", "q-demo-06", "q-demo-07", "q-demo-08", "q-demo-09", "q-demo-10"],
      },
    ],
  });

  await ensureTest({
    id: "test-demo-kaz", slug: "kazak-tili-bastapqy", subjectId: kaz.id, grade: 5,
    mode: "STANDARD",
    titleKk: "Қазақ тілі: бастапқы деңгей",
    titleRu: "Казахский язык: начальный уровень",
    descKk: "Сөздік қор мен морфология бойынша қысқа тест.",
    descRu: "Короткий тест по словарному запасу и морфологии.",
    instrKk: "Соңғы тапсырмада жұмысыңыздың фотосын жүктейсіз.",
    instrRu: "В последнем задании нужно загрузить фото вашей работы.",
    timeLimitSec: 15 * 60, attempts: 3, passPct: 50,
    sections: [
      { titleKk: "Сөздік қор", titleRu: "Словарный запас", questionIds: ["q-demo-17", "q-demo-18"] },
      { titleKk: "Морфология", titleRu: "Морфология", questionIds: ["q-demo-19", "q-demo-20"] },
    ],
  });

  // ————— Челленджи (2) —————
  const now = Date.now();
  const day = 24 * 3600_000;

  const ch1 = await prisma.challenge.upsert({
    where: { id: "challenge-demo-free" },
    update: {},
    create: {
      id: "challenge-demo-free",
      organizationId: orgId,
      slug: "matematika-marafon",
      subjectId: math.id,
      gradeLevelId: grades[6],
      status: "PUBLISHED",
      accessType: "FREE",
      regStartAt: new Date(now - 3 * day),
      regEndAt: new Date(now + 10 * day),
      startAt: new Date(now - day),
      endAt: new Date(now + 14 * day),
      maxParticipants: 500,
      isPublic: true,
      passPct: 50,
      publishedAt: new Date(),
      createdById: ctx.adminId,
      translations: {
        create: [
          {
            locale: "kk",
            title: "Математикалық марафон",
            description: "Екі апталық марафон: диагностика және пайыздар бойынша жарыс. Үздіктер марапатталады!",
            prizes: "1-орын — планшет, 2–3-орын — құлаққап, топ-10 — грамота.",
          },
          {
            locale: "ru",
            title: "Математический марафон",
            description: "Двухнедельный марафон: диагностика и соревнование по процентам. Лучшие получают призы!",
            prizes: "1 место — планшет, 2–3 место — наушники, топ-10 — грамота.",
          },
        ],
      },
      activities: {
        create: [
          { testId: "test-demo-diag", sort: 0, pointsWeight: 1 },
          { testId: "test-demo-procenty", sort: 1, pointsWeight: 1.5 },
        ],
      },
    },
  });

  await prisma.challenge.upsert({
    where: { id: "challenge-demo-paid" },
    update: {},
    create: {
      id: "challenge-demo-paid",
      organizationId: orgId,
      slug: "olimp-daiyndyq",
      subjectId: math.id,
      gradeLevelId: grades[7],
      status: "PUBLISHED",
      accessType: "PAID",
      priceKzt: 2900,
      regStartAt: new Date(now),
      regEndAt: new Date(now + 6 * day),
      startAt: new Date(now + 7 * day),
      endAt: new Date(now + 21 * day),
      isPublic: true,
      passPct: 60,
      publishedAt: new Date(),
      createdById: ctx.adminId,
      translations: {
        create: [
          {
            locale: "kk",
            title: "Олимпиадаға дайындық интенсиві",
            description: "Күрделірек есептер мен жеке кері байланыс. Орын саны шектеулі.",
            prizes: "Финалисттер облыстық олимпиада іріктеуіне ұсынылады.",
          },
          {
            locale: "ru",
            title: "Интенсив подготовки к олимпиаде",
            description: "Более сложные задачи и персональная обратная связь. Количество мест ограничено.",
            prizes: "Финалисты рекомендуются на областной отбор олимпиады.",
          },
        ],
      },
      activities: { create: [{ testId: "test-demo-procenty", sort: 0, pointsWeight: 2 }] },
    },
  });

  // ————— Курсы (2 × 2 модуля × 3 урока) —————
  async function ensureCourse(params: {
    id: string; slug: string; subjectId: string; grade: number;
    accessType: "FREE" | "PAID"; priceKzt?: number;
    titleKk: string; titleRu: string; descKk: string; descRu: string;
    modules: { titleKk: string; titleRu: string; lessons: { titleKk: string; titleRu: string; mdKk: string; mdRu: string }[] }[];
  }) {
    const exists = await prisma.course.findUnique({ where: { id: params.id } });
    if (exists) return exists;
    return prisma.course.create({
      data: {
        id: params.id,
        organizationId: orgId,
        slug: params.slug,
        subjectId: params.subjectId,
        gradeLevelId: grades[params.grade],
        status: "PUBLISHED",
        accessType: params.accessType,
        priceKzt: params.priceKzt ?? null,
        sequential: true,
        selfEnroll: true,
        certificateEnabled: true,
        publishedAt: new Date(),
        createdById: ctx.adminId,
        translations: {
          create: [
            { locale: "kk", title: params.titleKk, description: params.descKk, seoTitle: params.titleKk, seoDescription: params.descKk },
            { locale: "ru", title: params.titleRu, description: params.descRu, seoTitle: params.titleRu, seoDescription: params.descRu },
          ],
        },
        teachers: { create: [{ userId: ctx.teacherId }] },
        modules: {
          create: params.modules.map((m, mi) => ({
            sort: mi,
            titleKk: m.titleKk,
            titleRu: m.titleRu,
            lessons: {
              create: m.lessons.map((l, li) => ({
                sort: li,
                status: "PUBLISHED",
                translations: {
                  create: [
                    { locale: "kk", title: l.titleKk, contentMd: l.mdKk },
                    { locale: "ru", title: l.titleRu, contentMd: l.mdRu },
                  ],
                },
              })),
            },
          })),
        },
      },
    });
  }

  const course1 = await ensureCourse({
    id: "course-demo-procenty", slug: "procenty-praktika", subjectId: math.id, grade: 6,
    accessType: "FREE",
    titleKk: "Пайыздар: нөлден практикаға",
    titleRu: "Проценты: с нуля до практики",
    descKk: "Пайыздарды күнделікті өмірде қолдануды үйренеміз: жеңілдіктер, өсім, салыстыру.",
    descRu: "Учимся применять проценты в жизни: скидки, рост, сравнение величин.",
    modules: [
      {
        titleKk: "1-модуль. Пайыз ұғымы", titleRu: "Модуль 1. Понятие процента",
        lessons: [
          {
            titleKk: "Пайыз дегеніміз не?", titleRu: "Что такое процент?",
            mdKk: "## Пайыз дегеніміз не?\n\n**Пайыз** — санның жүзден бір бөлігі.\n\n- 1% = 1/100 = 0,01\n- 50% = 1/2\n- 100% = бүтін сан\n\n**Мысал.** 200 теңгенің 1%-ы = 2 теңге.\n\nПайыздар жеңілдіктерде, банк өсімінде және статистикада қолданылады.",
            mdRu: "## Что такое процент?\n\n**Процент** — это сотая часть числа.\n\n- 1% = 1/100 = 0,01\n- 50% = 1/2\n- 100% = целое число\n\n**Пример.** 1% от 200 тенге = 2 тенге.\n\nПроценты используются в скидках, банковских ставках и статистике.",
          },
          {
            titleKk: "Санның пайызын табу", titleRu: "Нахождение процента от числа",
            mdKk: "## Санның пайызын табу\n\nЕреже: санды 100-ге бөліп, пайызға көбейтеміз.\n\n**Мысал.** 250-нің 10%-ы: 250 : 100 · 10 = 25.\n\nНемесе ондық бөлшекпен: 250 · 0,1 = 25.\n\n### Жаттығу\n1. 300-дің 20%-ы = ?\n2. 150-нің 40%-ы = ?",
            mdRu: "## Нахождение процента от числа\n\nПравило: делим число на 100 и умножаем на процент.\n\n**Пример.** 10% от 250: 250 : 100 · 10 = 25.\n\nИли через десятичную дробь: 250 · 0,1 = 25.\n\n### Практика\n1. 20% от 300 = ?\n2. 40% от 150 = ?",
          },
          {
            titleKk: "Пайызы бойынша санды табу", titleRu: "Нахождение числа по проценту",
            mdKk: "## Пайызы бойынша санды табу\n\nЕгер саннның p%-ы белгілі болса: бүтін сан = мән : p · 100.\n\n**Мысал.** 20%-ы 30-ға тең сан: 30 : 20 · 100 = 150.\n\nБұл — кері есеп: жеңілдіктен бастапқы бағаны табу дәл осылай шешіледі.",
            mdRu: "## Нахождение числа по его проценту\n\nЕсли известно p% числа: целое = значение : p · 100.\n\n**Пример.** Число, 20% которого равны 30: 30 : 20 · 100 = 150.\n\nЭто обратная задача: так находят первоначальную цену по скидке.",
          },
        ],
      },
      {
        titleKk: "2-модуль. Өмірдегі пайыздар", titleRu: "Модуль 2. Проценты в жизни",
        lessons: [
          {
            titleKk: "Жеңілдіктер мен бағалар", titleRu: "Скидки и цены",
            mdKk: "## Жеңілдіктер\n\nЖаңа баға = ескі баға · (1 − p/100).\n\n**Мысал.** 800 теңгеге 20% жеңілдік: 800 · 0,8 = 640 теңге.\n\nКері есеп: жаңа баға 640, жеңілдік 20% → бастапқы баға 640 : 0,8 = 800.",
            mdRu: "## Скидки\n\nНовая цена = старая цена · (1 − p/100).\n\n**Пример.** Скидка 20% на 800 тенге: 800 · 0,8 = 640 тенге.\n\nОбратная задача: новая цена 640 при скидке 20% → исходная цена 640 : 0,8 = 800.",
          },
          {
            titleKk: "Өсім және кему", titleRu: "Рост и снижение",
            mdKk: "## Өсім мен кему\n\nШаманың p%-ға өсуі: жаңа мән = ескі · (1 + p/100).\n\n**Мысал.** 5000 теңге депозит жылына 10%: бір жылдан кейін 5500 теңге.\n\nКему де дәл солай, тек минус таңбасымен.",
            mdRu: "## Рост и снижение\n\nРост величины на p%: новое значение = старое · (1 + p/100).\n\n**Пример.** Депозит 5000 тенге под 10% годовых: через год 5500 тенге.\n\nСнижение считается так же, только со знаком минус.",
          },
          {
            titleKk: "Қорытынды сабақ", titleRu: "Итоговый урок",
            mdKk: "## Қорытынды\n\nБіз үйрендік:\n\n1. Пайыз — жүзден бір бөлік\n2. Санның пайызын табу\n3. Пайызы бойынша санды табу\n4. Жеңілдік пен өсімді есептеу\n\nЕнді «Пайыздар: бекіту тесті» тапсырыңыз және тапсырманы орындаңыз!",
            mdRu: "## Итоги\n\nМы научились:\n\n1. Процент — сотая часть\n2. Находить процент от числа\n3. Находить число по проценту\n4. Считать скидки и рост\n\nТеперь пройдите «Проценты: закрепляющий тест» и выполните задание!",
          },
        ],
      },
    ],
  });

  await ensureCourse({
    id: "course-demo-kaz", slug: "kazak-tili-5-synyp", subjectId: kaz.id, grade: 5,
    accessType: "PAID", priceKzt: 4900,
    titleKk: "Қазақ тілі: 5-сынып негіздері",
    titleRu: "Казахский язык: основы для 5 класса",
    descKk: "Сөздік қорды байыту және грамматика негіздерін бекіту курсы.",
    descRu: "Курс обогащения словарного запаса и закрепления основ грамматики.",
    modules: [
      {
        titleKk: "1-модуль. Сөздік қор", titleRu: "Модуль 1. Словарный запас",
        lessons: [
          {
            titleKk: "Синонимдер", titleRu: "Синонимы",
            mdKk: "## Синонимдер\n\nМағынасы жақын сөздер **синонимдер** деп аталады.\n\nМысалдар: үлкен — зор — дәу; әдемі — сұлу — көркем.\n\nСинонимдер сөйлеуді байытады және қайталауды болдырмайды.",
            mdRu: "## Синонимы\n\nСлова с близким значением называются **синонимами**.\n\nПримеры: үлкен — зор — дәу (большой); әдемі — сұлу — көркем (красивый).\n\nСинонимы обогащают речь и помогают избегать повторов.",
          },
          {
            titleKk: "Антонимдер", titleRu: "Антонимы",
            mdKk: "## Антонимдер\n\nМағынасы қарама-қарсы сөздер: үлкен — кіші, ыстық — суық, жарық — қараңғы.\n\nАнтонимдер салыстыру мен қарама-қарсылықты көрсетуге қажет.",
            mdRu: "## Антонимы\n\nСлова с противоположным значением: үлкен — кіші (большой — маленький), ыстық — суық (горячий — холодный).\n\nАнтонимы нужны для сравнения и противопоставления.",
          },
          {
            titleKk: "Көп мағыналы сөздер", titleRu: "Многозначные слова",
            mdKk: "## Көп мағыналы сөздер\n\nКейбір сөздердің бірнеше мағынасы бар: «бас» — дененің мүшесі, басшы, бастау.\n\nМағына мәтінге қарай анықталады.",
            mdRu: "## Многозначные слова\n\nНекоторые слова имеют несколько значений: «бас» — голова, руководитель, начало.\n\nЗначение определяется по контексту.",
          },
        ],
      },
      {
        titleKk: "2-модуль. Морфология негіздері", titleRu: "Модуль 2. Основы морфологии",
        lessons: [
          {
            titleKk: "Зат есім", titleRu: "Имя существительное",
            mdKk: "## Зат есім\n\nЗат есім — заттың, құбылыстың атын білдіретін сөз табы. Кім? Не? сұрақтарына жауап береді.\n\nМысалдар: мектеп, оқушы, кітап, білім.",
            mdRu: "## Имя существительное (зат есім)\n\nЗат есім — часть речи, обозначающая предмет или явление. Отвечает на вопросы Кім? (кто?) Не? (что?).\n\nПримеры: мектеп, оқушы, кітап, білім.",
          },
          {
            titleKk: "Сын есім", titleRu: "Имя прилагательное",
            mdKk: "## Сын есім\n\nСын есім заттың сынын, сапасын білдіреді. Қандай? Қай? сұрақтарына жауап береді.\n\nМысалдар: жақсы, үлкен, көк, биік.",
            mdRu: "## Имя прилагательное (сын есім)\n\nСын есім обозначает признак предмета. Отвечает на вопросы Қандай? (какой?) Қай? (который?).\n\nПримеры: жақсы, үлкен, көк, биік.",
          },
          {
            titleKk: "Етістік", titleRu: "Глагол",
            mdKk: "## Етістік\n\nЕтістік — қимылды, іс-әрекетті білдіретін сөз табы. Не істеді? Не қылды? сұрақтарына жауап береді.\n\nМысалдар: оқу, жазу, жүгіру, ойлау.",
            mdRu: "## Глагол (етістік)\n\nЕтістік — часть речи, обозначающая действие. Отвечает на вопросы Не істеді? (что делал?).\n\nПримеры: оқу, жазу, жүгіру, ойлау.",
          },
        ],
      },
    ],
  });

  // Задание в курсе 1
  await prisma.assignment.upsert({
    where: { id: "assignment-demo-1" },
    update: {},
    create: {
      id: "assignment-demo-1",
      courseId: course1.id,
      titleKk: "Практикалық жұмыс: дүкендегі жеңілдіктер",
      titleRu: "Практическая работа: скидки в магазине",
      descriptionKk:
        "Кез келген дүкеннен 3 тауардың бағасын жазып алыңыз. Әрқайсысына 15% жеңілдік есептеп, шешімдеріңізді толық көрсетіңіз.",
      descriptionRu:
        "Запишите цены трёх товаров из любого магазина. Рассчитайте скидку 15% на каждый и полностью покажите решения.",
      dueAt: new Date(now + 7 * day),
      maxScore: 10,
      allowResubmit: true,
      status: "PUBLISHED",
    },
  });

  // Запись ученика + участие в челлендже
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: ctx.studentId, courseId: course1.id } },
    update: {},
    create: { userId: ctx.studentId, courseId: course1.id, source: "ADMIN", cohortId: cohort.id },
  });
  await prisma.challengeEnrollment.upsert({
    where: { challengeId_userId: { challengeId: ch1.id, userId: ctx.studentId } },
    update: {},
    create: { challengeId: ch1.id, userId: ctx.studentId },
  });

  // ————— Бейджи —————
  const badges = [
    { slug: "first-steps", icon: "🎯", nameKk: "Алғашқы қадам", nameRu: "Первые шаги", descKk: "Бірінші тест сәтті өтілді", descRu: "Первый успешно пройденный тест" },
    { slug: "points-100", icon: "⭐", nameKk: "100 ұпай", nameRu: "100 баллов", descKk: "100 ұпай жиналды", descRu: "Накоплено 100 баллов" },
    { slug: "points-500", icon: "🏆", nameKk: "500 ұпай", nameRu: "500 баллов", descKk: "500 ұпай жиналды", descRu: "Накоплено 500 баллов" },
    { slug: "streak-7", icon: "🔥", nameKk: "7 күн қатарынан", nameRu: "7 дней подряд", descKk: "Апта бойы үзіліссіз белсенділік", descRu: "Неделя активности без перерывов" },
  ];
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: b.slug } },
      update: {},
      create: { organizationId: orgId, ...b, rule: {} },
    });
  }

  // ————— Отзывы лендинга —————
  const reviews = [
    { authorName: "Айгерім, оқушы анасы", textKk: "Балам пайыздарды түсінбей жүрді, енді тесттерді өзі сұрап тапсырады. Ыңғайлы платформа!", textRu: "Ребёнок не понимал проценты, а теперь сам просит пройти тесты. Удобная платформа!", rating: 5, sort: 0 },
    { authorName: "Ерлан Серікұлы, мұғалім", textKk: "Тесттерді бір рет құрып, бірнеше сыныпқа қолданамын. Қолмен тексеру кезегі көп уақыт үнемдейді.", textRu: "Создаю тест один раз и использую в нескольких классах. Очередь ручной проверки экономит массу времени.", rating: 5, sort: 1 },
    { authorName: "Диана, 6-сынып", textKk: "Челлендж рейтингінде досымнан озып кеттім! Ұпай жинау қызық екен.", textRu: "Обогнала подругу в рейтинге челленджа! Собирать баллы оказалось увлекательно.", rating: 5, sort: 2 },
  ];
  for (const [i, r] of reviews.entries()) {
    const id = `review-demo-${i}`;
    await prisma.review.upsert({ where: { id }, update: {}, create: { id, ...r, published: true } });
  }

  console.log("✓ Демо: таксономия, 20 вопросов, 3 теста, 2 челленджа, 2 курса, задание, бейджи, отзывы");
}
