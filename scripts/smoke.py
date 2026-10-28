#!/usr/bin/env python3
"""Smoke-test the local Compose stack using isolated demo sessions, never real credentials."""
import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


def local_config():
    values = {}
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('\"\'')
    values.update(os.environ)
    return values


class Client:
    def __init__(self, base):
        self.base = base.rstrip('/')
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, method, path, data=None, headers=None):
        request = urllib.request.Request(self.base + path, data=data, headers=headers or {}, method=method)
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read()
            content_type = response.headers.get('Content-Type', '')
            return response.status, json.loads(body) if 'application/json' in content_type and body else body

    def mutate(self, path, body=None, key=None, control=None, multipart=None):
        status, csrf = self.request('GET', '/api/auth/csrf')
        assert status == 200, ('csrf', status)
        headers = {'X-CSRF-TOKEN': csrf['token'], 'Origin': self.base}
        if key:
            headers['Idempotency-Key'] = key
        if control:
            headers['X-Demo-Control-Key'] = control
        if multipart is not None:
            boundary = 'frame-smoke-boundary'
            headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary
            data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="demo.png"\r\nContent-Type: image/png\r\n\r\n').encode() + multipart + (f'\r\n--{boundary}--\r\n').encode()
        else:
            headers['Content-Type'] = 'application/json'
            data = None if body is None else json.dumps(body).encode()
        return self.request('POST', path, data, headers)

    def login(self, user):
        status, result = self.mutate('/api/auth/login', {'demoUserId': user})
        assert status == 200 and result['userId'] == user, ('login', status)
        return self

    def upload(self, data):
        status, result = self.mutate('/api/assets', multipart=data)
        assert status == 201, ('upload', status, result)
        return result['assetId']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:3001')
    parser.add_argument('--include-failure', action='store_true', help='requires enabled local override and DEMO_CONTROL_KEY')
    parser.add_argument('--output', type=Path, default=ROOT / '.local/smoke-evidence.json')
    args = parser.parse_args()
    config = local_config()
    control = config.get('DEMO_CONTROL_KEY') if args.include_failure else None
    if args.include_failure and not control:
        parser.error('Set DEMO_CONTROL_KEY in your private .env and enable DEMO_SIMULATION_OVERRIDE_ENABLED')
    a = Client(args.base_url).login('demo-a')
    b = Client(args.base_url).login('demo-b')
    image = (ROOT / 'backend/src/main/resources/demo-covers/avatar.png').read_bytes()
    one, two = a.upload(image), a.upload(image)
    status, templates = a.request('GET', '/api/templates')
    assert status == 200 and len(templates['items']) == 3
    status, rejected = a.mutate('/api/tasks', {'templateId': 'demo-postcard', 'assetIds': [one]}, str(uuid.uuid4()))
    assert status == 400 and rejected['code'] == 'INVALID_ASSET_COUNT'
    created = []
    latencies = []
    bodies = [dict(templateId='demo-postcard', assetIds=[one, two]), dict(templateId='demo-avatar', assetIds=[one]), dict(templateId='demo-avatar', assetIds=[two])]
    for index, body in enumerate(bodies):
        if control:
            body['simulation'] = {'failAtStep': 'GENERATE' if index == 1 else None, 'delaysMs': {'validate': 500, 'generate': 1200, 'finalize': 500}}
        key = str(uuid.uuid4())
        started = time.perf_counter()
        status, response = a.mutate('/api/tasks', body, key, control)
        latencies.append(round((time.perf_counter() - started) * 1000, 2))
        assert status == 202 and response['status'] in ('QUEUED', 'RUNNING'), ('async submission', status, response)
        created.append(response['taskId'])
        replay_status, replay = a.mutate('/api/tasks', body, key, control)
        assert replay_status == 202 and replay['taskId'] == response['taskId'] and replay['replayed']
    stages = {task_id: set() for task_id in created}
    final = {}
    deadline = time.monotonic() + 45
    while len(final) < len(created) and time.monotonic() < deadline:
        for task_id in created:
            if task_id in final:
                continue
            status, detail = a.request('GET', '/api/tasks/' + task_id)
            assert status == 200
            if detail['currentStep']:
                stages[task_id].add(detail['currentStep'])
            if detail['status'] in ('SUCCEEDED', 'FAILED'):
                final[task_id] = detail
        time.sleep(0.1)
    assert len(final) == 3, 'tasks did not finish'
    for index, task_id in enumerate(created):
        detail = final[task_id]
        if control and index == 1:
            assert detail['status'] == 'FAILED' and detail['currentStep'] == 'GENERATE'
            assert [step['status'] for step in detail['steps']] == ['SUCCEEDED', 'FAILED', 'SKIPPED']
        else:
            assert detail['status'] == 'SUCCEEDED'
            status, result = a.request('GET', detail['resultUrl'])
            assert status == 200 and result == image
        for suffix in ('', '/result'):
            assert b.request('GET', '/api/tasks/' + task_id + suffix)[0] == 404
        again = a.request('GET', '/api/tasks/' + task_id)[1]
        assert again['version'] == detail['version'] and again['updatedAt'] == detail['updatedAt']
    assert b.request('GET', '/api/assets/' + one + '/content')[0] == 404
    refreshed = Client(args.base_url).login('demo-a')
    history = refreshed.request('GET', '/api/tasks?limit=100')[1]
    assert set(created) <= {item['taskId'] for item in history['items']}
    report = {'baseUrl': args.base_url, 'taskIds': created, 'submissionMs': latencies, 'statuses': {key: value['status'] for key, value in final.items()}, 'observedStages': {key: sorted(value) for key, value in stages.items()}, 'checks': ['Java template API', 'upload validation and persistence', 'async acceptance', 'idempotent retry', 'multiple tasks', 'read-only query', 'user isolation', 'fresh-session history', 'readable simulated results'], 'specifiedFailure': 'passed' if control else 'not_requested'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
