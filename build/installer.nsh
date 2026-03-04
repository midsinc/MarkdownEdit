!macro customInstall
  ; --- Register ProgID for MarkdownEdit ---
  WriteRegStr HKCR "MarkdownEdit.Markdown" "" "Markdown Document"
  WriteRegStr HKCR "MarkdownEdit.Markdown\DefaultIcon" "" "$INSTDIR\resources\app\build\md-file-icon.ico"
  WriteRegStr HKCR "MarkdownEdit.Markdown\shell\open" "" "Open with MarkdownEdit"
  WriteRegStr HKCR "MarkdownEdit.Markdown\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  ; --- Register application capabilities ---
  WriteRegStr HKLM "SOFTWARE\MarkdownEdit" "" "MarkdownEdit"
  WriteRegStr HKLM "SOFTWARE\MarkdownEdit\Capabilities" "ApplicationName" "MarkdownEdit"
  WriteRegStr HKLM "SOFTWARE\MarkdownEdit\Capabilities" "ApplicationDescription" "A minimalistic, feature-rich Markdown editor"
  WriteRegStr HKLM "SOFTWARE\MarkdownEdit\Capabilities\FileAssociations" ".md" "MarkdownEdit.Markdown"
  WriteRegStr HKLM "SOFTWARE\MarkdownEdit\Capabilities\FileAssociations" ".markdown" "MarkdownEdit.Markdown"

  ; --- Register in RegisteredApplications so it shows in Default Apps / Open With ---
  WriteRegStr HKLM "SOFTWARE\RegisteredApplications" "MarkdownEdit" "SOFTWARE\MarkdownEdit\Capabilities"

  ; --- Add to OpenWithProgids for .md and .markdown ---
  WriteRegStr HKCR ".md\OpenWithProgids" "MarkdownEdit.Markdown" ""
  WriteRegStr HKCR ".markdown\OpenWithProgids" "MarkdownEdit.Markdown" ""

  ; --- Context menu entries (right-click on .md files) ---
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".md\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  ; --- Notify Windows shell that file associations changed ---
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'
!macroend

!macro customUninstall
  ; --- Remove ProgID ---
  DeleteRegKey HKCR "MarkdownEdit.Markdown"

  ; --- Remove application capabilities ---
  DeleteRegKey HKLM "SOFTWARE\MarkdownEdit"
  DeleteRegValue HKLM "SOFTWARE\RegisteredApplications" "MarkdownEdit"

  ; --- Remove OpenWithProgids entries ---
  DeleteRegValue HKCR ".md\OpenWithProgids" "MarkdownEdit.Markdown"
  DeleteRegValue HKCR ".markdown\OpenWithProgids" "MarkdownEdit.Markdown"

  ; --- Remove context menu entries ---
  DeleteRegKey HKCR ".md\shell\MarkdownEdit"
  DeleteRegKey HKCR ".markdown\shell\MarkdownEdit"

  ; --- Notify Windows shell ---
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'
!macroend
