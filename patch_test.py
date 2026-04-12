import re

with open('packages/server/src/services/__tests__/debate-simulator.test.ts', 'r') as f:
    content = f.read()

# Change the loop from 10 to 100
content = re.sub(r'for \(let i = 0; i < 10; i\+\+\) \{', r'for (let i = 0; i < 100; i++) {', content)

# Change the expectation from > 3 to > 35 (since 60 is expected, 35 is extremely safe for 100 iterations)
content = re.sub(r'expect\(approvedCount\)\.toBeGreaterThan\(3\);', r'expect(approvedCount).toBeGreaterThan(35);', content)

with open('packages/server/src/services/__tests__/debate-simulator.test.ts', 'w') as f:
    f.write(content)
