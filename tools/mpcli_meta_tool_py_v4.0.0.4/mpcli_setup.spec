# -*- mode: python -*-

block_cipher = None
py_list = []
for parent, dirnames, filenames in os.walk("."):
    for file in filenames:
        if os.path.splitext(file)[-1] == ".py":
            py_list.append(file)

a = Analysis(['__main__.py']+py_list,
             pathex=['.'],
             binaries=[('.\\fw','fw')],
             datas=[('.\\config','config')],
             hiddenimports=['pyserial'],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          name='mpcli',
          debug=False,
          strip=False,
          upx=True,
          runtime_tmpdir=None,
          console=True,
          version="mpcli_version.txt")
