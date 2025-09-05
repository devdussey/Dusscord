// Bootstrap runner for Apollo/Pterodactyl: optional slash-command deploy, then start the bot
// Configure via env:
// - DEPLOY_CMDS_ON_START=true to run deploy-commands.js at startup
// - EXIT_ON_DEPLOY_FAIL=true to stop on deploy errors

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...options });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
    p.on('error', reject);
  });
}

(async () => {
  // Optional Git pull on start
  const gitPullOnStart = String(process.env.GIT_PULL_ON_START || '').toLowerCase() === 'true';
  const gitResetHard = String(process.env.GIT_RESET_HARD || '').toLowerCase() === 'true';
  const gitBranch = process.env.GIT_BRANCH;
  const cwd = process.cwd();
  const hasGit = fs.existsSync(path.join(cwd, '.git'));

  if (gitPullOnStart && hasGit) {
    console.log('[runner] GIT_PULL_ON_START=true → updating repository');
    try {
      if (gitResetHard) {
        console.log('[runner] git reset --hard');
        await run('git', ['reset', '--hard']);
      }
      console.log('[runner] git fetch --all --prune');
      await run('git', ['fetch', '--all', '--prune']);
      if (gitBranch) {
        console.log(`[runner] git checkout ${gitBranch}`);
        try { await run('git', ['checkout', gitBranch]); } catch (err) { console.error('src/runner.js', err); }
      }
      console.log('[runner] git pull --ff-only');
      await run('git', ['pull', '--ff-only']);
      console.log('[runner] repository updated');
    } catch (err) {
      console.error('[runner] git update failed:', err?.message || err);
    }
  }

  // Optional clean install on start
  const npmCiOnStart = String(process.env.NPM_CI_ON_START || '').toLowerCase() === 'true';
  if (npmCiOnStart && fs.existsSync(path.join(cwd, 'package.json'))) {
    console.log('[runner] NPM_CI_ON_START=true → npm ci --omit=dev');
    try {
      await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev']);
    } catch (err) {
      console.error('[runner] npm ci failed:', err?.message || err);
    }
  }

  const deployOnStart = String(process.env.DEPLOY_CMDS_ON_START || '').toLowerCase() === 'true';
  const exitOnFail = String(process.env.EXIT_ON_DEPLOY_FAIL || '').toLowerCase() === 'true';

  if (deployOnStart) {
    console.log('[runner] DEPLOY_CMDS_ON_START=true → running deploy-commands.js');
    try {
      await run(process.execPath, ['deploy-commands.js']);
      console.log('[runner] deploy-commands.js finished successfully');
    } catch (err) {
      console.error('[runner] deploy-commands.js failed:', err?.message || err);
      if (exitOnFail) process.exit(1);
    }
  }

  console.log('[runner] starting bot: src/index.js');
  require('./index');
})();
