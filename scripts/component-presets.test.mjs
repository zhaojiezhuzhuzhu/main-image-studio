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
assert.match(editor, /const OUTLINE_TAG_SPEC=\{top:328\.91,right:50\.38,minHeight:71\.07,paddingX:30,stroke:3,radius:35\.53,size:45,lineHeight:44,letterSpacing:2\.25\}/, 'outline tags must use the supplied position, spacing, radius, and typography specification')
assert.match(editor, /function outlineTagStyle\(overrides=\{\}\)\{return\{font:"FZTitle"[\s\S]*align:"right"/, 'outline tag copy must use the supplied font and remain right aligned')
assert.match(editor, /function outlineTagTextMetrics\(ctx,text,style\)[\s\S]*spacedInkBounds\(ctx,text,"right",spacing\)[\s\S]*inkWidth/, 'outline tags must measure real visible glyph bounds instead of only typographic advance width')
assert.match(editor, /function layoutOutlineTag\(b,label,frame\)[\s\S]*metrics\.inkWidth\+paddingX\*2\+stroke\*2[\s\S]*inkRight=right-stroke-paddingX[\s\S]*label\.x=inkRight-metrics\.advance-metrics\.inkMax[\s\S]*frame\.x=right-width/, 'outline tags must resize with live glyph bounds while preserving equal visual padding and the right anchor')
assert.match(editor, /function reflowTemplate2Label\(b,it\)\{if\(it\?\.kind!=="text"\)return;const frame=[\s\S]*if\(frame\)\{layoutOutlineTag\(b,it,frame\);return\}if\(templateId!=="2"/, 'framed component text must reflow before template-specific guards so custom and non-template-2 boards update immediately')
assert.match(editor, /function syncLinkedExtra\(source,item\)[\s\S]*else if\(other\.kind==="text"\)reflowTextItem\(peer,other\);render\(peer\)/, 'linked component text must reflow its peer frame immediately')
assert.match(editor, /label\.psdRaster=null;label\.liveText=true/, 'template outline tags must render live text immediately instead of waiting for an edit')
assert.match(editor, /if\(presetId==="outline-label"\)[\s\S]*outlineTagStyle\(\)[\s\S]*layoutOutlineTag\(previewBoard,label,frame\)/, 'the component-library outline preview must use the shared live-text specification')
assert.match(editor, /function outlineLabelLayers\(b\)[\s\S]*layoutOutlineTag\(b,label,frame\)/, 'inserted outline-label components must use the shared adaptive layout')
assert.match(editor, /function salesTop1Layers\(b\)[\s\S]*layoutOutlineTag\(b,label,frame\)/, 'the sales TOP1 component must share the same adaptive outline tag')
const salesTop1ThumbnailSource=editor.slice(editor.indexOf('async function buildSalesTop1Canvas()'),editor.indexOf('async function buildOriginalComponentCanvas'))
assert.match(salesTop1ThumbnailSource, /portrait1-text4\.png[\s\S]*ctx\.drawImage\(label,545,17,374,44\)/, 'the sales TOP1 catalog thumbnail must preserve the original borderless label artwork')
assert.doesNotMatch(salesTop1ThumbnailSource, /drawTemplateOutline\(ctx,frame\)/, 'the sales TOP1 catalog thumbnail must not add an outline frame')
assert.match(editor, /it\.kind==="templateOutline"&&it\.componentId&&!it\.groupId/, 'grouped outline components must remain visible in the layer list')
assert.match(editor, /box\.addEventListener\("input",\(\)=>\{if\(!freeEdit\)return;it\.text=box\.value;reflowEditableItem\(b,it\);layoutFreeTextEditor\(b,it,box\);render\(b\);drawOutline\(b\)\}\)/, 'inline component editing must reflow the outline frame and editor while the user types')
assert.match(editor, /function finishFree\(commit\)[\s\S]*it\.text=original;reflowEditableItem\(b,it\)[\s\S]*pushHistory\(\);it\.text=value/, 'live inline editing must preserve cancel and undo behavior')
assert.match(editor, /bar\.addEventListener\("input"[\s\S]*data-prop="text"[\s\S]*reflowEditableItem\(ref\.b,it\)/, 'property-panel text input must reflow component frames immediately')
assert.match(editor, /freeEdit\?\.it===it&&it\.kind==="text"/, 'canvas text must be hidden while the matching live editor is visible')
assert.match(editor, /function layoutFreeTextEditor\(b,it,box\)[\s\S]*whiteSpace=framed\?"nowrap"/, 'framed component editors must stay on one line and follow the text width')

console.log('component preset tests passed')
