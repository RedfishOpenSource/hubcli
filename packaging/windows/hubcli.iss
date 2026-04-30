#define AppName "hubcli"
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef StageRoot
  #define StageRoot "release/stage/windows-x64"
#endif
#ifndef OutputDir
  #define OutputDir "release/dist"
#endif
#ifndef OutputBaseFilename
  #define OutputBaseFilename "hubcli-windows-x64-setup"
#endif

[Setup]
AppId={{F6D3E8D2-574D-4A17-B917-B71A18B3A222}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\hubcli
DefaultGroupName=hubcli
UninstallDisplayIcon={app}\hubcli.cmd
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
ChangesEnvironment=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "addtopath"; Description: "Add hubcli to your PATH"; GroupDescription: "Additional tasks:"; Flags: unchecked

[Files]
Source: "{#StageRoot}\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion createallsubdirs

[Icons]
Name: "{group}\hubcli"; Filename: "{app}\hubcli.cmd"
Name: "{group}\Uninstall hubcli"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\hubcli.cmd"; Parameters: "doctor"; Description: "Run hubcli doctor now"; Flags: postinstall nowait skipifsilent unchecked

[Code]
procedure AddDirToPath(Dir: string);
var
  PathValue: string;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', PathValue) then
    PathValue := '';
  if Pos(';' + Uppercase(Dir) + ';', ';' + Uppercase(PathValue) + ';') = 0 then begin
    if (PathValue <> '') and (Copy(PathValue, Length(PathValue), 1) <> ';') then
      PathValue := PathValue + ';';
    PathValue := PathValue + Dir;
    RegWriteStringValue(HKCU, 'Environment', 'Path', PathValue);
  end;
end;

procedure RemoveDirFromPath(Dir: string);
var
  PathValue: string;
  UpdatedValue: string;
begin
  if RegQueryStringValue(HKCU, 'Environment', 'Path', PathValue) then begin
    UpdatedValue := StringChangeEx(';' + PathValue + ';', ';' + Dir + ';', ';', True);
    UpdatedValue := Copy(UpdatedValue, 2, Length(UpdatedValue) - 2);
    RegWriteStringValue(HKCU, 'Environment', 'Path', UpdatedValue);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and WizardIsTaskSelected('addtopath') then begin
    AddDirToPath(ExpandConstant('{app}'));
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then begin
    RemoveDirFromPath(ExpandConstant('{app}'));
  end;
end;
