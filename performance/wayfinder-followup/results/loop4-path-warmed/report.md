# Gap-phase native comparison

2026-10-14T23:22:24.196Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 6 process blocks, 84 observations. Input reset and digest included.

| Fixture | baseline µs/op | tuned µs/op |
|---|---:|---:|
| eligibility | 97.01 | 123.91 |
| pricing-0 | 155.50 | 162.39 |
| pricing-1024 | 212.02 | 207.98 |
| pricing-32768 | 175.91 | 154.91 |
| array-map-16 | 183.20 | 199.83 |
| array-map-256 | 1678.86 | 1811.60 |
| array-map-4096 | 30873.97 | 26800.60 |

tuned: 1.09× [0.99, 1.18].
