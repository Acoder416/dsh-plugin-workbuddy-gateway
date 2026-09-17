"""Offline failover tests at the gateway's upstream connection entry point."""

import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'vendor' / 'workbuddy-gateway'))
import wb_accounts
import wb_proxy


def upstream_error(code):
    """An APISIX-style upstream response before a model stream is established."""
    return HTTPError('https://example.invalid/v2/chat/completions', code, 'Gateway failure', {},
                     io.BytesIO(f'<html><h1>{code} Gateway failure</h1>APISIX</html>'.encode()))


class UpstreamTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.pool = wb_accounts.AccountPool(directory.name)
        self.pool.accounts = [wb_accounts.Account({
            'uid': f'global-{index}', 'realm': 'intl', 'accessToken': f'fake-{index}',
        }) for index in range(3)]
        self.pool.accounts.append(wb_accounts.Account({
            'uid': 'china-only', 'realm': 'cn', 'accessToken': 'fake-cn',
        }))
        self.enter_patch(patch.object(wb_proxy, 'POOL', self.pool))
        self.enter_patch(patch.object(wb_proxy, 'log'))
        self.payload = {'model': 'gpt-5.5', 'messages': [{'role': 'user', 'content': 'Reply OK'}]}

    def enter_patch(self, patcher):
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def test_502_then_504_fail_over_to_third_global_account(self):
        self.pool.affinity.bind('conversation', 'global-0')
        success = io.BytesIO(b'data: [DONE]\n\n')
        with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(502), upstream_error(504), success]) as call:
            response, account = wb_proxy.open_upstream(self.payload, session_key='conversation', target_realm='intl')
        self.assertIs(response, success)
        self.assertEqual(account.uid, 'global-2')
        self.assertEqual(call.call_count, 3)
        self.assertEqual([args.args[0].get_header('Authorization') for args in call.call_args_list],
                         ['Bearer fake-0', 'Bearer fake-1', 'Bearer fake-2'])
        self.assertEqual(self.pool.affinity.get('conversation'), 'global-2')
        self.assertTrue(self.pool.accounts[0].ready())
        self.assertTrue(self.pool.accounts[1].ready())
        self.assertEqual(self.pool.accounts[3].last_error, '')

    def test_all_global_accounts_failing_returns_last_error_without_crossing_realms(self):
        last = upstream_error(504)
        with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(502), upstream_error(503), last]) as call:
            with self.assertRaises(HTTPError) as raised:
                wb_proxy.open_upstream(self.payload, session_key='conversation', target_realm='intl')
        self.assertIs(raised.exception, last)
        self.assertEqual(call.call_count, 3)
        self.assertIsNone(self.pool.affinity.get('conversation'))

    def test_retry_after_region_wide_5xx_can_still_use_the_accounts(self):
        with patch.object(wb_accounts.time, 'time', return_value=10000):
            with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(502), upstream_error(504), upstream_error(502)]):
                with self.assertRaises(HTTPError):
                    wb_proxy.open_upstream(self.payload, session_key='retry', target_realm='intl')
            with patch.object(wb_accounts.time, 'time', return_value=10002):
                success = io.BytesIO(b'data: [DONE]\n\n')
                with patch.object(wb_proxy.urllib.request, 'urlopen', return_value=success) as call:
                    response, account = wb_proxy.open_upstream(self.payload, session_key='retry', target_realm='intl')
                self.assertIs(response, success)
                self.assertEqual(account.realm, 'intl')
                self.assertEqual(call.call_count, 1)

    def test_single_account_attempt_is_bounded(self):
        self.pool.accounts = self.pool.accounts[:1]
        with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=upstream_error(504)) as call:
            with self.assertRaises(HTTPError):
                wb_proxy.open_upstream(self.payload, target_realm='intl')
        self.assertEqual(call.call_count, 1)

        # A server outage must not make the only account unavailable to the
        # caller's next retry.
        self.assertTrue(self.pool.accounts[0].ready())

    def test_auth_rate_limit_and_gateway_errors_use_another_account(self):
        for code in (401, 403, 429, 502, 503, 504):
            with self.subTest(code=code):
                for account in self.pool.accounts:
                    account.clear_error()
                self.pool._cursor = 0
                success = io.BytesIO(b'data: [DONE]\n\n')
                with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(code), success]) as call:
                    _, account = wb_proxy.open_upstream(self.payload, target_realm='intl')
                self.assertEqual(account.uid, 'global-1')
                self.assertEqual(call.call_count, 2)
                self.assertEqual(self.pool.accounts[0].ready(), code in (502, 503, 504))
                if code in (502, 503, 504):
                    self.assertEqual(self.pool.accounts[0].last_error, '')

    def test_invalid_request_does_not_rotate_accounts(self):
        with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=upstream_error(400)) as call:
            with self.assertRaises(HTTPError):
                wb_proxy.open_upstream(self.payload, target_realm='intl')
        self.assertEqual(call.call_count, 1)
        self.assertTrue(all(account.ready() for account in self.pool.accounts))

    def test_a_pool_wide_429_cools_briefly_instead_of_five_minutes(self):
        with patch.object(wb_accounts.time, 'time', return_value=10000):
            with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(429)] * 3) as call:
                with self.assertRaises(HTTPError):
                    wb_proxy.open_upstream(self.payload, target_realm='intl')
            self.assertEqual(call.call_count, 3)
            # The accounts share one egress, so every candidate answering 429 is a
            # pool-wide limit, not three account-level ones. Locking the pool out
            # for 300s would turn a limit that may clear in seconds into a
            # five-minute outage.
            self.assertFalse(any(account.ready() for account in self.pool.accounts[:3]))
            with patch.object(wb_accounts.time, 'time', return_value=10031):
                self.assertTrue(all(account.ready() for account in self.pool.accounts[:3]))
            # The unrelated realm is never touched.
            self.assertTrue(self.pool.accounts[3].ready())

    def test_partial_429_keeps_the_full_cooldown(self):
        # One account rate limited and another succeeding is an account-level
        # limit; the rejected account must still sit out the long cooldown.
        success = io.BytesIO(b'data: [DONE]\n\n')
        with patch.object(wb_accounts.time, 'time', return_value=10000):
            with patch.object(wb_proxy.urllib.request, 'urlopen', side_effect=[upstream_error(429), success]):
                wb_proxy.open_upstream(self.payload, target_realm='intl')
            with patch.object(wb_accounts.time, 'time', return_value=10031):
                self.assertFalse(self.pool.accounts[0].ready())
            with patch.object(wb_accounts.time, 'time', return_value=10301):
                self.assertTrue(self.pool.accounts[0].ready())

    def test_a_fully_cooled_pool_still_gets_one_attempt(self):
        for account in self.pool.accounts:
            account.note_error('HTTP 429', cooldown=300)
        success = io.BytesIO(b'data: [DONE]\n\n')
        with patch.object(wb_proxy.urllib.request, 'urlopen', return_value=success) as call:
            response, account = wb_proxy.open_upstream(self.payload, target_realm='intl')
        self.assertIs(response, success)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(account.realm, 'intl')
        # A successful attempt clears the cooling account it was granted to.
        self.assertTrue(account.ready())

    def test_successful_connection_does_not_read_or_replay_stream(self):
        response = io.BytesIO(b'data: hello\n\n')
        with patch.object(wb_proxy.urllib.request, 'urlopen', return_value=response) as call:
            upstream, account = wb_proxy.open_upstream(self.payload, target_realm='intl')
        self.assertEqual(call.call_count, 1)
        self.assertEqual(upstream.tell(), 0)
        self.assertEqual(account.uid, 'global-0')
