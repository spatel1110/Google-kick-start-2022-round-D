import numpy as np
def read_int():
    return list(map(int, input().split(" ")))

for test in range(int(input())):
    N, M = read_int()
    A = sorted(read_int())
    value = N - M + 1
    ans = sum(A[value:])
    ans += np.median(A[:value])
    print(f"Case #{test + 1}: {ans}")
