// SPDX-FileCopyrightText: 2026 Digg - Agency for Digital Government
//
// SPDX-License-Identifier: EUPL-1.2

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('the installed npm tarball starts outside the source checkout', { timeout: 180_000 }, () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'raplp-package-'));
  const npm = (args, cwd) => execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      npm_config_offline: 'true',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_userconfig: path.join(temporary, 'user.npmrc'),
      npm_config_globalconfig: path.join(temporary, 'global.npmrc'),
    },
  });

  try {
    writeFileSync(path.join(temporary, 'user.npmrc'), '');
    writeFileSync(path.join(temporary, 'global.npmrc'), '');
    // Build explicitly: ignoring pack/install scripts must not hide a missing build.
    npm(['run', 'build'], root);
    const [packed] = JSON.parse(npm([
      'pack', '--ignore-scripts', '--json', '--pack-destination', temporary,
    ], root));
    assert.ok(packed.files.some(({ path: name }) => name === 'dist/routes/validate.js'));

    writeFileSync(path.join(temporary, 'package.json'), '{"private":true}');
    npm(['install', '--ignore-scripts', '--no-package-lock', path.join(temporary, packed.filename)], temporary);
    const installed = path.join(temporary, 'node_modules', '@diggsweden', 'rest-api-profil-lint-processor');
    const { version } = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8'));
    const cli = path.join(temporary, 'node_modules', '.bin', 'raplp');
    for (const [flag, expected] of [['--version', version], ['--help', '--file']]) {
      const output = execFileSync(process.execPath, [cli, flag], {
        cwd: temporary,
        encoding: 'utf8',
        timeout: 30_000,
      });
      assert.ok(output.includes(expected), `${flag}: ${output}`);
    }
    assert.ok(packed.files.some(({ path: name }) => name === 'rap-lp-openapi.yaml'));
    assert.deepEqual(
      readFileSync(path.join(installed, 'rap-lp-openapi.yaml')),
      readFileSync(path.join(root, 'rap-lp-openapi.yaml')),
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
