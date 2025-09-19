const fs = require('fs');
const path = require('path');

const overrideDir = (process.env.DUSSCORD_DATA_DIR || '').trim();
const primaryDir = overrideDir ? path.resolve(overrideDir) : path.join(__dirname, '..', '..', 'data');
const legacyDirs = [
  path.join(__dirname, '..', '..', 'data'),
  path.join(__dirname, '..', 'data'),
].filter(dir => dir !== primaryDir);

function getDataDir() {
  return primaryDir;
}

function resolveDataPath(...segments) {
  return path.join(primaryDir, ...segments);
}

function listCandidatePaths(fileName) {
  return [resolveDataPath(fileName), ...legacyDirs.map(dir => path.join(dir, fileName))];
}

function ensureDirSync(dirPath = primaryDir) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    if (err && err.code !== 'EEXIST') throw err;
  }
}

async function ensureDir(dirPath = primaryDir) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (!err || err.code !== 'EEXIST') throw err;
  }
}

function ensureFileSync(fileName, defaultContent) {
  const target = resolveDataPath(fileName);
  ensureDirSync(path.dirname(target));
  if (!fs.existsSync(target)) {
    for (const candidate of listCandidatePaths(fileName).slice(1)) {
      if (fs.existsSync(candidate)) {
        try {
          fs.copyFileSync(candidate, target);
          return target;
        } catch (err) {
          console.error(`Failed to migrate data file ${fileName}:`, err);
        }
      }
    }
    if (typeof defaultContent !== 'undefined') {
      if (typeof defaultContent === 'string' || Buffer.isBuffer(defaultContent)) {
        fs.writeFileSync(target, defaultContent, typeof defaultContent === 'string' ? 'utf8' : undefined);
      } else {
        fs.writeFileSync(target, JSON.stringify(defaultContent, null, 2), 'utf8');
      }
    }
  }
  return target;
}

async function ensureFile(fileName, defaultContent) {
  const target = resolveDataPath(fileName);
  await ensureDir(path.dirname(target));
  const exists = await fs.promises.access(target).then(() => true).catch(() => false);
  if (!exists) {
    for (const candidate of listCandidatePaths(fileName).slice(1)) {
      // eslint-disable-next-line no-await-in-loop
      const legacyExists = await fs.promises.access(candidate).then(() => true).catch(() => false);
      if (legacyExists) {
        try {
          await fs.promises.copyFile(candidate, target);
          return target;
        } catch (err) {
          console.error(`Failed to migrate data file ${fileName}:`, err);
        }
      }
    }
    if (typeof defaultContent !== 'undefined') {
      if (typeof defaultContent === 'string' || Buffer.isBuffer(defaultContent)) {
        await fs.promises.writeFile(target, defaultContent, typeof defaultContent === 'string' ? 'utf8' : undefined);
      } else {
        await fs.promises.writeFile(target, JSON.stringify(defaultContent, null, 2), 'utf8');
      }
    }
  }
  return target;
}

function readJsonSync(fileName, defaultValue) {
  for (const candidate of listCandidatePaths(fileName)) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, 'utf8');
      if (!raw) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      console.error(`Failed to read JSON ${fileName}:`, err);
      break;
    }
  }
  return defaultValue;
}

async function readJson(fileName, defaultValue) {
  for (const candidate of listCandidatePaths(fileName)) {
    try {
      const raw = await fs.promises.readFile(candidate, 'utf8');
      if (!raw) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      console.error(`Failed to read JSON ${fileName}:`, err);
      break;
    }
  }
  return defaultValue;
}

async function writeJson(fileName, data) {
  const target = resolveDataPath(fileName);
  await ensureDir(path.dirname(target));
  const safe = data ?? null;
  await fs.promises.writeFile(target, JSON.stringify(safe, null, 2), 'utf8');
  return target;
}

function writeJsonSync(fileName, data) {
  const target = resolveDataPath(fileName);
  ensureDirSync(path.dirname(target));
  const safe = data ?? null;
  fs.writeFileSync(target, JSON.stringify(safe, null, 2), 'utf8');
  return target;
}

module.exports = {
  getDataDir,
  resolveDataPath,
  ensureDir,
  ensureDirSync,
  ensureFile,
  ensureFileSync,
  readJson,
  readJsonSync,
  writeJson,
  writeJsonSync,
};
