!macro customInstall
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".md\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".md\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "" "Edit with MarkdownEdit"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR ".markdown\shell\MarkdownEdit\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUninstall
  DeleteRegKey HKCR ".md\shell\MarkdownEdit"
  DeleteRegKey HKCR ".markdown\shell\MarkdownEdit"
!macroend
