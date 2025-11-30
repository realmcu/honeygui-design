from building import *
import os

cwd = GetCurrentDir()
src = []
for root, dirs, files in os.walk(cwd):
    for f in files:
        if f.endswith('.c'):
            src.append(os.path.join(root, f))

CPPPATH = [cwd]
for root, dirs, files in os.walk(cwd):
    CPPPATH.append(root)

group = DefineGroup('autogen', src, depend=[''], CPPPATH=CPPPATH)
Return('group')
