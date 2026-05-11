
import sys

path = 'src/Code.gs'
with open(path, 'rb') as f:
    lines = f.readlines()

# Line 5446 is index 5445
# We want to replace the corrupted block.
# Let's find the start and end of the corruption.
start_idx = 5445
end_idx = -1
for i in range(start_idx, len(lines)):
    if b'ta.narrative_flow' in lines[i]:
        end_idx = i
        break

if end_idx != -1:
    print(f"Found corruption from {start_idx+1} to {end_idx+1}")
    
    # Correct code for the deleted section (5446 to end of contentParagraph logic)
    # Plus the start of createV7HTMLPrompt
    replacement = [
        b"  // \xeb\xb3\xb8\xeb\xac\xb8 \xeb\xac\xb8\xeb\x8b\xa8 (\xeb\xb0\xb0\xea\xb2\xbd\xec\x83\x89 \xec\xa0\x9c\xea\xb1\xb0)\n",
        b"  var contentParagraph = body.appendParagraph(text);\n",
        b"  var contentStyle = {};\n",
        b"  contentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;\n",
        b"  contentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';\n",
        b"  contentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';\n",
        b"  contentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;\n",
        b"  contentParagraph.setAttributes(contentStyle);\n",
        b"  contentParagraph.setSpacingAfter(24);\n",
        b"}\n",
        b"\n",
        b"/**\n",
        b" * =======================================================================\n",
        b" * [NEW] v7 HTML \xed\x85\x8c\xec\x9d\xb4\xeb\xb8\x94 \xeb\xa0\x88\xec\x9d\xb4\xec\x95\x84\xec\x9b\x83 \xec\xa0\x84\xec\x9a\xa9 \xed\x9a\xa8\xec\x88\x98\xeb\x93\xa4\n",
        b" * =======================================================================\n",
        b" */\n",
        b"\n",
        b"/**\n",
        b" * [\xec\x8b\xa0\xea\xb7\x9c] v7 \xed\x85\x8c\xec\x9d\xb4\xeb\xb8\x94 \xeb\xa0\x88\xec\x9d\xb4\xec\x95\x84\xec\x9b\x83 HTML \xed\x94\x84\xeb\xa1\xac\xed\x94\x84\xed\x8a\xb8 \xec\x83\x9d\xec\x84\xb1 - \xed\x86\xa0\xed\x81\xb0 \xec\x95\x9d\xec\xb6\x95 \xeb\xb2\x84\xec\xa0\x84\n",
        b" */\n",
        b"function createV7HTMLPrompt(preprocessData, seoKeywords, highlightKeywords, templateData, styleData, geminiContext) {\n",
        b"  var fulltext = preprocessData.fulltext || \"\";\n",
        b"  var contentOutline = preprocessData.content_outline || [];\n",
        b"  \n",
        b"  // 1. \xec\x8b\x9c\xed\x8a\xb82 \xec\x82\xa4\xed\x83\x80\xec\x9d\xbc \xec\xa7\x80\xec\xb9\xa8 \xec\x83\x9d\xec\x84\xb1\n",
        b"  var styleInstructions = '';\n",
        b"  if (styleData) {\n",
        b"    styleInstructions = '[\xec\x8b\x9c\xed\x8a\xb82 \xec\x82\xa4\xed\x83\x80\xec\x9d\xbc]\\n' +\n",
        b"      '- \xea\xb8\x80\xed\x86\xa4: ' + (styleData.writing_tone || '') + '\\n' +\n",
        b"      '- \xeb\xac\xb8\xec\x9e\xa5\xec\x82\xa4\xed\x83\x80\xec\x9d\xbc: ' + (styleData.sentence_style || '') + '\\n' +\n",
        b"      '- \xea\xb0\x9c\xec\x9d\xb8\xed\x84\xb0\xec\xb9\x98: ' + (styleData.personal_touch || '') + '\\n' +\n",
        b"      '- \xec\x8b\x9c\xea\xb0\x81\xed\x92\x8d\xeb\xb6\x80\xeb\x8f\x84: ' + (styleData.visual_richness || '') + '\\n' +\n",
        b"      '- \xeb\x82\xb4\xeb\x9f\xac\xed\x8b\xbb\xeb\xb8\x8c\xed\x94\x8c\xeb\xa1\x9c\xec\x9a\xb0: ' + (styleData.narrative_flow || '') + '\\n' +\n"
    ]
    
    new_lines = lines[:start_idx] + replacement + lines[end_idx+1:]
    with open(path, 'wb') as f:
        f.writelines(new_lines)
    print("Repair successful.")
else:
    print("Could not find end of corruption.")
