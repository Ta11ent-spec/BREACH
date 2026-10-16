Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"
Var StartupChoice
Var StartupCheckbox
!ifndef INSTALLROOT
  !define INSTALLROOT "$LOCALAPPDATA\Programs\BREACH Collector"
!endif
!ifndef PRODUCTKEY
  !define PRODUCTKEY "BREACHCollector"
!endif
!ifndef VERSION
  !define VERSION "0.2.0"
!endif
Name "BREACH Collector ${VERSION} — Beta"
OutFile "${OUTPUT}"
InstallDir "${INSTALLROOT}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Collect completed Ranked Bomb replays and sync them to BREACH.$\r$\n$\r$\nThis beta includes its runtime and replay parser. No Python, SQL Server or administrator access is required.$\r$\n$\r$\nSign in to BREACH, then enable sync to upload. This beta is unsigned; second-PC compatibility testing is ongoing. Uninstall preserves the separate local queue and original replays."
!insertmacro MUI_PAGE_WELCOME
Page custom StartupPage StartupLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  StrCpy $StartupChoice ${BST_CHECKED}
  ${GetParameters} $1
  ${GetOptions} $1 "/AUTOSTART=" $2
  StrCmp $2 "0" 0 +2
  StrCpy $StartupChoice ${BST_UNCHECKED}
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

Function StartupPage
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 36u "Passive collection: after you select a replay folder and enable Sync, BREACH can watch automatically and keep running in the system tray. Your PC must be awake."
  Pop $0
  ${NSD_CreateCheckbox} 0 48u 100% 16u "Start BREACH Collector when I sign into Windows"
  Pop $StartupCheckbox
  ${NSD_SetState} $StartupCheckbox $StartupChoice
  ${NSD_CreateLabel} 0 78u 100% 40u "You can turn startup off in the collector. Closing the window keeps it in the tray; use the tray menu to Pause or Quit. No administrator access or Windows service is required."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function StartupLeave
  ${NSD_GetState} $StartupCheckbox $StartupChoice
FunctionEnd

Section "Collector"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*.*"
  WriteINIStr "$INSTDIR\breach-install.ini" "BREACH" "Product" "${PRODUCTKEY}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\${PRODUCTKEY}.lnk" "$INSTDIR\BreachCollector.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "DisplayName" "BREACH Collector (beta)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}" "NoRepair" 1
  ${If} $StartupChoice == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTKEY}" '$\"$INSTDIR\BreachCollector.exe$\" --background'
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTKEY}"
  ${EndIf}
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
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTKEY}"
  StrCmp $0 '$\"$INSTDIR\BreachCollector.exe$\" --background' 0 +2
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTKEY}"
  !include "${UNINSTALL_FILES}"
  Delete "$INSTDIR\breach-install.ini"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${PRODUCTKEY}.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTKEY}"
SectionEnd
