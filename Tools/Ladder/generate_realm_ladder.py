#!/usr/bin/env python3
"""
Project Ascension — Realm Ladder generator (Milestone 0).

Generates the 81-row DT_RealmLadder from the Section 6.3 formulas of the charter
(docs/ASCENSION_CHARTER.md). This script is the *offline* twin of the in-engine
generator (URealmLadderLibrary::GenerateLadderRows in Source/Ascension/Cultivation/RealmLadder.cpp).
Both read the same constants; if you change a constant, change it in
DA_RealmLadderConfig (the in-engine source of truth) and mirror it here.

Outputs (relative to project root):
  Content/Ascension/Data/DT_RealmLadder.csv    UE DataTable CSV import (FRealmLayerRow)
  Content/Ascension/Data/DT_RealmLadder.json   UE DataTable JSON import (preferred; maps import cleanly)
  Tools/Ladder/out/ladder_table.md             Markdown table for CHANGELOG / review

Usage:
  python3 Tools/Ladder/generate_realm_ladder.py            # write all outputs
  python3 Tools/Ladder/generate_realm_ladder.py --preview  # print the six charter preview rows only
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from dataclasses import dataclass, field, asdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# ---------------------------------------------------------------------------
# Config — mirrors UDA_RealmLadderConfig defaults (charter Section 6.3 / 6.6).
# Every constant here is a UPROPERTY on the Data Asset in-engine.
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class LadderConfig:
    # Aura Reach = BaseReach * RealmGrowth^(Realm-1) * (1 + LayerGrowth*(Layer-1))
    BaseReach: float = 800.0
    RealmGrowth: float = 1.9
    LayerGrowth: float = 0.06
    # Dantian Capacity = BaseCapacity * CapacityRealmGrowth^(Realm-1) * (1 + CapacityLayerGrowth*(Layer-1))
    BaseCapacity: float = 10.0
    CapacityRealmGrowth: float = 3.0
    CapacityLayerGrowth: float = 0.1
    # Qi Reserve max = Capacity * ReserveFraction
    ReserveFraction: float = 0.6
    # Progress Required = BaseProgress * ProgressRealmGrowth^(Realm-1) * (1 + ProgressLayerGrowth*(Layer-1))
    BaseProgress: float = 8.0
    ProgressRealmGrowth: float = 2.2
    ProgressLayerGrowth: float = 0.25
    # Stability recovery / s = StabilityRecoveryBase + StabilityRecoveryPerRealm * Realm
    StabilityRecoveryBase: float = 0.05
    StabilityRecoveryPerRealm: float = 0.01
    # Circulation cap (Mantras/Daos raise it)
    MaxCirculationStrength: float = 1.0
    # Pulse timings: Base - PerRealm*(Realm-1), floored.  (DECISIONS.md D-0003)
    PulseChargeBase: float = 1.25
    PulseChargePerRealm: float = 0.03
    PulseChargeFloor: float = 0.9
    PulseRecoveryBase: float = 0.75
    PulseRecoveryPerRealm: float = 0.02
    PulseRecoveryFloor: float = 0.5
    # Ambient wisp count = AmbientCountBase + AmbientCountPerRealm*Realm + floor(Layer / AmbientCountLayerDivisor)
    AmbientCountBase: int = 3
    AmbientCountPerRealm: int = 2
    AmbientCountLayerDivisor: int = 3
    # Ambient spawn interval (seconds) = Base - PerRealm*(Realm-1), floored.  (DECISIONS.md D-0005)
    AmbientSpawnIntervalBase: float = 4.0
    AmbientSpawnIntervalPerRealm: float = 0.25
    AmbientSpawnIntervalFloor: float = 2.0
    # Impure fraction: linear 0.33 (R1) -> 0.5 (R6), then linear 0.5 (R6) -> 0.30 (R9).  (DECISIONS.md D-0004)
    ImpureFractionStart: float = 0.33
    ImpureFractionPeak: float = 0.5
    ImpureFractionPeakRealm: int = 6
    ImpureFractionEnd: float = 0.30
    # Minor Breakthrough base chance = Base - PerLayer*(Layer-1)
    MinorBreakthroughBase: float = 0.9
    MinorBreakthroughPerLayer: float = 0.05
    # Nature weights: Generic always GenericNatureWeight; each nature unlocked at or below this Realm gets UnlockedNatureWeight.  (DECISIONS.md D-0006)
    GenericNatureWeight: float = 1.0
    UnlockedNatureWeight: float = 0.5


# Realm definitions (charter 6.2). Natures listed are the ones *introduced* at that Realm.
# (Realm 8 introduces the Refined *condition*, not a nature; Realm 9 introduces nothing new.)
REALMS = [
    # id,                     display name,               theme colour (hint),   natures introduced
    ("QiSensing",             "Qi Sensing",               "PaleSilver",          ["Generic"]),
    ("QiCondensation",        "Qi Condensation",          "MoonBlue",            ["Yin", "Yang"]),
    ("FoundationEstablishment","Foundation Establishment","EmberAmber",          ["Fire", "Water"]),
    ("CoreFormation",         "Core Formation",           "GoldenCore",          ["Wood", "Metal"]),
    ("NascentSoul",           "Nascent Soul",             "JadeGreen",           ["Earth"]),
    ("SoulTransformation",    "Soul Transformation",      "VioletDusk",          ["Life"]),
    ("VoidRefinement",        "Void Refinement",          "VoidIndigo",          ["Void"]),
    ("DaoIntegration",        "Dao Integration",          "TwinWhite",           []),
    ("Ascension",             "Ascension",                "HeavenGold",          []),
]

STAGE_LABELS = {1: "Early", 2: "Early", 3: "Early", 4: "Middle", 5: "Middle", 6: "Middle", 7: "Late", 8: "Late", 9: "Peak"}


@dataclass
class RealmLayerRow:
    Name: str
    Realm: int
    Layer: int
    AuraReach: float
    DantianCapacity: float
    QiReserveMax: float
    ProgressRequired: float
    StabilityRecovery: float
    MaxCirculationStrength: float
    PulseChargeDuration: float
    PulseRecoveryDuration: float
    AmbientWispCount: int
    AmbientSpawnInterval: float
    ImpureFraction: float
    NatureWeights: dict = field(default_factory=dict)
    MinorBreakthroughBaseChance: float = 0.0


def impure_fraction(cfg: LadderConfig, realm: int) -> float:
    if realm <= cfg.ImpureFractionPeakRealm:
        t = (realm - 1) / (cfg.ImpureFractionPeakRealm - 1)
        return cfg.ImpureFractionStart + (cfg.ImpureFractionPeak - cfg.ImpureFractionStart) * t
    t = (realm - cfg.ImpureFractionPeakRealm) / (9 - cfg.ImpureFractionPeakRealm)
    return cfg.ImpureFractionPeak + (cfg.ImpureFractionEnd - cfg.ImpureFractionPeak) * t


def nature_weights(cfg: LadderConfig, realm: int) -> dict:
    weights = {}
    for idx, (_id, _name, _col, natures) in enumerate(REALMS, start=1):
        if idx > realm:
            break
        for n in natures:
            weights[n] = cfg.GenericNatureWeight if n == "Generic" else cfg.UnlockedNatureWeight
    return weights


def generate_row(cfg: LadderConfig, realm: int, layer: int) -> RealmLayerRow:
    r, l = realm - 1, layer - 1
    reach = cfg.BaseReach * (cfg.RealmGrowth ** r) * (1.0 + cfg.LayerGrowth * l)
    capacity = cfg.BaseCapacity * (cfg.CapacityRealmGrowth ** r) * (1.0 + cfg.CapacityLayerGrowth * l)
    reserve = capacity * cfg.ReserveFraction
    progress = cfg.BaseProgress * (cfg.ProgressRealmGrowth ** r) * (1.0 + cfg.ProgressLayerGrowth * l)
    stab = cfg.StabilityRecoveryBase + cfg.StabilityRecoveryPerRealm * realm
    charge = max(cfg.PulseChargeFloor, cfg.PulseChargeBase - cfg.PulseChargePerRealm * r)
    recovery = max(cfg.PulseRecoveryFloor, cfg.PulseRecoveryBase - cfg.PulseRecoveryPerRealm * r)
    count = cfg.AmbientCountBase + cfg.AmbientCountPerRealm * realm + (layer // cfg.AmbientCountLayerDivisor)
    interval = max(cfg.AmbientSpawnIntervalFloor, cfg.AmbientSpawnIntervalBase - cfg.AmbientSpawnIntervalPerRealm * r)
    impure = impure_fraction(cfg, realm)
    chance = cfg.MinorBreakthroughBase - cfg.MinorBreakthroughPerLayer * l
    return RealmLayerRow(
        Name=f"R{realm}L{layer}",
        Realm=realm, Layer=layer,
        AuraReach=round(reach, 2),
        DantianCapacity=round(capacity, 2),
        QiReserveMax=round(reserve, 2),
        ProgressRequired=round(progress, 2),
        StabilityRecovery=round(stab, 4),
        MaxCirculationStrength=cfg.MaxCirculationStrength,
        PulseChargeDuration=round(charge, 3),
        PulseRecoveryDuration=round(recovery, 3),
        AmbientWispCount=int(count),
        AmbientSpawnInterval=round(interval, 3),
        ImpureFraction=round(impure, 4),
        NatureWeights=nature_weights(cfg, realm),
        MinorBreakthroughBaseChance=round(chance, 4),
    )


def generate_all(cfg: LadderConfig) -> list[RealmLayerRow]:
    return [generate_row(cfg, realm, layer) for realm in range(1, 10) for layer in range(1, 10)]


def map_to_ue_text(m: dict) -> str:
    # UE ImportText format for TMap<FName,float>: ((Key, Value),(Key, Value))
    return "(" + ",".join(f"({k}, {v})" for k, v in m.items()) + ")"


def write_csv(rows: list[RealmLayerRow], path: str) -> None:
    cols = ["Name", "Realm", "Layer", "AuraReach", "DantianCapacity", "QiReserveMax", "ProgressRequired",
            "StabilityRecovery", "MaxCirculationStrength", "PulseChargeDuration", "PulseRecoveryDuration",
            "AmbientWispCount", "AmbientSpawnInterval", "ImpureFraction", "NatureWeights", "MinorBreakthroughBaseChance"]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        # UE DataTable CSV convention: first header cell is the row-name column (any label works; '---' is idiomatic).
        w.writerow(["---"] + cols[1:])
        for r in rows:
            d = asdict(r)
            d["NatureWeights"] = map_to_ue_text(r.NatureWeights)
            w.writerow([d[c] for c in cols])


def write_json(rows: list[RealmLayerRow], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = []
    for r in rows:
        d = asdict(r)
        out.append(d)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")


def write_markdown(rows: list[RealmLayerRow], path: str, cfg: LadderConfig) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("| Row | Realm | Layer | Stage | Reach | Capacity | Reserve | Progress | StabRec/s | Charge s | Recov s | Wisps | Spawn s | Impure | BT base | Natures |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n")
        for r in rows:
            realm_name = REALMS[r.Realm - 1][1]
            f.write(f"| {r.Name} | {r.Realm} {realm_name} | {r.Layer} | {STAGE_LABELS[r.Layer]} | {r.AuraReach:,.0f} | {r.DantianCapacity:,.1f} | {r.QiReserveMax:,.1f} | {r.ProgressRequired:,.1f} | {r.StabilityRecovery:.2f} | {r.PulseChargeDuration:.2f} | {r.PulseRecoveryDuration:.2f} | {r.AmbientWispCount} | {r.AmbientSpawnInterval:.2f} | {r.ImpureFraction:.2f} | {r.MinorBreakthroughBaseChance:.2f} | {' '.join(r.NatureWeights.keys())} |\n")
        f.write("\nConfig used:\n\n```\n")
        for k, v in asdict(cfg).items():
            f.write(f"{k} = {v}\n")
        f.write("```\n")


PREVIEW = [(1, 1), (1, 9), (2, 1), (4, 1), (7, 1), (9, 9)]


def print_preview(rows: list[RealmLayerRow]) -> None:
    by = {(r.Realm, r.Layer): r for r in rows}
    print(f"{'Row':6} {'Reach':>10} {'Capacity':>10} {'Reserve':>10} {'Progress':>10} {'StabRec':>8} {'Charge':>7} {'Recov':>6} {'Wisps':>5} {'Spawn':>6} {'Impure':>6} {'BTbase':>6}")
    for k in PREVIEW:
        r = by[k]
        print(f"{r.Name:6} {r.AuraReach:>10,.0f} {r.DantianCapacity:>10,.1f} {r.QiReserveMax:>10,.1f} {r.ProgressRequired:>10,.1f} {r.StabilityRecovery:>8.2f} {r.PulseChargeDuration:>7.2f} {r.PulseRecoveryDuration:>6.2f} {r.AmbientWispCount:>5} {r.AmbientSpawnInterval:>6.2f} {r.ImpureFraction:>6.2f} {r.MinorBreakthroughBaseChance:>6.2f}")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="print the charter preview rows and exit")
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "Content", "Ascension", "Data"))
    args = ap.parse_args(argv)
    cfg = LadderConfig()
    rows = generate_all(cfg)
    assert len(rows) == 81, len(rows)
    if args.preview:
        print_preview(rows)
        return 0
    write_csv(rows, os.path.join(args.out_dir, "DT_RealmLadder.csv"))
    write_json(rows, os.path.join(args.out_dir, "DT_RealmLadder.json"))
    write_markdown(rows, os.path.join(ROOT, "Tools", "Ladder", "out", "ladder_table.md"), cfg)
    print_preview(rows)
    print(f"\nWrote {len(rows)} rows to {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
