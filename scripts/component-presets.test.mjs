import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const editor = await readFile(new URL('../public/legacy/editor.html', import.meta.url), 'utf8')

const requestedPresets = [
  ['premium-copy', '高奢卖点条'],
  ['crown-code', '皇冠型号标'],
  ['sales-top1', '销量 TOP1'],
  ['level-badge', 'A 类等级圆章'],
  ['outline-label', '金标描边标签'],
  ['tan-label', '皮胚升级金标']
]

for (const [id, name] of requestedPresets) {
  assert.match(editor, new RegExp(`\\{id:"${id}",name:"${name}"`), `${name} must be registered in the shared catalog`)
  assert.match(editor, new RegExp(`"${id}":\\{name:"${name}"`), `${name} must have a preset definition`)
}

assert.match(editor, /if\(presetId==="sales-top1"\)return buildSalesTop1Canvas\(\)/, '销量 TOP1 must have an original transparent preview')
assert.match(editor, /cp\.addEventListener\("click"[\s\S]*addImageComponentPreset\(component\)/, 'all preset cards must use the shared insertion flow')
assert.match(editor, /function premiumCopyLayers\(b\)/, '高奢卖点条 must be split into editable layers')
assert.match(editor, /"premium-title"/, '高奢卖点条 title must be an independent text layer')
assert.match(editor, /"premium-sub"/, '高奢卖点条 subtitle must be an independent text layer')
assert.match(editor, /function premiumCopySpec\(type,kind="portrait"\)/, '高奢卖点条 must provide board-specific geometry')
assert.match(editor, /\{y:310,h:134,radius:67,left:79,right:60,size:100,lineHeight:134,alpha:\.7/, '竖图标题 must follow the specified geometry')
assert.match(editor, /\{y:464,h:94,radius:47,left:61,right:60,size:80,lineHeight:94,alpha:\.7/, '竖图副标题 must follow the specified geometry')
assert.match(editor, /\{y:190,h:116,radius:58,left:71,right:60,size:90,lineHeight:110,alpha:\.702/, '方图标题 must follow the specified geometry')
assert.match(editor, /\{y:326,h:94,radius:47,left:50,right:60,size:70,lineHeight:110,alpha:\.702/, '方图副标题 must follow the specified geometry')
assert.match(editor, /function reflowPremiumCopy\(b,it,pillOverride=null\)/, '高奢卖点条 must reflow its background when text changes')
assert.match(editor, /textRight=rightEdge-spec\.right\*scale,leftPad=spec\.left\*scale/, '高奢卖点条 must preserve the right anchor and fixed left padding')
assert.match(editor, /it\.style\.align="right"/, '高奢卖点条 text must remain right aligned')
assert.match(editor, /premiumTarget=other\.componentPresetLayer==="premium-copy"/, '高奢卖点条 syncing must preserve each board variant geometry')
assert.match(editor, /function layoutFixedInlineEditor\(b,type,input\)/, 'fixed premium copy must use a component-shaped inline editor')
assert.match(editor, /input\.addEventListener\("input",\(\)=>layoutFixedInlineEditor\(b,type,input\)\)/, 'fixed premium copy editor must resize while typing')
assert.match(editor, /input\.scrollWidth-input\.clientWidth/, 'fixed premium copy editor must account for browser font metrics without clipping')
assert.match(editor, /editing\?\.componentPreview&&editing\.b===b&&editing\.type===type/, 'canvas copy must be hidden while its component editor is active')
assert.match(editor, /part:"crown-label"/, '皇冠等级 must be an independent text layer')
assert.match(editor, /part:"crown-model"/, '皇冠型号 must be an independent text layer')
assert.match(editor, /part:"sales-title"/, '销量标题 must be an independent text layer')
assert.match(editor, /part:"sales-rank"/, '销量排名 must be an independent text layer')
assert.match(editor, /part:"sales-note"/, '销量说明 must be an independent text layer')
assert.match(editor, /function levelBadgeLayers\(\)\{[\s\S]*editable:false/, '等级圆章 must be a fixed, non-editable raster component')
assert.doesNotMatch(editor, /part:"level-main"|part:"level-sub"/, '等级圆章 must not expose editable text layers')
assert.match(editor, /const groupId="user-group-"\+\(nextGroupId\+\+\)/, 'inserted template components must receive a group id')
assert.match(editor, /item\.groupId=groupId/, 'every inserted template layer must join the initial group')
assert.match(editor, /it\.groupId="user-group-"\+\(nextGroupId\+\+\)/, 'sleep mode must also be inserted as a group')
assert.match(editor, /modifier&&key==="g"[\s\S]*e\.shiftKey\?ungroupSelection\(\):groupSelection\(\)/, 'Ctrl+Shift+G must ungroup the selected component')
assert.match(editor, /function sleepModeOrigin\(b\)\{return\{x:182,y:b\.kind==="portrait"\?681:442\}\}/, 'sleep mode must use original square and portrait coordinates')
assert.doesNotMatch(editor, /b\.w\*\.78|b\.h\*\.58/, 'preset insertion must not auto-scale components')
assert.match(editor, /function ensureComponentPresetFonts\(presetId\)/, 'component fonts must have an explicit loading gate')
assert.match(editor, /document\.fonts\.load\(font,text\)/, 'the loading gate must request each component font before first paint')
assert.match(editor, /return ensureComponentPresetFonts\(presetId\)\.then\(\(\)=>buildOriginalComponentCanvas/, 'component previews must wait for their fonts')
assert.match(editor, /ensureComponentPresetFonts\(presetId\)\.then\(\(\)=>Promise\.all/, 'layered component insertion must wait for its fonts')
assert.match(editor, /Promise\.all\(\[sleepModeReady,ensureComponentPresetFonts\("sleep-mode"\)\]\)/, 'sleep mode insertion must wait for its font')
assert.match(editor, /"sales-top1":\[\["400 95px FZTitle"[\s\S]*"600 117px MontserratSemiBold"[\s\S]*"400 24px FZSub"/, 'sales TOP1 must preload every font used by its text layers')
assert.match(editor, /"premium-copy":\[\["400 100px FZTitle"[\s\S]*"400 80px FZSub"[\s\S]*"400 100px Montserrat"/, 'premium copy must preload the real Chinese and Latin families behind its composite font')
assert.match(editor, /const GOLD_BADGE_SPEC=\{size:52\.7,letterSpacing:2\.64,padLeft:30,padRight:32,padTop:12,padBottom:10,height:73,radius:7\.5,gradient:\["#603F22","#D6AF80","#826846"\]\}/, 'gold badges must use the supplied typography, padding, radius, and gradient specification')
assert.match(editor, /function goldBadgeStyle\(overrides=\{\}\)\{return\{font:"FZSub"/, 'template and library gold badges must share the specified font')
assert.match(editor, /function reflowGoldBadge\(it\)[\s\S]*it\.x=right-it\.w[\s\S]*it\.anchorRight=right/, 'gold badges must resize with text while preserving their right anchor')
assert.match(editor, /textW=spacedWidth\(ctx,text,space\)/, 'gold badge width must use normal live-text advances rather than reference vector outlines')
assert.doesNotMatch(editor, /psdRaster:gold\.raster\?/, 'gold badge text must not load or depend on the reference raster/vector artwork')
assert.match(editor, /function tanLabelLayers\(\)[\s\S]*goldBadgeStyle\(\)[\s\S]*reflowGoldBadge\(it\)/, 'the component-library gold badge must use the same adaptive specification')
assert.match(editor, /if\(spec\.gold\)[\s\S]*liveText:true[\s\S]*reflowGoldBadge\(item\)/, 'template gold badges must render live text and reflow immediately')

console.log('component preset tests passed')
