"""Rate-limit deadlines must be independent of the machine's local timezone."""

import datetime
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'vendor' / 'workbuddy-gateway'))
from wb_rate_limits import is_model_rate_limit, rate_limit_reset


class RateLimitTests(unittest.TestCase):
    def test_english_and_escaped_chinese_timestamps_with_actual_offsets(self):
        for phrase in ['your usage will reset at', '您的使用量已超出频率限制，将在']:
            for zone, offset in [('UTC+8', 480), ('UTC-3:30', -210), ('UTC+05:45', 345), ('UTC+0', 0)]:
                with self.subTest(phrase=phrase, zone=zone):
                    body = json.dumps({'code': 6004, 'msg': f'{phrase} 2026-09-17 16:51:16 {zone} 重置'})
                    expected = datetime.datetime(2026, 9, 17, 16, 51, 16,
                        tzinfo=datetime.timezone(datetime.timedelta(minutes=offset))).timestamp()
                    self.assertEqual(rate_limit_reset(body, now=1000), expected)

    def test_retry_after_and_configured_fallback(self):
        self.assertEqual(rate_limit_reset(b'<html>429</html>', {'Retry-After': '120'}, now=1000), 1120)
        future = 'Thu, 17 Sep 2026 08:00:00 GMT'
        self.assertEqual(rate_limit_reset(b'{}', {'retry-after': future}, now=1000), 1789632000)
        for body in ['no JSON', '{}', '[]', '{"msg":123}', '{"msg":"reset at 2026-99-99 12:00:00 UTC+8"}',
                     '{"msg":"reset at 2026-09-17 12:00:00 UTC+8:99"}']:
            with self.subTest(body=body):
                self.assertEqual(rate_limit_reset(body, {'Retry-After': 'bad'}, now=1000, fallback_seconds=42), 1042)
        self.assertEqual(rate_limit_reset('{"msg":"reset at 2026-09-17 12:00:00 UTC+8"}', now=2_000_000_000), 2_000_000_300)

    def test_business_code_and_http_status_are_both_recognized(self):
        self.assertTrue(is_model_rate_limit(429, b'not JSON'))
        self.assertTrue(is_model_rate_limit(400, b'{"code":6004}'))
        self.assertFalse(is_model_rate_limit(400, b'{"code":123,"msg":"invalid request"}'))
