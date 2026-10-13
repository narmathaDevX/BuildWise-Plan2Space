from backend.app.services.schedule import simulate_schedule


def test_schedule_simulation_invariants():
    total_cost = 3250000
    monthly_budget = 300000.0

    res = simulate_schedule(
        total_cost=total_cost,
        monthly_budget=monthly_budget,
        quality="Standard",
        floors=1,
        built_up_area=1850.0,
        start_date="2026-11-01",
    )

    # Invariant 1: Stage costs sum to total_cost
    stage_costs_sum = sum(s["cost"] for s in res["stages"])
    assert stage_costs_sum == total_cost

    # Invariant 2: Total spend at completion equals total_cost
    assert res["total_spend"] == total_cost

    # Invariant 3: Cumulative spend <= cumulative available funds
    for m in res["months"]:
        month_idx = m["month"]
        cum_available = monthly_budget * month_idx
        assert m["cumulative_spend"] <= cum_available + 1.0

    # Invariant 4: Stage progress is monotonic and <= 100
    prev_prog: dict[str, int] = {s["key"]: 0 for s in res["stages"]}
    for m in res["months"]:
        for k, p in m["stage_progress"].items():
            assert p >= prev_prog[k]
            assert p <= 100
            prev_prog[k] = p

    # Invariant 5: Dependency rules are respected
    # Structure cannot start before Foundation reaches 100%
    # Foundation cannot start before Site Prep reaches 100%
    for m in res["months"]:
        site_prep_p = m["stage_progress"]["site_prep"]
        found_p = m["stage_progress"]["foundation"]
        struct_p = m["stage_progress"]["structure"]

        if found_p > 0:
            assert site_prep_p == 100
        if struct_p > 0:
            assert found_p == 100


def test_schedule_capital_governance():
    # If monthly budget is very small, duration extends safely without crashing
    small_res = simulate_schedule(
        total_cost=3000000,
        monthly_budget=100000.0,
    )
    assert small_res["estimated_months"] >= 24

    # High budget cannot complete faster than minimum physical duration
    large_res = simulate_schedule(
        total_cost=3000000,
        monthly_budget=3000000.0,
    )
    # Physical capacity caps prevent instantaneous completion
    assert large_res["estimated_months"] >= 6
