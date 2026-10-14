# Gap-phase native comparison

2026-10-14T23:10:09.563Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 6 process blocks, 84 observations. Input reset and digest included.

| Fixture | baseline µs/op | tuned µs/op |
|---|---:|---:|
| eligibility | 38.65 | 33.96 |
| pricing-0 | 75.84 | 59.90 |
| pricing-1024 | 66.23 | 68.95 |
| pricing-32768 | 73.98 | 73.22 |
| array-map-16 | 125.14 | 101.07 |
| array-map-256 | 993.69 | 943.97 |
| array-map-4096 | 11861.36 | 10577.71 |

tuned: 1.06× [0.94, 1.21].
