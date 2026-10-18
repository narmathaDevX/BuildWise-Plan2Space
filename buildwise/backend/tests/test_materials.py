from backend.app.services.materials import calculate_default_materials, summarize_materials


def test_materials_calculation_and_numeric_quantities():
    mats = calculate_default_materials(1850.0)
    assert len(mats) >= 15

    # Verify all quantities and rates are numbers, not strings
    for m in mats:
        assert isinstance(m["quantity"], (int, float))
        assert isinstance(m["rate"], (int, float))
        assert isinstance(m["estimated_cost"], int)
        assert isinstance(m["purchased"], bool)

    # Check cement and steel defaults
    cement = next(m for m in mats if m["key"] == "cement")
    assert cement["quantity"] == 420
    assert cement["rate"] == 420.0
    assert cement["purchased"] is True

    steel = next(m for m in mats if m["key"] == "steel")
    assert steel["quantity"] == 3.8
    assert steel["rate"] == 68000.0
    assert steel["purchased"] is True

    summary = summarize_materials(mats)
    assert summary["rates_as_of"] == "October 2026"
    assert summary["total_count"] == len(mats)
    assert summary["purchased_count"] == 2
    assert len(summary["categories"]) >= 5
