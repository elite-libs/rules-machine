# Gap-phase native comparison

2026-10-14T23:14:28.933Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 6 process blocks, 84 observations. Input reset and digest included.

| Fixture | baseline µs/op | tuned µs/op |
|---|---:|---:|
| eligibility | 86.98 | 49.77 |
| pricing-0 | 60.27 | 72.63 |
| pricing-1024 | 75.07 | 69.98 |
| pricing-32768 | 93.20 | 90.61 |
| array-map-16 | 100.31 | 85.84 |
| array-map-256 | 979.35 | 1089.63 |
| array-map-4096 | 12496.91 | 11150.71 |

tuned: 1.07× [1.02, 1.11].
