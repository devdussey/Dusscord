const fs = require('fs');
const path = require('path');
const { resolveDataPath } = require('./dataDir');

const TRIVIA_DIR = 'trivia';
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

let cachedCategories = null;

function getCandidateDirectories() {
  const dirs = [];
  const fallback = path.join(__dirname, '..', 'data', TRIVIA_DIR);
  const primary = resolveDataPath(TRIVIA_DIR);
  if (fallback && !dirs.includes(fallback)) dirs.push(fallback);
  if (primary && !dirs.includes(primary)) dirs.push(primary);
  return dirs;
}

function normaliseDifficultyKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (key.startsWith('easy')) return 'easy';
  if (key.startsWith('med')) return 'medium';
  if (key.startsWith('hard')) return 'hard';
  return key;
}

function normaliseChoiceKey(key) {
  if (!key && key !== 0) return null;
  const letter = String(key).trim().charAt(0).toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(letter) ? letter : null;
}

function normaliseQuestion(rawQuestion, difficulty, index) {
  if (!rawQuestion || typeof rawQuestion !== 'object') return null;

  const prompt = String(rawQuestion.prompt || rawQuestion.question || '').trim();
  if (!prompt) return null;

  const choices = {};
  if (rawQuestion.choices && typeof rawQuestion.choices === 'object') {
    for (const [key, value] of Object.entries(rawQuestion.choices)) {
      const letter = normaliseChoiceKey(key);
      if (!letter) continue;
      const text = value == null ? '' : String(value).trim();
      if (!text) continue;
      choices[letter] = text;
    }
  } else if (Array.isArray(rawQuestion.options)) {
    rawQuestion.options.forEach((option, optIndex) => {
      const letter = ['A', 'B', 'C', 'D'][optIndex];
      if (!letter) return;
      const text = option == null ? '' : String(option).trim();
      if (!text) return;
      choices[letter] = text;
    });
  }

  const orderedChoices = {};
  for (const letter of ['A', 'B', 'C', 'D']) {
    if (choices[letter]) {
      orderedChoices[letter] = choices[letter];
    }
  }

  if (Object.keys(orderedChoices).length < 2) return null;

  const answerKey = normaliseChoiceKey(rawQuestion.answer ?? rawQuestion.correct);
  if (!answerKey || !orderedChoices[answerKey]) return null;

  const explanation = typeof rawQuestion.explanation === 'string'
    ? rawQuestion.explanation.trim()
    : null;

  return {
    id: rawQuestion.id ? String(rawQuestion.id).trim() : `${difficulty}-${index + 1}`,
    prompt,
    choices: orderedChoices,
    answer: answerKey,
    explanation: explanation || null,
  };
}

function normaliseCategory(rawCategory, fileName) {
  if (!rawCategory || typeof rawCategory !== 'object') return null;

  const id = String(rawCategory.id || path.basename(fileName, path.extname(fileName)) || '').trim();
  if (!id) return null;

  const name = String(rawCategory.name || id).trim();
  const description = typeof rawCategory.description === 'string'
    ? rawCategory.description.trim()
    : '';

  const difficultiesRaw = rawCategory.difficulties && typeof rawCategory.difficulties === 'object'
    ? rawCategory.difficulties
    : {};

  const difficulties = {};
  for (const [key, value] of Object.entries(difficultiesRaw)) {
    const diffKey = normaliseDifficultyKey(key);
    if (!diffKey) continue;
    const list = Array.isArray(value) ? value : [];
    const normalised = list
      .map((question, index) => normaliseQuestion(question, diffKey, index))
      .filter(Boolean);
    if (normalised.length) {
      difficulties[diffKey] = normalised;
    }
  }

  const totalQuestions = Object.values(difficulties).reduce((sum, arr) => sum + arr.length, 0);
  if (totalQuestions <= 0) return null;

  return {
    id,
    name,
    description,
    difficulties,
    totalQuestions,
  };
}

function loadCategories() {
  if (cachedCategories) return cachedCategories;

  const categories = new Map();
  const dirs = getCandidateDirectories();

  for (const dir of dirs) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const category = normaliseCategory(parsed, entry.name);
        if (!category) continue;
        categories.set(category.id, category);
      } catch (err) {
        console.error(`Failed to load trivia category from ${filePath}:`, err);
      }
    }
  }

  cachedCategories = categories;
  return categories;
}

function resetTriviaCache() {
  cachedCategories = null;
}

function listCategories() {
  const categories = loadCategories();
  return Array.from(categories.values())
    .map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      totalQuestions: category.totalQuestions,
      difficulties: DIFFICULTY_ORDER
        .map(key => ({ key, questions: category.difficulties[key] ? category.difficulties[key].length : 0 }))
        .filter(entry => entry.questions > 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function cloneQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    choices: { ...question.choices },
    answer: question.answer,
    explanation: question.explanation,
  };
}

function cloneCategory(category) {
  const cloned = {
    id: category.id,
    name: category.name,
    description: category.description,
    totalQuestions: category.totalQuestions,
    difficulties: {},
  };
  for (const [key, questions] of Object.entries(category.difficulties)) {
    cloned.difficulties[key] = questions.map(cloneQuestion);
  }
  return cloned;
}

function getCategory(categoryId) {
  if (!categoryId) return null;
  const categories = loadCategories();
  const category = categories.get(String(categoryId));
  if (!category) return null;
  return cloneCategory(category);
}

function getQuestionPool(categoryId, difficulty) {
  const diffKey = normaliseDifficultyKey(difficulty);
  if (!diffKey) return [];
  const category = getCategory(categoryId);
  if (!category) return [];
  const pool = category.difficulties[diffKey];
  return Array.isArray(pool) ? pool.slice() : [];
}

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomQuestions(categoryId, difficulty, amount) {
  const pool = getQuestionPool(categoryId, difficulty);
  if (!pool.length) return [];
  const limit = Number.isInteger(amount) ? Math.max(1, amount) : pool.length;
  const shuffled = shuffle(pool);
  return shuffled.slice(0, Math.min(limit, pool.length));
}

function formatDifficultyName(difficulty) {
  const key = normaliseDifficultyKey(difficulty);
  if (!key) return 'Unknown';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

module.exports = {
  listCategories,
  getCategory,
  getQuestionPool,
  getRandomQuestions,
  normaliseDifficultyKey,
  formatDifficultyName,
  resetTriviaCache,
};
