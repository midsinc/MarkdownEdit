const path = require('path')
const { rcedit } = require('rcedit')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exePath = path.join(context.appOutDir, 'MarkdownEdit.exe')
  const iconPath = path.resolve(__dirname, '..', 'build', 'icon.ico')

  console.log('  afterPack: patching exe resources...')
  console.log('    exe:', exePath)
  console.log('    icon:', iconPath)

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: 'MarkdownEdit',
      FileDescription: 'MarkdownEdit - Markdown Editor',
      CompanyName: '',
      LegalCopyright: 'Copyright 2026',
      OriginalFilename: 'MarkdownEdit.exe',
      InternalName: 'MarkdownEdit'
    },
    'product-version': '1.0.0',
    'file-version': '1.0.0'
  })

  console.log('  afterPack: exe resources patched successfully')
}
