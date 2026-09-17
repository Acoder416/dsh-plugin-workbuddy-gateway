"""Offline checks for local changes to the bundled account adapter."""

import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'vendor' / 'workbuddy-gateway'))
import wb_accounts as accounts


class AccountTests(unittest.TestCase):
    def test_http_already_claimed_is_persisted_and_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            account = accounts.Account({'uid': 'test', 'realm': 'cn', 'accessToken': 'fake'})
            account.save(directory)
            error = HTTPError('https://example.invalid', 400, 'Bad Request', {},
                              io.BytesIO(json.dumps({'code': 10001, 'msg': 'already claimed'}).encode()))
            with patch.object(accounts, 'http_json', side_effect=error):
                result = account.checkin()
            self.assertTrue(result['ok'])
            self.assertTrue(result['claimed'])
            restored = accounts.Account(json.loads(Path(account.path).read_text(encoding='utf-8')))
            self.assertTrue(restored.public()['checkinClaimed'])
            self.assertIsNotNone(restored.public()['lastCheckin'])

    def test_unrelated_http_error_does_not_mark_claimed(self):
        account = accounts.Account({'realm': 'cn', 'accessToken': 'fake'})
        error = HTTPError('https://example.invalid', 401, 'Unauthorized', {},
                          io.BytesIO(b'{"code":401,"msg":"token already expired"}'))
        with patch.object(accounts, 'http_json', side_effect=error):
            result = account.checkin()
        self.assertFalse(result['ok'])
        self.assertIsNone(account.checkin_claimed)
        self.assertIsNone(account.last_checkin)

    def test_success_and_rejected_checkins_have_distinct_state(self):
        for code, expected in [(0, True), (10001, True), (12345, False)]:
            with self.subTest(code=code):
                account = accounts.Account({'realm': 'cn', 'accessToken': 'fake'})
                with patch.object(accounts, 'http_json', return_value={'code': code}):
                    result = account.checkin()
                self.assertEqual(result['ok'], expected)
                self.assertEqual(account.checkin_claimed is True, expected)

    def test_import_reads_credits_after_cn_checkin(self):
        for realm in ('cn', 'intl'):
            with self.subTest(realm=realm), tempfile.TemporaryDirectory() as directory:
                credential = Path(directory) / 'desktop.info'
                credential.write_text(json.dumps({'auth': {'accessToken': 'fake'},
                                                 'account': {'uid': 'test'}}), encoding='utf-8')
                calls = []

                def checkin(account):
                    calls.append('checkin')
                    account.checkin_claimed = True
                    return {'ok': True}

                def credits(account):
                    calls.append('credits')
                    account.credits = {'remain': 100}
                    return {'ok': True}

                pool = accounts.AccountPool(str(Path(directory) / 'pool'))
                with patch.object(accounts.Account, 'checkin', checkin), patch.object(accounts.Account, 'fetch_credits', credits):
                    imported = pool.import_desktop_credential(str(credential), realm=realm)
                self.assertEqual(calls, ['checkin', 'credits'] if realm == 'cn' else ['credits'])
                self.assertEqual(imported.public()['credits']['remain'], 100)
                self.assertEqual(imported.public()['checkinClaimed'], True if realm == 'cn' else None)

    def test_credits_prefer_precise_values_and_round_to_cents(self):
        account = accounts.Account({'uid': 'test', 'realm': 'intl', 'accessToken': 'fake'})
        upstream = {'data': {'Response': {'Data': {'Accounts': [
            {'PackageName': 'Bonus Pack', 'CycleCapacitySize': 250, 'CycleCapacityRemain': 247,
             'CycleCapacitySizePrecise': '250.00', 'CycleCapacityRemainPrecise': '247.87',
             'CycleCapacityUsedPrecise': '2.13', 'Status': 0},
        ]}}}}
        with patch.object(accounts.Account, 'headers', return_value={}), \
                patch.object(accounts, 'http_json', return_value=upstream):
            credits = account.fetch_credits()['credits']
        # The truncated integer would report 247; the desktop app shows 247.87.
        self.assertEqual(credits['remain'], 247.87)
        self.assertEqual(credits['packages'][0]['remain'], 247.87)
        self.assertEqual(credits['size'], 250.0)

    def test_expired_packages_are_excluded_from_the_usable_balance(self):
        account = accounts.Account({'uid': 'test', 'realm': 'intl', 'accessToken': 'fake'})
        upstream = {'data': {'Response': {'Data': {'Accounts': [
            {'PackageName': 'Active', 'CycleCapacitySizePrecise': '100.00',
             'CycleCapacityRemainPrecise': '55.67', 'Status': 0},
            {'PackageName': 'Expired', 'CycleCapacitySizePrecise': '500.00',
             'CycleCapacityRemainPrecise': '500.00', 'Status': 3},
        ]}}}}
        with patch.object(accounts.Account, 'headers', return_value={}), \
                patch.object(accounts, 'http_json', return_value=upstream):
            credits = account.fetch_credits()['credits']
        # Counting the expired package in would report 555.67.
        self.assertEqual(credits['remain'], 55.67)
        self.assertEqual(credits['expired'], 500.0)
        self.assertFalse(credits['packages'][1]['active'])
        self.assertTrue(credits['packages'][0]['active'])

    def test_precise_number_falls_back_and_ignores_booleans(self):
        self.assertEqual(accounts._precise_number({'CapacityRemain': 247}, 'CapacityRemain'), 247.0)
        self.assertEqual(accounts._precise_number(
            {'CapacityRemainPrecise': '247.87', 'CapacityRemain': 247}, 'CapacityRemain'), 247.87)
        self.assertEqual(accounts._precise_number({'CapacityRemainPrecise': 'n/a'}, 'CapacityRemain'), 0.0)
        self.assertEqual(accounts._precise_number({}, 'CapacityRemain'), 0.0)

    def test_package_name_fallback_chain(self):
        self.assertEqual(accounts._package_name({'PackageName': 'Named'}), 'Named')
        self.assertEqual(accounts._package_name({'SubProductName': 'Sub'}), 'Sub')
        self.assertEqual(accounts._package_name({'PackageCode': 'p_tcaca'}), 'p_tcaca')
        self.assertEqual(accounts._package_name({'PackageName': '   '}), 'Package')
        self.assertEqual(accounts._package_name({}), 'Package')
        # Float noise from summing precise strings must not survive to the wire.
        self.assertEqual(accounts.round_credits(655.67000031), 655.67)
        self.assertEqual(accounts.round_credits(247), 247.0)

    def test_pick_shortest_cooldown_picks_the_account_closest_to_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            pool = accounts.AccountPool(directory)
            pool.accounts = [
                accounts.Account({'uid': 'far', 'realm': 'intl', 'accessToken': 't'}),
                accounts.Account({'uid': 'near', 'realm': 'intl', 'accessToken': 't'}),
                accounts.Account({'uid': 'other-realm', 'realm': 'cn', 'accessToken': 't'}),
                accounts.Account({'uid': 'no-token', 'realm': 'intl', 'accessToken': ''}),
                accounts.Account({'uid': 'disabled', 'realm': 'intl', 'accessToken': 't', 'enabled': False}),
            ]
            with patch.object(accounts.time, 'time', return_value=1000):
                pool.accounts[0].note_error('HTTP 429', cooldown=300)
                pool.accounts[1].note_error('HTTP 429', cooldown=60)
                pool.accounts[2].note_error('HTTP 429', cooldown=10)
                # Assertions stay inside the patch: the cooldown deadlines are
                # absolute timestamps, so they must be read at the same clock.
                self.assertIsNone(pool.pick(realm='intl'))
                self.assertEqual(pool.pick_shortest_cooldown(realm='intl').uid, 'near')
                # Only enabled accounts holding a token are candidates, the realm
                # filter still applies, and already-tried accounts stay excluded.
                self.assertEqual(pool.pick_shortest_cooldown(realm='cn').uid, 'other-realm')
                self.assertIsNone(pool.pick_shortest_cooldown(realm='intl', exclude={'near', 'far'}))

    def test_platform_directories(self):
        for platform, os_name, expected in [
            ('win32', 'nt', os.path.join('local-data', 'CodeBuddyExtension', 'Data', 'Public', 'auth')),
            ('darwin', 'posix', os.path.join('test-home', 'Library', 'Application Support', 'CodeBuddyExtension', 'Data', 'Public', 'auth')),
            ('linux', 'posix', os.path.join('xdg-config', 'CodeBuddyExtension', 'Data', 'Public', 'auth')),
        ]:
            with self.subTest(platform=platform), patch.dict(os.environ, {'LOCALAPPDATA': 'local-data', 'XDG_CONFIG_HOME': 'xdg-config'}, clear=True), patch.object(accounts.sys, 'platform', platform), patch.object(accounts.os, 'name', os_name), patch.object(accounts.os.path, 'expanduser', return_value='test-home'):
                self.assertEqual(accounts.desktop_auth_dir(), expected)

    def test_override_scans_only_recognized_credential_files(self):
        with tempfile.TemporaryDirectory() as directory:
            for name in ['workbuddy-desktop-ai.info', 'workbuddy-desktop.info', 'unrelated.info']:
                (Path(directory) / name).write_text('{}', encoding='utf-8')
            with patch.dict(os.environ, {'WORKBUDDY_DESKTOP_AUTH_DIR': directory}):
                found = accounts.desktop_credential_candidates()
            self.assertEqual(found, [(os.path.join(directory, 'workbuddy-desktop-ai.info'), 'intl'),
                                     (os.path.join(directory, 'workbuddy-desktop.info'), 'cn')])
