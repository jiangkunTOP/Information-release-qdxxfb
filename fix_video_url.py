import sys
sys.stdout.reconfigure(encoding='utf-8')

for fname, path in [
    ('preview', 'E:/AJavaProject/JuYouProject/information-release-qdxxfb/src/views/screen/preview.vue'),
    ('display', 'E:/AJavaProject/JuYouProject/information-release-qdxxfb/src/views/screen/display.vue'),
    ('dashboard', 'E:/AJavaProject/JuYouProject/information-release-qdxxfb/src/views/dashboard/index.vue'),
]:
    c = open(path, 'r', encoding='utf-8').read()
    
    # 1. resolveMediaUrl 恢复单参数
    old = 'function resolveMediaUrl(name, el) {'
    new = 'function resolveMediaUrl(name) {'
    c = c.replace(old, new)
    
    # 2. 去掉 el._directUrl 逻辑
    old2 = "  if (el && el._directUrl) return el._directUrl\n  if (name.startsWith('http://') ||"
    new2 = "  if (name.startsWith('http://') ||"
    c = c.replace(old2, new2)
    
    # 3. 去掉 resolveVideoUrls 函数
    if 'async function resolveVideoUrls' in c:
        # 从 resolveVideoUrls 开始到 // ==== 文件上传 ====
        import re
        c = re.sub(
            r'\n\nasync function resolveVideoUrls\([^}]+}\n\n// ==== 文件上传 ====',
            '\n\n// ==== 文件上传 ====',
            c,
            flags=re.DOTALL
        )
    
    # 4. 去掉 await resolveVideoUrls(elements.value)
    old4 = 'elements.value.forEach(el => { startCarouselForElement(el); fetchWeatherForElement(el) })\n      await resolveVideoUrls(elements.value)'
    new4 = 'elements.value.forEach(el => { startCarouselForElement(el); fetchWeatherForElement(el) })'
    c = c.replace(old4, new4)
    
    # 5. resolveMediaUrl(el.src, el) -> resolveMediaUrl(el.src)
    c = c.replace('resolveMediaUrl(el.src, el)', 'resolveMediaUrl(el.src)')
    
    open(path, 'w', encoding='utf-8').write(c)
    print(f'{fname}: cleaned')
