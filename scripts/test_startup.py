"""Regression tests for safe startup, using an isolated fake Docker CLI."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
DB_PASSWORD = 'test-db-password-with-$-and-spaces only'
ROOT_PASSWORD = 'test-root-password-only'

FAKE_DOCKER = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
state = pathlib.Path(os.environ['STARTUP_FIXTURE'])
mode = os.environ.get('STARTUP_SCENARIO', 'ready')
with (state / 'calls.jsonl').open('a') as log:
    log.write(json.dumps(args) + '\n')
if args[0] == 'info':
    sys.exit(1 if mode == 'daemon_off' else 0)
if args[0] == 'inspect':
    if '{{.State.Running}}' in args:
        print('true')
    else:
        print('/another/source' if mode == 'other_checkout' else os.environ['STARTUP_PROJECT'])
    sys.exit(0)
if args[0] == 'exec':
    password = sys.stdin.readline().rstrip('\n')
    user = args[-2]
    error = None
    if (mode == 'wrong_app_password' and user != 'root') or (mode == 'wrong_root_password' and user == 'root'):
        error = 'ERROR 1045 (28000): Access denied; private diagnostic: ' + password
    elif mode == 'wrong_database':
        error = 'ERROR 1049 (42000): Unknown database'
    elif mode == 'initializing':
        attempts = state / 'attempts'
        n = int(attempts.read_text()) if attempts.exists() else 0
        attempts.write_text(str(n + 1))
        if n < 2:
            error = 'ERROR 2003 (HY000): Connection refused'
    if error:
        print(error, file=sys.stderr)
        sys.exit(1)
    print('1')
    sys.exit(0)
assert args[0] == 'compose', args
command = next(x for x in args[1:] if x in ('config', 'ps', 'up'))
project = pathlib.Path(os.environ['STARTUP_PROJECT'])
if command == 'config':
    if not (project / '.env').exists():
        print('required variable MYSQL_PASSWORD is missing', file=sys.stderr)
        sys.exit(1)
    if '--environment' in args:
        print((project / '.env').read_text())
elif command == 'ps' and '-q' in args:
    if mode != 'initializing' or (state / 'started').exists():
        print('fixture-mysql-id')
elif command == 'up':
    (state / 'started').touch()
'''


class StartupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='material startup ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'project with spaces'
        (self.project / 'scripts').mkdir(parents=True)
        shutil.copy(ROOT / 'scripts/up.sh', self.project / 'scripts/up.sh')
        (self.project / 'compose.yaml').write_text('name: material-studio\nservices: {}\n')
        self.configure()
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        (self.bin / 'docker').write_text(FAKE_DOCKER)
        (self.bin / 'docker').chmod(0o755)
        (self.bin / 'sleep').write_text('#!/bin/sh\nexit 0\n')
        (self.bin / 'sleep').chmod(0o755)

    def configure(self, password=DB_PASSWORD):
        (self.project / '.env').write_text(
            'MYSQL_USER=material_app\nMYSQL_DATABASE=material_platform\n'
            f'MYSQL_PASSWORD={password}\nMYSQL_ROOT_PASSWORD={ROOT_PASSWORD}\n'
        )

    def run_startup(self, scenario='ready', options=()):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                   STARTUP_FIXTURE=str(self.root), STARTUP_SCENARIO=scenario,
                   STARTUP_PROJECT=str(self.project))
        result = subprocess.run(['bash', str(self.project / 'scripts/up.sh'), *options],
                                env=env, cwd=self.root, capture_output=True, text=True, timeout=15)
        self.output = result.stdout + result.stderr
        calls = self.root / 'calls.jsonl'
        self.calls = [json.loads(line) for line in calls.read_text().splitlines()] if calls.exists() else []
        # No path prints the rendered configuration or even an error's private payload.
        self.assertNotIn(DB_PASSWORD, self.output)
        self.assertNotIn(ROOT_PASSWORD, self.output)
        self.assertFalse(any('down' in call or 'rm' in call or '--volumes' in call for call in self.calls))
        return result.returncode

    def application_started(self):
        return any('up' in call and '--build' in call and '--wait' in call for call in self.calls)

    def test_missing_configuration_explains_setup_without_starting_containers(self):
        (self.project / '.env').unlink()
        self.assertNotEqual(self.run_startup(), 0)
        self.assertIn('.env.example', self.output)
        self.assertFalse(any('up' in call for call in self.calls))

    def test_placeholder_fails_before_starting_or_recreating_any_container(self):
        self.configure('CHANGE_ME_LOCAL_DB')
        self.assertNotEqual(self.run_startup(), 0)
        self.assertIn('示例值', self.output)
        self.assertFalse(any('up' in call for call in self.calls))

    def test_another_checkout_is_never_replaced(self):
        self.assertNotEqual(self.run_startup('other_checkout'), 0)
        self.assertIn('另一目录', self.output)
        self.assertIn('COMPOSE_PROJECT_NAME', self.output)
        self.assertFalse(any('up' in call for call in self.calls))

    def test_wrong_password_stops_before_application_and_preserves_volumes(self):
        for scenario, key in [('wrong_app_password', 'MYSQL_PASSWORD'), ('wrong_root_password', 'MYSQL_ROOT_PASSWORD')]:
            with self.subTest(scenario=scenario):
                self.assertNotEqual(self.run_startup(scenario), 0)
                self.assertIn(key, self.output)
                self.assertIn('修改 .env 不会重置', self.output)
                self.assertFalse(self.application_started())
                self.assertFalse(any('up' in call for call in self.calls))

    def test_database_mismatch_is_not_reported_as_slow_initialization(self):
        self.assertNotEqual(self.run_startup('wrong_database'), 0)
        self.assertIn('库名或用户权限', self.output)
        self.assertFalse(self.application_started())

    def test_fresh_initialization_retries_connection_then_starts_application(self):
        self.assertEqual(self.run_startup('initializing'), 0, self.output)
        self.assertGreaterEqual(int((self.root / 'attempts').read_text()), 3)
        self.assertTrue(self.application_started())

    def test_existing_ready_database_and_compose_options_are_preserved(self):
        self.assertEqual(self.run_startup(options=('-p', 'independent-copy')), 0, self.output)
        compose_calls = [call for call in self.calls if call[0] == 'compose']
        self.assertTrue(all('-p' in call and 'independent-copy' in call for call in compose_calls))
        self.assertTrue(self.application_started())
        self.assertEqual(sum(call[0] == 'exec' for call in self.calls), 2)

    def test_mysql_only_does_not_build_or_start_application(self):
        self.assertEqual(self.run_startup(options=('--mysql-only',)), 0, self.output)
        self.assertFalse(self.application_started())
        self.assertTrue(any('up' in call and '--wait' in call and call[-1] == 'mysql' for call in self.calls))

    def test_unavailable_docker_exits_with_clear_message(self):
        self.assertNotEqual(self.run_startup('daemon_off'), 0)
        self.assertIn('启动 Docker', self.output)
        self.assertFalse(any('up' in call for call in self.calls))


if __name__ == '__main__':
    unittest.main()
