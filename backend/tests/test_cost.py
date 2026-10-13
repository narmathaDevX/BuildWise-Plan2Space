from backend.app.services.cost import calculate_cost, largest_remainder_round


def test_largest_remainder_round():
    values = [34.4, 18.2, 14.9, 21.7, 10.8]
    rounded = largest_remainder_round(values, 100)
    assert sum(rounded) == 100
    assert all(isinstance(v, int) for v in rounded)


def test_cost_calculation_breakdown_sums_exactly():
    for area in [800.0, 1500.0, 1850.0, 2400.0, 3200.0]:
        for q in ["Economy", "Standard", "Premium"]:
            res = calculate_cost(
                total_built_up_area=area,
                quality=q,
                location="Chennai",
                floors=1,
            )

            # Invariant 1: Breakdown amounts sum exactly to total_cost
            breakdown_sum = sum(b["amount"] for b in res["breakdown"])
            assert breakdown_sum == res["total_cost"]

            # Invariant 2: Breakdown percentages sum exactly to 100
            pct_sum = sum(b["percentage"] for b in res["breakdown"])
            assert pct_sum == 100

            # Invariant 3: Exactly 5 items in specified order
            keys = [b["key"] for b in res["breakdown"]]
            assert keys == [
                "structure",
                "masonry",
                "electrical_plumbing",
                "flooring_finishing",
                "doors_windows",
            ]


def test_cost_monotonicity():
    # Cost increases monotonically with built-up area
    cost_1000 = calculate_cost(1000.0, "Standard")["total_cost"]
    cost_1500 = calculate_cost(1500.0, "Standard")["total_cost"]
    cost_2000 = calculate_cost(2000.0, "Standard")["total_cost"]
    assert cost_1000 < cost_1500 < cost_2000

    # Cost increases with quality specification
    cost_econ = calculate_cost(1500.0, "Economy")["total_cost"]
    cost_std = calculate_cost(1500.0, "Standard")["total_cost"]
    cost_prem = calculate_cost(1500.0, "Premium")["total_cost"]
    assert cost_econ < cost_std < cost_prem
