// Seed vocabulary for Sózdik — Kazakh↔Russian, themed decks.
// All translations verified. `hint` = transliteration / usage note.

export interface SeedCard {
  kk: string;
  ru: string;
  hint?: string;
}
export interface SeedDeck {
  id: string;
  emoji: string;
  title_kk: string;
  title_ru: string;
  desc_kk: string;
  desc_ru: string;
  cards: SeedCard[];
}

export const SEED_DECKS: SeedDeck[] = [
  {
    id: "daily",
    emoji: "🏠",
    title_kk: "Күнделікті",
    title_ru: "Повседневное",
    desc_kk: "Күнделікті өмірдің негізгі сөздері",
    desc_ru: "Базовые слова повседневной жизни",
    cards: [
      { kk: "үй", ru: "дом", hint: "úı" },
      { kk: "су", ru: "вода", hint: "sý" },
      { kk: "нан", ru: "хлеб", hint: "nan" },
      { kk: "жұмыс", ru: "работа", hint: "jumys" },
      { kk: "кітап", ru: "книга", hint: "kıtap" },
      { kk: "есік", ru: "дверь", hint: "esık" },
      { kk: "терезе", ru: "окно", hint: "tereze" },
      { kk: "орындық", ru: "стул", hint: "oryndyq" },
      { kk: "үстел", ru: "стол", hint: "ústel" },
      { kk: "киім", ru: "одежда", hint: "kıım" },
      { kk: "ақша", ru: "деньги", hint: "aqsha" },
      { kk: "уақыт", ru: "время", hint: "ýaqyt" },
    ],
  },
  {
    id: "food",
    emoji: "🍽️",
    title_kk: "Тағам",
    title_ru: "Еда",
    desc_kk: "Тамақ пен ас-су атаулары",
    desc_ru: "Продукты и еда",
    cards: [
      { kk: "ет", ru: "мясо", hint: "et" },
      { kk: "сүт", ru: "молоко", hint: "süt" },
      { kk: "май", ru: "масло", hint: "maı" },
      { kk: "алма", ru: "яблоко", hint: "alma" },
      { kk: "сорпа", ru: "суп", hint: "sorpa" },
      { kk: "жеміс", ru: "фрукт", hint: "jemıs" },
      { kk: "көкөніс", ru: "овощ", hint: "kókónıs" },
      { kk: "қант", ru: "сахар", hint: "qant" },
      { kk: "тұз", ru: "соль", hint: "tuz" },
      { kk: "шай", ru: "чай", hint: "shaı" },
      { kk: "балық", ru: "рыба", hint: "balyq" },
      { kk: "күріш", ru: "рис", hint: "kúrısh" },
    ],
  },
  {
    id: "travel",
    emoji: "✈️",
    title_kk: "Саяхат",
    title_ru: "Путешествия",
    desc_kk: "Жол жүру мен саяхат сөздері",
    desc_ru: "Слова о поездках и путешествиях",
    cards: [
      { kk: "жол", ru: "дорога", hint: "jol" },
      { kk: "пойыз", ru: "поезд", hint: "poıyz" },
      { kk: "ұшақ", ru: "самолёт", hint: "ushaq" },
      { kk: "көлік", ru: "транспорт", hint: "kólık" },
      { kk: "әуежай", ru: "аэропорт", hint: "áýejaı" },
      { kk: "қала", ru: "город", hint: "qala" },
      { kk: "ауыл", ru: "село", hint: "aýyl" },
      { kk: "билет", ru: "билет", hint: "bılet" },
      { kk: "қонақүй", ru: "гостиница", hint: "qonaqúı" },
      { kk: "теңіз", ru: "море", hint: "teńız" },
      { kk: "тау", ru: "гора", hint: "taý" },
      { kk: "дала", ru: "степь", hint: "dala" },
    ],
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    title_kk: "Отбасы",
    title_ru: "Семья",
    desc_kk: "Отбасы мүшелері",
    desc_ru: "Члены семьи",
    cards: [
      { kk: "ана", ru: "мать", hint: "ana" },
      { kk: "әке", ru: "отец", hint: "áke" },
      { kk: "бала", ru: "ребёнок", hint: "bala" },
      { kk: "ұл", ru: "сын", hint: "ul" },
      { kk: "қыз", ru: "дочь", hint: "qyz" },
      { kk: "аға", ru: "старший брат", hint: "aǵa" },
      { kk: "апа", ru: "старшая сестра", hint: "apa" },
      { kk: "іні", ru: "младший брат", hint: "ını" },
      { kk: "ата", ru: "дедушка", hint: "ata" },
      { kk: "әже", ru: "бабушка", hint: "áje" },
      { kk: "отбасы", ru: "семья", hint: "otbasy" },
      { kk: "дос", ru: "друг", hint: "dos" },
    ],
  },
  {
    id: "numbers",
    emoji: "🔢",
    title_kk: "Сандар мен уақыт",
    title_ru: "Числа и время",
    desc_kk: "Сандар, күндер, ай-жыл",
    desc_ru: "Числа, дни, месяцы и годы",
    cards: [
      { kk: "бір", ru: "один", hint: "bır" },
      { kk: "екі", ru: "два", hint: "ekı" },
      { kk: "үш", ru: "три", hint: "úsh" },
      { kk: "төрт", ru: "четыре", hint: "tórt" },
      { kk: "бес", ru: "пять", hint: "bes" },
      { kk: "он", ru: "десять", hint: "on" },
      { kk: "жүз", ru: "сто", hint: "júz" },
      { kk: "күн", ru: "день", hint: "kún" },
      { kk: "түн", ru: "ночь", hint: "tún" },
      { kk: "апта", ru: "неделя", hint: "apta" },
      { kk: "ай", ru: "месяц", hint: "aı" },
      { kk: "жыл", ru: "год", hint: "jyl" },
    ],
  },
];
