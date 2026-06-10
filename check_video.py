import sys, re
sys.stdout.reconfigure(encoding='utf-8')
c = open('E:/AJavaProject/JuYouProject/information-release-qdxxfb/src/views/screen/editor.vue', 'r', encoding='utf-8').read()

# 找 resolveVideoUrls 调用
for m in re.finditer('resolveVideoUrls', c):
    print(f'at {m.start()}: {c[m.start()-30:m.end()+30]}')
