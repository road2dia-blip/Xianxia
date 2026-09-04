// Tools/StubCompile -- STUB of Curves/CurveFloat.h (Engine; model test only, see README.md).
#pragma once

#include "UObject/Object.h"

struct FRichCurve
{
	float Eval(float InTime, float InDefaultValue = 0.0f) const { UE::Stub::Sink(InTime); return InDefaultValue; }
	int32 GetNumKeys() const { return 0; }
};

class UCurveBase : public UObject
{
	UE_STUB_CLASS_BODY(UCurveBase)
	void GetTimeRange(float& MinTime, float& MaxTime) const { MinTime = 0.0f; MaxTime = 1.0f; }
	void GetValueRange(float& MinValue, float& MaxValue) const { MinValue = 0.0f; MaxValue = 1.0f; }
};

class UCurveFloat : public UCurveBase
{
	UE_STUB_CLASS_BODY(UCurveFloat)
	FRichCurve FloatCurve;
	bool bIsEventCurve = false;
	float GetFloatValue(float InTime) const { return FloatCurve.Eval(InTime); }
};
