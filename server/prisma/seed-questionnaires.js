export const questionnaires = [
  {
    code: 'ADHERENCE-8',
    titleId: 'Kuesioner Kepatuhan Minum Obat (Skala Kepatuhan)',
    titleEn: 'Medication Adherence Assessment Scale',
    descriptionId: 'Kuesioner untuk mengukur seberapa teratur dan konsisten Anda dalam mengonsumsi obat.',
    descriptionEn: 'Questionnaire designed to assess your routine adherence and consistency in taking medications.',
    active: true,
    questions: [
      {
        id: 'q1',
        textId: 'Apakah Anda terkadang lupa minum obat Anda?',
        textEn: 'Do you sometimes forget to take your medicine?',
        options: [
          { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 0 },
          { value: 'no', textId: 'Tidak', textEn: 'No', score: 1 },
        ],
      },
      {
        id: 'q2',
        textId: 'Dalam 2 minggu terakhir, apakah ada hari di mana Anda tidak minum obat?',
        textEn: 'Over the past 2 weeks, were there days you missed your medicine?',
        options: [
          { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 0 },
          { value: 'no', textId: 'Tidak', textEn: 'No', score: 1 },
        ],
      },
      {
        id: 'q3',
        textId: 'Ketika Anda bepergian atau keluar rumah, apakah Anda terkadang lupa membawa obat?',
        textEn: 'When traveling or leaving home, do you sometimes forget to bring medication?',
        options: [
          { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 0 },
          { value: 'no', textId: 'Tidak', textEn: 'No', score: 1 },
        ],
      },
      {
        id: 'q4',
        textId: 'Apakah Anda minum semua obat Anda kemarin?',
        textEn: 'Did you take all your medicine yesterday?',
        options: [
          { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 1 },
          { value: 'no', textId: 'Tidak', textEn: 'No', score: 0 },
        ],
      },
      {
        id: 'q5',
        textId: 'Ketika merasa gejala Anda membaik, apakah Anda terkadang berhenti minum obat?',
        textEn: 'When you feel your symptoms are under control, do you sometimes stop taking medicine?',
        options: [
          { value: 'yes', textId: 'Ya', textEn: 'Yes', score: 0 },
          { value: 'no', textId: 'Tidak', textEn: 'No', score: 1 },
        ],
      },
    ],
  },
  {
    code: 'KNOWLEDGE-PRE',
    titleId: 'Kuesioner Pengetahuan & Konsultasi Obat',
    titleEn: 'Medication Knowledge & Consultation Survey',
    descriptionId: 'Survei awal pemahaman aturan pakai obat dan pengalaman berkonsultasi dengan apoteker.',
    descriptionEn: 'Baseline assessment regarding medication literacy and pharmacist consultation experience.',
    active: true,
    questions: [
      {
        id: 'k1',
        textId: 'Seberapa yakin Anda memahami fungsi dan tujuan dari masing-masing obat Anda?',
        textEn: 'How confident are you in understanding the purpose of each medication you take?',
        options: [
          { value: 'very_confident', textId: 'Sangat paham', textEn: 'Very confident', score: 3 },
          { value: 'confident', textId: 'Cukup paham', textEn: 'Moderately confident', score: 2 },
          { value: 'not_confident', textId: 'Kurang paham / belum tahu', textEn: 'Not confident', score: 1 },
        ],
      },
      {
        id: 'k2',
        textId: 'Apakah Anda mengetahui efek samping umum yang mungkin timbul dari obat yang Anda konsumsi?',
        textEn: 'Do you know common side effects that may arise from your prescribed medicines?',
        options: [
          { value: 'yes', textId: 'Ya, mengetahui dengan baik', textEn: 'Yes, well informed', score: 2 },
          { value: 'partially', textId: 'Sebagian saja', textEn: 'Partially informed', score: 1 },
          { value: 'no', textId: 'Belum tahu sama sekali', textEn: 'Not informed at all', score: 0 },
        ],
      },
      {
        id: 'k3',
        textId: 'Apakah Anda merasa terbantu dengan adanya fitur konsultasi chat langsung dengan apoteker?',
        textEn: 'Do you find direct chat consultation with a pharmacist helpful for your treatment?',
        options: [
          { value: 'very_helpful', textId: 'Sangat membantu', textEn: 'Very helpful', score: 3 },
          { value: 'helpful', textId: 'Cukup membantu', textEn: 'Helpful', score: 2 },
          { value: 'neutral', textId: 'Biasa saja', textEn: 'Neutral', score: 1 },
        ],
      },
    ],
  },
];
