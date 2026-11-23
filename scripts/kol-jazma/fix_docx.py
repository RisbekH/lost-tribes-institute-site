import zipfile,re,os,sys
f=sys.argv[1]; tmp=f+'.tmp'
ORDER='writeProtection view zoom removePersonalInformation removeDateAndTime doNotDisplayPageBoundaries displayBackgroundShape printPostScriptOverText printFractionalCharacterWidth printFormsData embedTrueTypeFonts embedSystemFonts saveSubsetFonts saveFormsData mirrorMargins alignBordersAndEdges bordersDoNotSurroundHeader bordersDoNotSurroundFooter gutterAtTop hideSpellingErrors hideGrammaticalErrors activeWritingStyle proofState formsDesign attachedTemplate linkStyles stylePaneFormatFilter stylePaneSortMethod documentType mailMerge revisionView trackRevisions doNotTrackMoves doNotTrackFormatting documentProtection autoFormatOverride styleLockTheme styleLockQFSet defaultTabStop autoHyphenation consecutiveHyphenLimit hyphenationZone doNotHyphenateCaps showEnvelope summaryLength clickAndTypeStyle defaultTableStyle evenAndOddHeaders bookFoldRevPrinting bookFoldPrinting bookFoldPrintingSheets drawingGridHorizontalSpacing drawingGridVerticalSpacing displayHorizontalDrawingGridEvery displayVerticalDrawingGridEvery doNotUseMarginsForDrawingGridOrigin drawingGridHorizontalOrigin drawingGridVerticalOrigin doNotShadeFormData noPunctuationKerning characterSpacingControl printTwoOnOne strictFirstAndLastChars noLineBreaksAfter noLineBreaksBefore savePreviewPicture doNotValidateAgainstSchema saveInvalidXml ignoreMixedContent alwaysShowPlaceholderText doNotDemarcateInvalidXml saveXmlDataOnly useXSLTWhenSaving saveThroughXslt showXMLTags alwaysMergeEmptyNamespace updateFields hdrShapeDefaults footnotePr endnotePr compat docVars rsids mathPr attachedSchema themeFontLang clrSchemeMapping doNotIncludeSubdocsInStats doNotAutoCompressPictures forceUpgrade captions readModeInkLockDown smartTagType schemaLibrary shapeDefaults doNotEmbedSmartTags decimalSymbol listSeparator'.split()
PPR='pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange'.split()
TCPR='cnfStyle tcW gridSpan hMerge vMerge tcBorders shd noWrap tcMar textDirection tcFitText vAlign hideMark headers cellIns cellDel cellMerge tcPrChange'.split()
ST='name aliases basedOn next link autoRedefine hidden uiPriority semiHidden unhideWhenUsed qFormat locked personal personalCompose personalReply rsid pPr rPr tblPr trPr tcPr tblStylePr'.split()
def split(body):
    els=[];i=0
    while i<len(body):
        j=body.find('<',i)
        if j<0: break
        name=re.match(r'<([\w:]+)',body[j:]).group(1)
        m=re.match(r'<[\w:]+[^>]*/>',body[j:])
        if m: els.append((name,m.group(0))); i=j+m.end(); continue
        depth=0;k=j
        for t in re.finditer(r'<(/?)'+re.escape(name)+r'\b[^>]*?(/?)>',body[j:]):
            if t.group(2): continue
            depth+= -1 if t.group(1) else 1
            if depth==0: k=j+t.end(); break
        els.append((name,body[j:k])); i=k
    return els
def srt(els,order): return sorted(els,key=lambda e: order.index(e[0].split(':')[-1]) if e[0].split(':')[-1] in order else 999)
def reorder(x,open_re,close,order):
    return re.sub(open_re+r'(.*?)'+close, lambda m: m.group(1)+''.join(e[1] for e in srt(split(m.group(2)),order))+close, x, flags=re.S)
zin=zipfile.ZipFile(f); zout=zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    if it.filename.endswith('/'): continue
    data=zin.read(it.filename)
    if it.filename=='word/document.xml':
        x=data.decode()
        def fixmar(m):
            s=m.group(0)
            for a,v in (('w:header','720'),('w:footer','720'),('w:gutter','0')):
                if a+'=' not in s: s=s.replace('<w:pgMar ','<w:pgMar '+f'{a}="{v}" ')
            return s
        x=re.sub(r'<w:pgMar [^>]*/>',fixmar,x)
        sp=x.rfind('<w:sectPr')
        if '<w:footnotePr>' not in x[sp:]:
            e=x.find('>',sp)+1; x=x[:e]+'<w:footnotePr><w:numFmt w:val="lowerLetter"/></w:footnotePr>'+x[e:]
        x=re.sub(r'<w:pPr>(<w:numPr>.*?</w:numPr>)(<w:pStyle [^>]*/>)',r'<w:pPr>\2\1',x)
        data=x.encode()
    elif it.filename=='word/settings.xml':
        s=data.decode(); s=re.sub(r'<w:zoom [^>]*/>','',s)
        if 'lowerLetter' not in s: s=s.replace('<w:footnotePr>','<w:footnotePr><w:numFmt w:val="lowerLetter"/>',1)
        head=s[:s.index('>',s.index('<w:settings'))+1]; body=s[len(head):s.rindex('</w:settings>')]
        data=(head+''.join(e[1] for e in srt(split(body),ORDER))+'</w:settings>').encode()
    elif it.filename=='word/numbering.xml':
        data=re.sub(r'(<w:nsid w:val=")([0-9A-Fa-f]{1,7})(")',lambda m:m.group(1)+m.group(2).zfill(8)+m.group(3),data.decode()).encode()
    elif it.filename=='word/styles.xml':
        x=data.decode()
        x=reorder(x,r'(<w:pPr>)','</w:pPr>',PPR); x=reorder(x,r'(<w:tcPr>)','</w:tcPr>',TCPR); x=reorder(x,r'(<w:style\b[^>]*>)','</w:style>',ST)
        data=x.encode()
    zout.writestr(it,data)
zout.close(); os.replace(tmp,f)
