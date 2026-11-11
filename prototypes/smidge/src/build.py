# Builds the Smidge prototype: an Artifact page (no document skeleton) and a standalone index.html for the repo.
import sys
d = lambda f: open(f).read()
head = '''<title>Smidge</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800&display=swap">
<style>
''' + d('pop.css') + '\n' + d('shell.css') + '''
</style>
'''
defs = '''<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="mWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dfae"/><stop offset=".5" stop-color="#e3b46d"/><stop offset="1" stop-color="#c28a43"/></linearGradient>
<radialGradient id="mHead" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#ff7a5c"/><stop offset=".55" stop-color="#c8281e"/><stop offset="1" stop-color="#7e1610"/></radialGradient>
<radialGradient id="mFlame" cx=".5" cy=".78" r=".75"><stop offset="0" stop-color="#fff8cf"/><stop offset=".4" stop-color="#ffc63a"/><stop offset=".85" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ff5a1a" stop-opacity="0"/></radialGradient>
</defs></svg>
'''
body = defs + d('shell.html') + '<div class="view" id="pop" hidden>\n' + d('pop.html') + '</div>\n'
scripts = '<script>\n' + '\n'.join(d(f) for f in ['sound.js', 'matchcore.js', 'puzzles.gen.js', 'pop.js', 'stickler.js', 'slice.js', 'skim.js', 'untangle.js', 'pour.js', 'eyeball.js', 'switchboard.js', 'app.js']) + '</script>\n'
frag = head + body + scripts
open('smidge.html', 'w').write(frag)
full = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '</head>\n<body>\n' + body + scripts + '</body>\n</html>\n'
open(sys.argv[1], 'w').write(full)
print('built', len(frag), 'bytes')
