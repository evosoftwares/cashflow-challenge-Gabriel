import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    read_overload: {
      executor: 'constant-arrival-rate',
      rate: 300,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 40,
      maxVUs: 120,
    },
  },
};

export default function () {
  const res = http.get(
    'http://localhost:8000/daily-balances/2026-05-20?merchant_id=8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11',
    {
      headers: {
        'X-API-Key': 'local-dev-key',
      },
    }
  );

  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
}

