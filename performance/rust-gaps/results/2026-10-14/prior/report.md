# Gap-phase native comparison

2026-10-14T01:11:10.401Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 process blocks, 168 observations. Input reset and digest included.

| Fixture | baseline µs/op | tuned µs/op |
|---|---:|---:|
| eligibility | 25.50 | 45.58 |
| pricing-0 | 43.39 | 71.33 |
| pricing-1024 | 49.66 | 74.50 |
| pricing-32768 | 61.70 | 78.94 |
| array-map-16 | 84.05 | 107.39 |
| array-map-256 | 874.77 | 1154.89 |
| array-map-4096 | 9719.64 | 11720.13 |

tuned: 0.72× [0.70, 0.74].
