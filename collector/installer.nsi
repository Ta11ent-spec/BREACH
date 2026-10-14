Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!ifndef INSTALLROOT
  !define INSTALLROOT "$LOCALAPPDATA\Programs\BREACH Collector"
!endif
!ifndef PRODUCTKEY
  !define PRODUCTKEY "BREACHCollector"
!endif
Name "BREACH Collector 0.1.0 — Private preview"
OutFile "${OUTPUT}"
InstallDir "${INSTALLROOT}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Collect replay files and export match JSON locally.$\r$\n$\r$\nThis private preview includes its runtime and replay parser. No Python, SQL Server or administrator access is required.$\r$\n$\r$\nCloud synchronization is not connected. Uninstall preserves the separate local queue and original replays."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  FindWindow $0 "" "BREACH / INTEL — PC Collector"
  StrCmp $0 0 notrunning
  MessageBox MB_ICONSTOP "Close BREACH Collector before installing or updating."
  Abort
  notrunning:
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This preview requires 64-bit Windows."
    Abort
  ${EndIf}
  ; Fixed dedicated destination; command-line /D cannot redirect uninstall scope.
  StrCpy $INSTDIR "${INSTALLROOT}"
  IfFileExists "$INSTDIR\*.*" 0 allowed
  ReadINIStr $0 "$INSTDIR\breach-install.ini" "BREACH" "Product"
  StrCmp $0 "${PRODUCTKEY}" allowed
  MessageBox MB_ICONSTOP "The install folder already exists and is not marked as this collector installation. Nothing was changed."
  Abort
  allowed:
FunctionEnd

Section "Collector"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*.*"
  WriteINIStr "$INSTDIR\breach-install.ini" "BREACH" "Product" "${PRODUCTKEY}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\${PRODUCTKEY}.lnk" "$INSTDIR\BreachCollector.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "DisplayName" "BREACH Collector (private preview)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "NoRepair" 1
SectionEnd

Function un.onInit
  FindWindow $0 "" "BREACH / INTEL — PC Collector"
  StrCmp $0 0 notrunning
  MessageBox MB_ICONSTOP "Close BREACH Collector before uninstalling. Your queue will be preserved."
  Abort
  notrunning:
  StrCmp $INSTDIR "${INSTALLROOT}" 0 refuse
  ReadINIStr $0 "$INSTDIR\breach-install.ini" "BREACH" "Product"
  StrCmp $0 "${PRODUCTKEY}" allowed
  refuse:
    MessageBox MB_ICONSTOP "Collector installation identity does not match. Uninstall stopped."
    Abort
  allowed:
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  !include "${UNINSTALL_FILES}"
  Delete "$INSTDIR\breach-install.ini"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${PRODUCTKEY}.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}"
SectionEnd
