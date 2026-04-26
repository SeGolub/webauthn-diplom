import re

with open('/home/duklet/Diplom/frontend/js/api.js', 'r') as f:
    code = f.read()

# Fix the bug
code = code.replace("body: JSON.stringify({ image_base64: imageBase64 }, true)", "body: JSON.stringify({ image_base64: imageBase64 })\n    }, true)")
code = code.replace("body: JSON.stringify({ is_locked: isLocked }, true)", "body: JSON.stringify({ is_locked: isLocked })\n    }, true)")

with open('/home/duklet/Diplom/frontend/js/api.js', 'w') as f:
    f.write(code)
print("done")
