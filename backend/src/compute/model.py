"""Train, cross-validate and save the flame-spread regime classifier.

    python -m src.compute.model        (run from backend/)

Outputs (committed to the repo):
    data/artifacts/model.joblib       fitted sklearn Pipeline
    data/artifacts/model_card.json    metrics, confusion matrix, training envelope, features
"""
from __future__ import annotations
import json, pathlib, datetime
import numpy as np
import pandas as pd
import joblib
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import StratifiedKFold, GroupKFold, cross_val_predict, RepeatedStratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "experiments.csv"
ART = ROOT / "data" / "artifacts"
NUMERIC = ["oxygen_pct", "pressure_kpa", "flow_cm_s"]
GRAVITY = "gravity_g"
CATEGORICAL = ["material", "flow_direction"]
FEATURES = NUMERIC + [GRAVITY] + CATEGORICAL
CLASSES = ["no_spread", "marginal_spread", "spread"]
SEED = 42


def load() -> pd.DataFrame:
    df = pd.read_csv(DATA)
    return df


def make_pipeline() -> Pipeline:
    pre = ColumnTransformer([
        ("num", "passthrough", NUMERIC + [GRAVITY]),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
    ])
    clf = GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.1,
                                     subsample=1.0, random_state=SEED)
    return Pipeline([("pre", pre), ("clf", clf)])


def gkey(g: float) -> str:
    """Gravity levels are discrete in the data (0, 0.165, 0.38, 1 g); key them as strings."""
    return f"{float(g):g}"


def _box(g: pd.DataFrame) -> dict:
    return {
        **{c: [float(g[c].min()), float(g[c].max())] for c in NUMERIC},
        "flow_directions": sorted(g["flow_direction"].unique().tolist()),
        "n": int(len(g)),
        "outcomes": {k: int(v) for k, v in g["outcome"].value_counts().items()},
    }


def envelope(df: pd.DataFrame) -> dict:
    """Per-material AND per-gravity-level training box. The range guard uses the box for the requested
    (material, gravity) pair, so e.g. SIBAL at Mars gravity is refused because no such test exists."""
    env = {"global": {c: [float(df[c].min()), float(df[c].max())] for c in NUMERIC},
           "gravity_levels": sorted({gkey(g) for g in df[GRAVITY]}, key=float), "materials": {}}
    for m, g in df.groupby("material"):
        env["materials"][m] = {**_box(g), "by_gravity": {gkey(gv): _box(gg) for gv, gg in g.groupby(GRAVITY)}}
    return env


def train() -> dict:
    df = load()
    X, y = df[FEATURES], df["outcome"]
    groups = df["report_id"]
    n_min = int(y.value_counts().min())
    k = min(5, n_min)
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=SEED)
    pipe = make_pipeline()
    y_pred = cross_val_predict(pipe, X, y, cv=skf)
    cv_acc = accuracy_score(y, y_pred)
    cv_bal = balanced_accuracy_score(y, y_pred)
    cm = confusion_matrix(y, y_pred, labels=CLASSES)
    rep = classification_report(y, y_pred, labels=CLASSES, output_dict=True, zero_division=0)
    rskf = RepeatedStratifiedKFold(n_splits=k, n_repeats=10, random_state=SEED)
    rep_scores = cross_val_score(make_pipeline(), X, y, cv=rskf)
    # harsher: leave-whole-reports-out (GroupKFold by report id)
    gkf = GroupKFold(n_splits=min(5, groups.nunique()))
    yg = cross_val_predict(make_pipeline(), X, y, cv=gkf, groups=groups)
    grp_acc = accuracy_score(y, yg)
    # baseline
    yb = cross_val_predict(DummyClassifier(strategy="most_frequent"), X, y, cv=skf)
    base_acc = accuracy_score(y, yb)

    pipe.fit(X, y)
    ART.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, ART / "model.joblib")
    card = {
        "model": {
            "type": "gradient_boosting",
            "estimator": "sklearn.ensemble.GradientBoostingClassifier(n_estimators=150, max_depth=2, learning_rate=0.1)",
            "sklearn_version": sklearn.__version__,
            "features": FEATURES,
            "classes": list(pipe.classes_),
            "n_train": int(len(df)),
            "n_sources": int(groups.nunique()),
            "n_by_gravity": {gkey(k2): int(v) for k2, v in df[GRAVITY].value_counts().sort_index().items()},
            "cv_accuracy": round(float(cv_acc), 3),
        },
        "metrics": {
            "cv_scheme": f"StratifiedKFold(n_splits={k}, shuffle=True, random_state={SEED}); out-of-fold predictions",
            "cv_accuracy": round(float(cv_acc), 3),
            "cv_balanced_accuracy": round(float(cv_bal), 3),
            "repeated_cv_accuracy_mean": round(float(rep_scores.mean()), 3),
            "repeated_cv_accuracy_std": round(float(rep_scores.std()), 3),
            "repeated_cv_scheme": f"RepeatedStratifiedKFold({k} folds x 10 repeats)",
            "leave_reports_out_accuracy": round(float(grp_acc), 3),
            "leave_reports_out_scheme": "GroupKFold(5) grouped by report_id (whole reports held out)",
            "majority_baseline_accuracy": round(float(base_acc), 3),
            "confusion_matrix": {"labels": CLASSES, "matrix": cm.tolist(),
                                 "note": "rows = true class, columns = predicted class (out-of-fold)"},
            "per_class": {c: {kk: round(float(vv), 3) for kk, vv in rep[c].items()} for c in CLASSES},
            "oof_accuracy_by_gravity": {gkey(gv): {"n": int(m.sum()), "accuracy": round(float((y_pred[m] == y[m]).mean()), 3)}
                                        for gv in sorted(df[GRAVITY].unique()) for m in [(df[GRAVITY] == gv).to_numpy()]},
        },
        "class_counts": {k2: int(v) for k2, v in y.value_counts().items()},
        "training_range": envelope(df),
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
    (ART / "model_card.json").write_text(json.dumps(card, indent=2))
    return card


if __name__ == "__main__":
    c = train()
    m = c["metrics"]
    print(json.dumps(c["model"], indent=1))
    print({k: v for k, v in m.items() if k not in ("per_class",)})
