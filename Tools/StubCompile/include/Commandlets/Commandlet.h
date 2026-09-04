// Tools/StubCompile -- STUB of Commandlets/Commandlet.h (Engine; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

class UCommandlet : public UObject
{
	UE_STUB_CLASS_BODY(UCommandlet)

	FString HelpDescription;
	FString HelpUsage;
	FString HelpWebLink;
	TArray<FString> HelpParamNames;
	TArray<FString> HelpParamDescriptions;
	bool IsServer = true;
	bool IsClient = true;
	bool IsEditor = true;
	bool LogToConsole = false;
	bool ShowErrorCount = true;
	bool ShowProgress = true;
	bool FastExit = false;

	virtual int32 Main(const FString& Params) { UE::Stub::Sink(Params); return 0; }
	static void ParseCommandLine(const TCHAR* CmdLine, TArray<FString>& Tokens, TArray<FString>& Switches) { UE::Stub::Sink(CmdLine, Tokens, Switches); }
	static void ParseCommandLine(const TCHAR* CmdLine, TArray<FString>& Tokens, TArray<FString>& Switches, TMap<FString, FString>& Params) { UE::Stub::Sink(CmdLine, Tokens, Switches, Params); }
};
