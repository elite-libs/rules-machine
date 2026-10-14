# Gap-phase native comparison

2026-10-14T01:09:10.883Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 process blocks, 336 observations. Input reset and digest included.

| Fixture | baseline µs/op | upgrade µs/op | tuned µs/op | rust µs/op |
|---|---:|---:|---:|---:|
| eligibility | 230.38 | 217.16 | 35.68 | 2.92 |
| pricing-0 | 450.86 | 428.75 | 45.59 | 5.17 |
| pricing-1024 | 456.02 | 456.82 | 46.14 | 6.02 |
| pricing-32768 | 542.45 | 529.14 | 54.02 | 6.83 |
| array-map-16 | 682.83 | 802.39 | 87.90 | 15.98 |
| array-map-256 | 10006.45 | 10618.04 | 732.55 | 219.15 |
| array-map-4096 | 139656.02 | 154577.64 | 8810.71 | 3288.05 |

upgrade: 1.00× [0.96, 1.03]; tuned: 10.18× [9.84, 10.57]; rust: 66.09× [62.45, 69.64]; rustOverTuned: 6.49× [6.23, 6.77].
